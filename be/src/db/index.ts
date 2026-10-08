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
  voteLogs: new Map<string, number>(), // voterId -> optionId
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

export async function checkDbHealth(): Promise<boolean> {
  if (!sqlClient) return false;
  try {
    await sqlClient`SELECT 1`;
    isDbConnected = true;
    return true;
  } catch {
    isDbConnected = false;
    return false;
  }
}
