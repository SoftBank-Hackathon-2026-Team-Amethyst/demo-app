import { FastifyInstance } from 'fastify';
import { checkDbHealth } from '../db/index.js';
import { chaosState } from './chaos.js';

export async function healthRoutes(app: FastifyInstance) {
  // Readiness. 실제 DB에 닿지 않으면(메모리 폴백) 503을 돌려 승격 smoke · k8s가 장애를 본다.
  // 장애 주입(chaos.dbError)은 시연용 시뮬레이션이라 readiness를 떨어뜨리지 않고 본문에만 표시한다.
  app.get('/health', async (request, reply) => {
    const dbOk = await checkDbHealth({ ignoreChaos: true });
    const body = {
      status: dbOk ? 'ok' : 'degraded',
      service: 'demo-app-be',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'fallback-memory',
      chaosDbError: chaosState.dbError,
    };
    if (!dbOk) {
      reply.code(503);
    }
    return body;
  });

  // Liveness Check (Kubernetes / Pod orchestrator)
  app.get('/healthz/liveness', async (request, reply) => {
    return { status: 'alive' };
  });
}
