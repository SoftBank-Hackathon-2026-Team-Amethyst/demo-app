import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import dotenv from 'dotenv';
import { initDb } from './db/index.js';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { votesRoutes } from './routes/votes.js';
import { guestbookRoutes } from './routes/guestbook.js';
import { registerMetrics } from './routes/metrics.js';
import { chaosRoutes, chaosState } from './routes/chaos.js';

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

  // Metrics (hook은 루트 인스턴스에 등록)
  registerMetrics(app);

  // Chaos Engineering Hook (metrics 및 chaos 제어 경로는 제외)
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/api/chaos') || req.url.startsWith('/api/metrics')) {
      return;
    }

    // 1. 지연 주입
    if (chaosState.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, chaosState.latencyMs));
    }

    // 2. 에러율 주입
    if (chaosState.errorRate > 0 && Math.random() < chaosState.errorRate) {
      reply.status(500).send({
        error: 'Chaos Engineering Injected Failure',
        message: 'Simulated 500 Internal Server Error for demo',
        statusCode: 500,
      });
      return reply;
    }
  });

  // Register Routes
  await app.register(healthRoutes);
  await app.register(metaRoutes);
  await app.register(votesRoutes);
  await app.register(guestbookRoutes);
  await app.register(chaosRoutes);

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
