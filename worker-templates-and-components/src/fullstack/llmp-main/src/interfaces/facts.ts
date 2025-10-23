import Logger from "@/interfaces/logger";

abstract class Facts {
  protected userId: string;
  protected logger: Logger;

  constructor(userId: string, logger: Logger) {
    this.userId = userId;
    this.logger = logger;
  }

  abstract getFacts(): Promise<string[]>;
  abstract updateFacts(newFact: string): Promise<void>;
  abstract removeFact(fact: string): Promise<void>;
  abstract extractAndUpdateFacts(text: string): Promise<void>;
}

export default Facts;