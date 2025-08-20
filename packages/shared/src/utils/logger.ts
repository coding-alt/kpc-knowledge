export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, meta?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  }

  info(message: string, meta?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, meta || '');
    }
  }

  warn(message: string, meta?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, meta || '');
    }
  }

  error(message: string, meta?: any): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, meta || '');
    }
  }
}

// 默认logger实例
export const logger: Logger = new ConsoleLogger(
  process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
  process.env.LOG_LEVEL === 'warn' ? LogLevel.WARN :
  process.env.LOG_LEVEL === 'error' ? LogLevel.ERROR :
  LogLevel.INFO
);

/**
 * 创建带有上下文的logger
 */
export function createLogger(context: string): Logger {
  return {
    debug: (message: string, meta?: any) => logger.debug(`[${context}] ${message}`, meta),
    info: (message: string, meta?: any) => logger.info(`[${context}] ${message}`, meta),
    warn: (message: string, meta?: any) => logger.warn(`[${context}] ${message}`, meta),
    error: (message: string, meta?: any) => logger.error(`[${context}] ${message}`, meta),
  };
}