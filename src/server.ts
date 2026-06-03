import app from './app';
import { env } from './config/env';
import { logger } from './common/utils/logger';
import { disconnectPrisma } from './config/database/prisma.client';
import './common/events/event-handlers';

const server = app.listen(env.PORT, () => {
  logger.info(`Marketplace API running on port ${env.PORT}`, {
    env: env.NODE_ENV,
    docs: `${env.API_BASE_URL}/docs`,
  });
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
