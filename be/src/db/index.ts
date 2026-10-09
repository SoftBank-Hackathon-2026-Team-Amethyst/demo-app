import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://demo:demo@localhost:5432/demo';

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
    sqlClient = postgres(connectionString, {
      max: 5,
      connect_timeout: 2, // 2s timeout
      idle_timeout: 10,
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

export async function checkDbHealth(): Promise<boolean> {
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
