/**
 * Logger utility for the Documents module
 * 
 * Provides consistent logging across all services with proper formatting
 * and log levels. Integrates with the validator logging infrastructure.
 * 
 * @module logger
 */

import * as winston from 'winston';

/**
 * Log levels for the application
 */
export enum LogLevel {
  /** Error messages */
  ERROR = 'error',
  /** Warning messages */
  WARN = 'warn',
  /** Informational messages */
  INFO = 'info',
  /** HTTP request/response logs */
  HTTP = 'http',
  /** Verbose logging */
  VERBOSE = 'verbose',
  /** Debug messages */
  DEBUG = 'debug',
  /** Silly level (most verbose) */
  SILLY = 'silly'
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Current log level */
  level: LogLevel;
  /** Whether to log to console */
  console: boolean;
  /** Whether to log to file */
  file: boolean;
  /** Log file path */
  filePath?: string;
  /** Whether to use JSON format */
  json: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  console: true,
  file: true,
  filePath: 'logs/documents.log',
  json: process.env.NODE_ENV === 'production'
};

/**
 * Create Winston logger instance
 * @param config - Logger configuration options
 * @returns Winston logger instance
 */
function createLogger(config: LoggerConfig = defaultConfig): winston.Logger {
  const transports: winston.transport[] = [];

  // Console transport
  if (config.console) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
            return `${String(timestamp)} [${String(level)}]: ${String(message)} ${metaStr}`;
          })
        )
      })
    );
  }

  // File transport
  if (config.file === true && config.filePath !== undefined && config.filePath !== '') {
    transports.push(
      new winston.transports.File({
        filename: config.filePath,
        format: config.json
          ? winston.format.json()
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
                return `${String(timestamp)} [${String(level)}]: ${String(message)} ${metaStr}`;
              })
            )
      })
    );
  }

  return winston.createLogger({
    level: config.level,
    transports,
    exitOnError: false
  });
}

/**
 * Main logger instance
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context
 * @param context - Additional context for the logger
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

/**
 * Log an error with stack trace
 * @param message - Error message
 * @param error - Error object
 * @param meta - Additional metadata
 */
export function logError(
  message: string,
  error: unknown,
  meta?: Record<string, unknown>
): void {
  const errorInfo = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    : { error: String(error) };

  logger.error(message, {
    ...errorInfo,
    ...meta
  });
}

/**
 * Log a debug message (only in development)
 * @param message - Debug message
 * @param meta - Additional metadata
 */
export function debug(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(message, meta);
  }
}