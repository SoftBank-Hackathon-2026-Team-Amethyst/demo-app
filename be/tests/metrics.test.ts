import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { registerMetrics } from '../src/metrics.js';

test('real requests are counted; probes and metric scrapes are excluded', async () => {
  const app = Fastify();
  const registry = registerMetrics(app);
  app.get('/ok', async () => ({ ok: true }));
  app.get('/broken', async (_request, reply) => reply.code(500).send({ error: true }));
  app.get('/health', async () => ({ ok: true }));
  try {
    await app.inject('/ok');
    await app.inject('/broken');
    await app.inject('/health');
    await app.inject('/metrics');
    await app.inject({ url: '/ok', headers: { 'user-agent': 'one-tatchi-smoke' } });
    await app.inject({ url: '/ok', headers: { 'user-agent': 'kube-probe/1.35' } });
    await app.inject('/not-found/secret-id?token=secret');
    const text = await registry.metrics();
    assert.match(text, /app_http_response_count_total\{method="GET",status="200"\} 1/);
    assert.match(text, /app_http_response_count_total\{method="GET",status="500"\} 1/);
    assert.match(text, /app_http_response_count_total\{method="GET",status="404"\} 1/);
    assert.match(text, /app_http_response_time_seconds_hist_bucket/);
    assert.doesNotMatch(text, /secret-id|token=secret|one-tatchi-smoke/);
  } finally {
    await app.close();
  }
});
