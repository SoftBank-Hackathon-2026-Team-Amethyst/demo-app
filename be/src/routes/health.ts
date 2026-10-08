import { FastifyInstance } from 'fastify';
import { checkDbHealth } from '../db/index.js';

export async function healthRoutes(app: FastifyInstance) {
  // Overall Health Check
  app.get('/health', async (request, reply) => {
    const dbOk = await checkDbHealth();
    return {
      status: 'ok',
      service: 'demo-app-be',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'fallback-memory',
    };
  });

  // Liveness Check (Kubernetes / Pod orchestrator)
  app.get('/healthz/liveness', async (request, reply) => {
    return { status: 'alive' };
  });
}
