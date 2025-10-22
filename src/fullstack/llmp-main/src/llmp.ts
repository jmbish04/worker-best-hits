import { LLMPContext } from '@/types';

import Chat from '@/interfaces/chat';
import Embeddings from '@/interfaces/embeddings';
import Facts from '@/interfaces/facts';
import Logger from '@/interfaces/logger';
import Memory from '@/interfaces/memory';
import RAG from '@/interfaces/rag';

class LLMP {
  private chat: Chat;
  private context: LLMPContext;
  private embeddings: Embeddings;
  private facts: Facts;
  private logger: Logger;
  private memory: Memory;
  private rag: RAG;

  constructor({
    chat,
    context,
    embeddings,
    facts,
    logger,
    memory,
    rag,
  }: {
    chat: Chat;
    context: LLMPContext;
    embeddings: Embeddings;
    facts: Facts;
    logger: Logger;
    memory: Memory;
    rag: RAG;
  }) {
    this.chat = chat;
    this.context = context;
    this.embeddings = embeddings;
    this.facts = facts;
    this.logger = logger;
    this.memory = memory;
    this.rag = rag;
  }

  async handleQuery(
    query: string,
    userPreferences?: string
  ): Promise<string> {
    this.logger.info('Received user query', { userId: this.context.userId, query });

    // Save user message
    const userMessageId = await this.memory.saveMessage(query, "user");

    // Generate embeddings for the user message
    this.logger.debug('Generating embeddings for user message', { messageId: userMessageId });
    const [userMessageEmbedding] = await this.embeddings.generateEmbeddings([
      query,
    ]);

    // Store the embedding in the vector store
    await this.rag.storeEmbedding(
      userMessageId.toString(),
      userMessageEmbedding
    );
    this.logger.debug('Stored user message embedding', { messageId: userMessageId });

    // Get previous messages for context
    const previousMessages = await this.memory.getPreviousMessages(this.memory.messageLimit);
    this.logger.debug('Retrieved previous messages for context', { count: previousMessages.length });
    const context = previousMessages

    // Retrieve relevant texts using RAG
    const relevantTexts = await this.rag.retrieveRelevantTexts(
      userMessageEmbedding,
      5
    );
    this.logger.debug('Retrieved relevant texts using RAG', { count: relevantTexts.length });
    const relevantContext = relevantTexts

    // Get facts
    const factsArray = await this.facts.getFacts();
    this.logger.debug('Retrieved facts', { count: factsArray.length });
    const facts = factsArray.join('\n');

    const fullContext = new Set([...context, ...relevantContext])

    // Generate AI response
    const aiResponse = await this.chat.generateResponse(
      query,
      Array.from(fullContext).join('\n'),
      userPreferences || "",
      facts
    );

    this.logger.info('Generated AI response')

    // We intentionally do not save AI message or generate embeddings for it
    // We also do not extract new facts from it
    // This may change in the future

    // Return the AI response
    return aiResponse;
  }
}

export default LLMP;