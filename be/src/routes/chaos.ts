import { FastifyInstance } from 'fastify';

// 장애 주입 상태 (인메모리 싱글톤)
export interface ChaosState {
  latencyMs: number;
  errorRate: number; // 0.0 ~ 1.0
  dbError: boolean;
}

export const chaosState: ChaosState = {
  latencyMs: 0,
  errorRate: 0,
  dbError: false,
};

export async function chaosRoutes(app: FastifyInstance) {
  // 현재 장애 상태 조회
  app.get('/api/chaos', async () => {
    return chaosState;
  });

  // 장애 상태 업데이트
  app.post<{ Body: Partial<ChaosState> }>('/api/chaos', async (req) => {
    const { latencyMs, errorRate, dbError } = req.body || {};
    if (typeof latencyMs === 'number') chaosState.latencyMs = Math.max(0, latencyMs);
    if (typeof errorRate === 'number') chaosState.errorRate = Math.min(1, Math.max(0, errorRate));
    if (typeof dbError === 'boolean') chaosState.dbError = dbError;
    return chaosState;
  });

  // 장애 상태 초기화 (원클릭 정상화)
  app.post('/api/chaos/reset', async () => {
    chaosState.latencyMs = 0;
    chaosState.errorRate = 0;
    chaosState.dbError = false;
    return chaosState;
  });
}
