import Logger from "@/interfaces/logger";

abstract class Chat {
  protected systemPrompt: string;
  protected logger: Logger;

  constructor(systemPrompt: string, logger: Logger) {
    this.systemPrompt = systemPrompt;
    this.logger = logger;
  }

  abstract generateResponse(
    query: string,
    context: string,
    userPreferences: string,
    facts: string
  ): Promise<string>;
}

export default Chat;