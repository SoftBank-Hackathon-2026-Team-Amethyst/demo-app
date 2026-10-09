import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('dashboard and Prometheus work together while chaos affects application requests', { timeout: 20000 }, async (t) => {
  const root = process.cwd();
  const loader = createRequire(join(root, 'package.json')).resolve('tsx');
  // Load no developer .env and connect only to an unused local DB port.
  const cwd = await mkdtemp(join(tmpdir(), 't17-observability-'));
  const child = spawn(process.execPath, ['--import', loader, join(root, 'src/index.ts')], {
    cwd,
    env: {
      PATH: process.env.PATH,
      HOST: '127.0.0.1', PORT: '0', LOG_LEVEL: 'info',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
    }
    await rm(cwd, { recursive: true, force: true });
  });
  let output = '';
  const base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 10000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error(`Server exited: ${output}`)); });
    child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-4000); });
    child.stdout.on('data', (chunk) => {
      output = (output + chunk).slice(-4000);
      const match = output.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  async function get(path: string) {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200, path);
    return response;
  }
  async function chaos(path: string, body: object) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(3000),
    });
    assert.equal(response.status, 200);
    await response.json();
  }

  await (await get('/api/info')).json();
  const before = await (await get('/api/metrics')).json();
  assert.ok(before.hostname);
  await (await get('/metrics')).text();
  await (await get('/metrics?probe=1')).text();
  const after = await (await get('/api/metrics')).json();
  assert.equal(after.totalRequests, before.totalRequests, 'Prometheus scrapes must not inflate dashboard traffic');

  await chaos('/api/chaos', { errorRate: 1 });
  const failure = await fetch(`${base}/api/info`, { signal: AbortSignal.timeout(3000) });
  assert.equal(failure.status, 500);
  await failure.json();
  const metrics = await (await get('/metrics')).text();
  assert.match(metrics, /app_http_response_count_total\{method="GET",status="500"\} 1/);
  await (await get('/api/metrics')).json();

  await chaos('/api/chaos', { latencyMs: 10000 });
  await (await get('/metrics')).text();
  await (await get('/api/metrics')).json();
  await chaos('/api/chaos/reset', {});
  await (await get('/api/info')).json();
});
