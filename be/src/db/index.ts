import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://demo:demo@localhost:5432/demo';

// 클라우드 DB(RDS · Cloud SQL)는 TLS 없는 접속을 거부한다. 배포 값 파일의 PGSSL(require | prefer | verify-full …)을
// postgres.js의 ssl 옵션으로 넘긴다. postgres.js는 PGSSL 환경변수를 스스로 읽지 않는다. 비우거나 disable이면 TLS 없이 붙는다.
export type SslOption = 'require' | 'allow' | 'prefer' | 'verify-full' | undefined;
export function sslOption(env: NodeJS.ProcessEnv = process.env): SslOption {
  const mode = (env.PGSSL || env.PGSSLMODE || '').trim().toLowerCase();
  if (mode === '' || mode === 'disable' || mode === 'false' || mode === '0') return undefined;
  if (mode === 'allow' || mode === 'prefer' || mode === 'verify-full') return mode;
  return 'require'; // require · true · 1 · 그 밖의 값
}

let sqlClient: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;
let isDbConnected = false;

// In-memory fallback data for guaranteed demo resilience
export const memoryFallback = {
  votes: [
    { id: 1, optionKey: 'rolling', title: '무중단 롤링 배포 (Rolling Update)', count: 5, updatedAt: new Date() },
    { id: 2, optionKey: 'blue_green', title: '블루-그린 배포 (Blue/Green)', count: 8, updatedAt: new Date() },
    { id: 3, optionKey: 'canary', title: '카나리 배포 (Canary Deployment)', count: 12, updatedAt: new Date() }
  ],
  guestbook: [
    { id: 1, name: '시스템 안내', message: 'DB 연결 준비 중입니다 (메모리 모드 동작 중)', createdAt: new Date() }
  ]
};

export async function initDb() {
  try {
    const ssl = sslOption();
    sqlClient = postgres(connectionString, {
      max: 5,
      connect_timeout: 2, // 2s timeout
      idle_timeout: 10,
      ...(ssl ? { ssl } : {}),
    });

    // Check connection with a simple query
    await sqlClient`SELECT 1`;
    db = drizzle(sqlClient, { schema });
    isDbConnected = true;
    console.log('[DB] Successfully connected to PostgreSQL database.');
  } catch (err) {
    isDbConnected = false;
    console.warn('[DB] Could not connect to PostgreSQL. Operating in in-memory fallback mode.', (err as Error).message);
  }
}

export function getDb() {
  return { db, isDbConnected };
}

// /api/info가 1초마다 호출되므로 DB 상태는 짧게 캐시하고, 응답이 느리면 실패로 처리한다
const HEALTH_TTL_MS = 3000;
const HEALTH_TIMEOUT_MS = 1000;
let healthCache: { ok: boolean; at: number } | null = null;
let healthInflight: Promise<boolean> | null = null;

import { chaosState } from '../routes/chaos.js';

// ignoreChaos: readiness(/health)처럼 실제 DB 상태만 볼 때 true. 데이터 라우트는 장애 주입(chaos.dbError)을 따른다.
export async function checkDbHealth(opts: { ignoreChaos?: boolean } = {}): Promise<boolean> {
  if (!opts.ignoreChaos && chaosState.dbError) {
    isDbConnected = false;
    return false;
  }
  if (!sqlClient) return false;
  if (healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.ok;
  if (healthInflight) return healthInflight;

  const client = sqlClient;
  healthInflight = (async () => {
    let ok = false;
    try {
      await Promise.race([
        client`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('db health timeout')), HEALTH_TIMEOUT_MS)),
      ]);
      ok = true;
      // 기동 때 실패했다가 DB가 살아난 경우에도 실제 저장 경로가 DB를 쓰게 한다.
      if (!db) db = drizzle(client, { schema });
    } catch {
      ok = false;
    }
    isDbConnected = ok;
    healthCache = { ok, at: Date.now() };
    healthInflight = null;
    return ok;
  })();
  return healthInflight;
}
