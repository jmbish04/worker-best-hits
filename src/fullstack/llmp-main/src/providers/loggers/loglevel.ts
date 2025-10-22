import log, { LogLevelDesc } from "loglevel";
import Logger from "@/interfaces/logger";

class LogLevelLogger implements Logger {
  #logger = log;

  constructor(logLevel: LogLevelDesc = "info") {
    this.#logger = log;
    this.#logger.setLevel(logLevel);
  }

  log(level: string, message: string, meta: any = ''): void {
    this.#logger.log(level, message, meta);
  }

  info(message: string, meta: any = ''): void {
    this.#logger.info(message, meta);
  }

  warn(message: string, meta: any = ''): void {
    this.#logger.warn(message, meta);
  }

  error(message: string, meta: any = ''): void {
    this.#logger.error(message, meta);
  }

  debug(message: string, meta: any = ''): void {
    this.#logger.debug(message, meta);
  }
}

export default LogLevelLogger;