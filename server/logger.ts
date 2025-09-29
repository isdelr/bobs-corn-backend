/**
 * Structured Logging Configuration
 * 
 * Implements Winston logger for comprehensive application monitoring.
 * Provides structured JSON logging for production environments and
 * human-readable console output for development.
 * 
 * Features:
 * - Automatic request ID generation for tracing
 * - HTTP request/response logging with timing
 * - Error stack trace capture
 * - File-based log persistence
 * - Environment-aware log levels
 * 
 * Log Levels (in order of severity):
 * - error: Application errors requiring attention
 * - warn: Warning conditions (4xx responses, deprecations)
 * - info: General informational messages (requests, startup)
 * - debug: Detailed debugging information (dev only)
 * 
 * @module logger
 */

import { createLogger, format, transports, Logger } from 'winston';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

// ESM module directory resolution
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

// Create logs directory if it doesn't exist
const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Winston Logger Instance
 * 
 * Configuration:
 * - JSON format for structured logging (machine-readable)
 * - Timestamp in ISO format for log aggregation
 * - Error stack traces automatically captured
 * - Service metadata for multi-service environments
 * 
 * Production Usage:
 * - Integrate with log aggregation services (ELK, Datadog, etc.)
 * - Set up alerts for error-level logs
 * - Use request IDs for distributed tracing
 */
export const logger: Logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Human-readable timestamps
    format.errors({ stack: true }),                        // Capture error stack traces
    format.splat(),                                        // String interpolation support
    format.json()                                          // JSON output for parsing
  ),
  defaultMeta: { 
    service: 'bobs-corn-backend',  // Service identifier for log aggregation
    env: NODE_ENV                   // Environment tag
  },
  transports: [
    // Separate error log file for critical issues
    new transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    // Combined log file for all levels
    new transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    }),
  ],
});

/**
 * Development Console Logger
 * 
 * In non-production environments, add colorized console output
 * for better developer experience during debugging.
 */
if (NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),  // Add colors for log levels
        format.printf(({ level, message, timestamp, ...meta }) => {
          // Custom format for readable console output
          const rest = Object.keys(meta).length 
            ? ` ${JSON.stringify(meta)}` 
            : '';
          return `${timestamp} ${level}: ${message}${rest}`;
        })
      ),
    })
  );
}

/**
 * HTTP Request Logger Middleware
 * 
 * Logs all HTTP requests with:
 * - Unique request ID for tracing
 * - Response time in milliseconds
 * - Status code with appropriate log level
 * - Client IP and User-Agent
 * - Response size
 * 
 * Request ID Flow:
 * 1. Check for existing X-Request-ID header (from proxy/client)
 * 2. Generate new UUID if not present
 * 3. Attach to req.id for use throughout request lifecycle
 * 
 * Performance:
 * - Uses high-resolution timer for accurate measurements
 * - Minimal overhead (~1-2ms per request)
 */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate or extract request ID for distributed tracing
  if (!req.id) {
    const existing = req.headers['x-request-id'];
    req.id = typeof existing === 'string' ? existing : randomUUID();
  }

  // Start high-resolution timer for request duration
  const start = process.hrtime.bigint();
  let logged = false;
  
  /**
   * Log request completion
   * Called on both 'finish' and 'close' events to ensure logging
   */
  function done(): void {
    if (logged) return; // Prevent duplicate logs
    logged = true;
    
    // Calculate request duration in milliseconds
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    
    // Determine log level based on status code
    // 5xx = error (server issues)
    // 4xx = warn (client errors)
    // others = info (successful requests)
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    // Metadata for structured logging
    interface LogMeta {
      reqId: string;
      status: number;
      durationMs: number;
      ip?: string;
      userAgent?: string;
      contentLength?: string | number;
    }

    const meta: LogMeta = {
      reqId: req.id!,                                     // Request ID for tracing
      status,                                             // HTTP status code
      durationMs,                                         // Response time
      ip: req.ip,                                        // Client IP
      userAgent: req.headers['user-agent'],             // Client identifier
      contentLength: res.getHeader('content-length') as string | number | undefined, // Response size
    };

    // Remove undefined values
    if (!meta.contentLength) delete meta.contentLength;

    // Log with structured metadata
    logger.log(level, '%s %s', method, url, meta);
  }

  // Listen for response completion events
  res.on('finish', done);  // Normal completion
  res.on('close', done);   // Connection closed (including errors)
  
  next();
}
