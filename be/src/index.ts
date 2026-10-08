import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import dotenv from 'dotenv';
import { initDb } from './db/index.js';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { votesRoutes } from './routes/votes.js';
import { guestbookRoutes } from './routes/guestbook.js';

dotenv.config();

const port = parseInt(process.env.PORT || '8000', 10);
const host = process.env.HOST || '0.0.0.0';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

async function main() {
  // Plugins
  await app.register(cors, {
    origin: true, // Allow all or configure as needed
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });
  await app.register(sensible);

  // Initialize DB (non-blocking failure with memory fallback)
  await initDb();

  // Register Routes
  await app.register(healthRoutes);
  await app.register(metaRoutes);
  await app.register(votesRoutes);
  await app.register(guestbookRoutes);

  // Graceful Shutdown Handler
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`[SHUTDOWN] Received ${signal}. Closing Fastify server gracefully...`);
      try {
        await app.close();
        app.log.info('[SHUTDOWN] Fastify closed. Exiting process cleanly.');
        process.exit(0);
      } catch (err) {
        app.log.error(err, '[SHUTDOWN] Error during graceful shutdown.');
        process.exit(1);
      }
    });
  });

  try {
    await app.listen({ port, host });
    app.log.info(`🚀 demo-app BE server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
