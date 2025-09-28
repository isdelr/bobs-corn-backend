import { createLogger, format, transports } from 'winston';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

const LOG_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'bobs-corn-backend', env: NODE_ENV },
  transports: [
    new transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
  ],
});

if (NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...meta }) => {
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${rest}`;
        })
      ),
    })
  );
}

export function httpLogger(req, res, next) {
  // Ensure a request id
  if (!req.id) {
    const existing = req.headers['x-request-id'];
    req.id = typeof existing === 'string' ? existing : randomUUID();
  }

  const start = process.hrtime.bigint();
  let logged = false;
  function done() {
    if (logged) return; // avoid double logging on finish+close
    logged = true;
    const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    const meta = {
      reqId: req.id,
      status,
      durationMs,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      contentLength: res.getHeader('content-length') || undefined,
    };

    // Use parameter-based logging with splat + meta
    logger.log(level, '%s %s', method, url, meta);
  }

  res.on('finish', done);
  res.on('close', done);
  next();
}
