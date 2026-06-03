import winston from 'winston';
import { env } from '../../config/env';

const { combine, timestamp, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${ts} [${level}]: ${message} ${metaStr}`;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), json()),
  defaultMeta: { service: 'marketplace-api' },
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), timestamp(), devFormat),
    }),
  ],
});

export const authLogger = logger.child({ module: 'auth' });
export const paymentLogger = logger.child({ module: 'payment' });
export const auditLogger = logger.child({ module: 'audit' });
export const dbLogger = logger.child({ module: 'database' });
