import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { CpuPool, LoadError } from '../src/load/cpu-pool.js';
import { loadEnabledFromEnv, loadRoutes } from '../src/routes/load.js';

test('CPU load defaults off and can be enabled in production through the flag', () => {
  assert.equal(loadEnabledFromEnv({}), false);
  assert.equal(loadEnabledFromEnv({ NODE_ENV: 'production', LOAD_TEST_ENABLED: 'false' }), false);
  assert.equal(loadEnabledFromEnv({ NODE_ENV: 'production', LOAD_TEST_ENABLED: ' TRUE ' }), true);
  assert.equal(loadEnabledFromEnv({ LOAD_TEST_ENABLED: '1' }), true);
});

test('disabled CPU load publishes capabilities but does not register the work endpoint', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  await app.register(loadRoutes, { enabled: false });
  const config = await app.inject('/api/load/config');
  assert.equal(config.json().enabled, false);
  const response = await app.inject({ method: 'POST', url: '/api/load/cpu', payload: { intensity: 'heavy' } });
  assert.equal(response.statusCode, 404);
});

test('CPU work runs in a reusable worker and accepts only bounded presets', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  await app.register(loadRoutes, { enabled: true });
  assert.equal((await app.inject('/api/load/config')).json().enabled, true);
  for (const payload of [{}, { intensity: 'infinite' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/load/cpu', payload })).statusCode, 400);
  }
  // Fastify strips extra properties; clients cannot override the preset's work budget.
  const extra = await app.inject({ method: 'POST', url: '/api/load/cpu', payload: { intensity: 'light', iterations: 1e12 } });
  assert.equal(extra.statusCode, 200, extra.body);
  const checksum = extra.json().checksum;
  for (let i = 0; i < 2; i++) {
    const response = await app.inject({ method: 'POST', url: '/api/load/cpu', payload: { intensity: 'light' } });
    assert.equal(response.statusCode, 200, response.body);
    assert.match(response.json().checksum, /^[a-f0-9]{64}$/);
    assert.equal(response.json().checksum, checksum);
    assert.ok(response.json().elapsedMs > 0);
    assert.ok(response.json().hostname);
  }
});

test('queue bounds reject overload while the main event loop remains responsive', async (t) => {
  const pool = new CpuPool(1);
  t.after(() => pool.close());
  let completed = false;
  const first = pool.run(30000).then((result) => { completed = true; return result; });
  await assert.rejects(pool.run(30000), (error: LoadError) => error.statusCode === 429);
  let ticked = false;
  await new Promise<void>((resolve) => setImmediate(() => { ticked = true; resolve(); }));
  assert.equal(ticked, true);
  assert.equal(completed, false, 'main thread progresses before the CPU task completes');
  assert.ok((await first).elapsedMs > 0);
});

test('closing the pool cancels pending work and rejects new requests', async () => {
  const pool = new CpuPool();
  const pending = [pool.run(30000), pool.run(30000)];
  const result = Promise.allSettled(pending);
  await pool.close();
  assert.ok((await result).every((entry) => entry.status === 'rejected'));
  await assert.rejects(pool.run(1), (error: LoadError) => error.statusCode === 503);
});

test('a worker deadline terminates CPU work and subsequent requests recover', async (t) => {
  const pool = new CpuPool(8, 1000);
  t.after(() => pool.close());
  await assert.rejects(pool.run(100000000), (error: LoadError) => error.statusCode === 503);
  const recovered = await pool.run(5000);
  assert.ok(recovered.elapsedMs > 0);
});
