import Logger from "@/interfaces/logger";
import Embeddings from "@/interfaces/embeddings";

class CloudflareEmbeddings extends Embeddings {
  private ai: any;
  private embeddingsModel: string;

  constructor(
    ai: any,
    logger: Logger,
    embeddingsModel: string = "@cf/baai/bge-base-en-v1.5"
  ) {
    super(logger);
    this.ai = ai;
    this.embeddingsModel = embeddingsModel;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    this.logger.debug('Generating embeddings', { textsCount: texts.length });
    try {
      const resp = await this.ai.run(this.embeddingsModel, { text: texts });
      this.logger.debug('Embeddings generated successfully');
      return resp.data;
    } catch (error) {
      this.logger.error('Error generating embeddings', { error });
      throw error;
    }
  }
}

export default CloudflareEmbeddings;