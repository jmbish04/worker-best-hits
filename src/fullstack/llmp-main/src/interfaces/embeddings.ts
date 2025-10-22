import Logger from "@/interfaces/logger";

abstract class Embeddings {
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  abstract generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export default Embeddings;