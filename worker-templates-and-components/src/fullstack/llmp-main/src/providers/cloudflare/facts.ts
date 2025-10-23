import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { KVNamespace, Vectorize } from "@cloudflare/workers-types";

import Logger from "@/interfaces/logger";
import Embeddings from "@/interfaces/embeddings";
import Facts from "@/interfaces/facts";

class CloudflareKVFacts extends Facts {
  private kv: KVNamespace;
  private vectorIndex: Vectorize;
  private embeddings: Embeddings;
  private openai: any;

  constructor(
    kv: KVNamespace,
    vectorIndex: Vectorize,
    embeddings: Embeddings,
    openaiApiKey: string,
    userId: string,
    logger: Logger
  ) {
    super(userId, logger);
    this.kv = kv;
    this.vectorIndex = vectorIndex;
    this.embeddings = embeddings;
    this.openai = createOpenAI({ apiKey: openaiApiKey });
  }

  async getFacts(): Promise<string[]> {
    this.logger.debug('Retrieving facts from KV store', { userId: this.userId });
    try {
      const facts = await this.kv.get(`facts:${this.userId}`);
      if (facts) {
        const factsArray = JSON.parse(facts);
        this.logger.debug('Facts retrieved', { count: factsArray.length });
        return factsArray;
      } else {
        this.logger.debug('No facts found');
        return [];
      }
    } catch (error) {
      this.logger.error('Error getting facts', { error });
      return [];
    }
  }

  async updateFacts(newFact: string): Promise<void> {
    this.logger.debug('Updating facts', { userId: this.userId, newFact });
    try {
      // Generate embeddings for the new fact
      const [newFactEmbedding] = await this.embeddings.generateEmbeddings([newFact]);

      // Check if the fact already exists using Vectorize
      const resp = await this.vectorIndex.query(newFactEmbedding, {
        namespace: `facts:${this.userId}`,
        topK: 1,
      });

      const exists =
        resp.matches &&
        resp.matches.length > 0 &&
        resp.matches[0].score > 0.9;

      if (exists) {
        // Fact already exists, maybe update it
        await this.removeFact(resp.matches[0].id);
        this.logger.debug('Existing fact removed', { factId: resp.matches[0].id });
      }

      // Store the fact in KV
      let facts = await this.getFacts();
      facts.push(newFact);
      await this.kv.put(`facts:${this.userId}`, JSON.stringify(facts));
      this.logger.debug('New fact stored in KV', { fact: newFact });

      // Store the embedding in Vectorize
      await this.vectorIndex.upsert([
        {
          id: newFact,
          namespace: `facts:${this.userId}`,
          values: newFactEmbedding,
        },
      ]);
      this.logger.debug('New fact embedding stored in Vectorize', { fact: newFact });
    } catch (error) {
      this.logger.error('Error updating facts', { error });
      throw error;
    }
  }

  async removeFact(fact: string): Promise<void> {
    this.logger.debug('Removing fact', { userId: this.userId, fact });
    try {
      // Remove from KV
      let facts = await this.getFacts();
      facts = facts.filter((f) => f !== fact);
      await this.kv.put(`facts:${this.userId}`, JSON.stringify(facts));
      this.logger.debug('Fact removed from KV', { fact });

      // Remove from Vectorize
      const vectors = await this.embeddings.generateEmbeddings([fact]);
      const vector = vectors[0];
      const embedding = await this.vectorIndex.query(vector, {
        namespace: `facts:${this.userId}`,
        topK: 1,
      });
      const match = embedding.matches[0];
      await this.vectorIndex.deleteByIds([match.id]);
      this.logger.debug('Fact removed from Vectorize', { fact });
    } catch (error) {
      this.logger.error('Error removing fact', { error });
      throw error;
    }
  }

  async extractAndUpdateFacts(text: string): Promise<void> {
    this.logger.debug('Extracting facts from text');
    const model = this.openai.chat('gpt-4', { user: this.userId });

    const systemPrompt = `Extract any new facts or information from the following text and present them as a list of concise statements. If there are no new facts, return an empty list.`;

    try {
      const resp = await generateText({
        messages: [{ role: 'user', content: text }],
        model,
        system: systemPrompt,
      });

      const extractedFacts = resp.text
        .split('\n')
        .map((fact) => fact.trim())
        .filter((fact) => fact);

      this.logger.debug('Facts extracted', { count: extractedFacts.length });

      for (const fact of extractedFacts) {
        await this.updateFacts(fact);
        this.logger.debug('Fact updated', { fact });
      }
    } catch (error) {
      this.logger.error('Error extracting and updating facts', { error });
    }
  }
}

export default CloudflareKVFacts;