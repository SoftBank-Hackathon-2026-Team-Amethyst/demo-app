import { FastifyInstance } from 'fastify';

// 장애 주입 상태 (인메모리 싱글톤). 파드마다 따로 있다.
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

// 장애 주입 변경(POST)은 인증이 없는 시연 기능이라, 환경변수 CHAOS_ENABLED=true일 때만 라우트를 등록한다.
// 시연이 끝나면 값 파일(deploy/values-be.yaml)에서 끈다. 조회(GET)는 항상 열어 두어 승격 smoke가 상태를 확인한다.
export function chaosEnabledFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(true|1|yes|on)$/i.test((env.CHAOS_ENABLED || '').trim());
}

export interface ChaosRoutesOptions {
  enabled?: boolean;
}

export async function chaosRoutes(app: FastifyInstance, opts: ChaosRoutesOptions = {}) {
  const enabled = opts.enabled ?? chaosEnabledFromEnv();

  // 현재 장애 상태 조회
  app.get('/api/chaos', async () => {
    return { ...chaosState, enabled };
  });

  if (!enabled) {
    app.log.info('[CHAOS] CHAOS_ENABLED is not true. Fault injection endpoints are disabled.');
    return;
  }

  // 장애 상태 업데이트
  app.post<{ Body: Partial<ChaosState> }>('/api/chaos', async (req) => {
    const { latencyMs, errorRate, dbError } = req.body || {};
    if (typeof latencyMs === 'number') chaosState.latencyMs = Math.max(0, latencyMs);
    if (typeof errorRate === 'number') chaosState.errorRate = Math.min(1, Math.max(0, errorRate));
    if (typeof dbError === 'boolean') chaosState.dbError = dbError;
    return { ...chaosState, enabled };
  });

  // 장애 상태 초기화 (원클릭 정상화)
  app.post('/api/chaos/reset', async () => {
    chaosState.latencyMs = 0;
    chaosState.errorRate = 0;
    chaosState.dbError = false;
    return { ...chaosState, enabled };
  });
}
