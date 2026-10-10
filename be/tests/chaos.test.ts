import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { chaosEnabledFromEnv, chaosRoutes, chaosState } from '../src/routes/chaos.js';

test('CHAOS_ENABLED 값 해석', () => {
  assert.equal(chaosEnabledFromEnv({}), false);
  assert.equal(chaosEnabledFromEnv({ CHAOS_ENABLED: 'false' }), false);
  assert.equal(chaosEnabledFromEnv({ CHAOS_ENABLED: 'true' }), true);
  assert.equal(chaosEnabledFromEnv({ CHAOS_ENABLED: '1' }), true);
});

test('게이트가 꺼지면 조회만 되고 변경 라우트는 없다', async () => {
  const app = Fastify();
  await app.register(chaosRoutes, { enabled: false });
  const get = await app.inject({ method: 'GET', url: '/api/chaos' });
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().enabled, false);
  const post = await app.inject({ method: 'POST', url: '/api/chaos', payload: { errorRate: 1 } });
  assert.equal(post.statusCode, 404);
  const reset = await app.inject({ method: 'POST', url: '/api/chaos/reset' });
  assert.equal(reset.statusCode, 404);
  assert.equal(chaosState.errorRate, 0);
  await app.close();
});

test('게이트가 켜지면 변경 · 초기화가 된다', async () => {
  const app = Fastify();
  await app.register(chaosRoutes, { enabled: true });
  const post = await app.inject({ method: 'POST', url: '/api/chaos', payload: { errorRate: 1, latencyMs: -5 } });
  assert.equal(post.statusCode, 200);
  assert.equal(chaosState.errorRate, 1);
  assert.equal(chaosState.latencyMs, 0);
  const reset = await app.inject({ method: 'POST', url: '/api/chaos/reset' });
  assert.equal(reset.statusCode, 200);
  assert.deepEqual(reset.json(), { latencyMs: 0, errorRate: 0, dbError: false, enabled: true });
  await app.close();
});
