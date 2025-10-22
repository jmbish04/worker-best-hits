import Logger from "@/interfaces/logger";

abstract class RAG {
  protected userId: string;
  protected logger: Logger;

  constructor(userId: string, logger: Logger) {
    this.userId = userId;
    this.logger = logger;
  }

  abstract retrieveRelevantTexts(
    queryEmbedding: number[],
    topK: number
  ): Promise<string[]>;
  abstract storeEmbedding(
    id: string,
    embedding: number[]
  ): Promise<void>;
}

export default RAG;