import { FastifyInstance } from 'fastify';
import os from 'node:os';

// 파드 1개 기준의 인메모리 메트릭. 파드가 여러 개면 응답한 파드의 값이 내려간다.
const WINDOW_SEC = 60;
const buckets = new Map<number, number>(); // epoch sec -> 요청 수
const durations: { t: number; ms: number }[] = []; // 최근 응답 시간

let lastCpu = process.cpuUsage();
let lastCpuAt = process.hrtime.bigint();
let cpuPercent = 0;

function sampleCpu() {
  const now = process.hrtime.bigint();
  const usage = process.cpuUsage(lastCpu);
  const elapsedUs = Number(now - lastCpuAt) / 1000;
  if (elapsedUs > 0) {
    // Process CPU includes worker threads and may exceed one fully used core.
    cpuPercent = ((usage.user + usage.system) / elapsedUs) * 100;
  }
  lastCpu = process.cpuUsage();
  lastCpuAt = now;
}

function prune(nowSec: number) {
  for (const k of buckets.keys()) if (k < nowSec - WINDOW_SEC) buckets.delete(k);
  while (durations.length && durations[0].t < nowSec - WINDOW_SEC) durations.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

// 루트 인스턴스에 직접 등록해야 모든 라우트의 응답이 집계된다 (플러그인 캡슐화 회피)
export function registerMetrics(app: FastifyInstance) {
  const timer = setInterval(sampleCpu, 1000);
  timer.unref();

  app.addHook('onResponse', async (req, reply) => {
    // 대시보드 폴링과 Prometheus 수집 요청 자체는 제외한다.
    if (req.url.startsWith('/api/metrics') || req.url.split('?')[0] === '/metrics') return;
    const nowSec = Math.floor(Date.now() / 1000);
    buckets.set(nowSec, (buckets.get(nowSec) || 0) + 1);
    durations.push({ t: nowSec, ms: reply.elapsedTime });
  });

  app.get('/api/metrics', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    prune(nowSec);

    // 최근 30초 초당 요청 수 (현재 진행 중인 초 제외)
    const series: number[] = [];
    for (let s = nowSec - 30; s < nowSec; s++) series.push(buckets.get(s) || 0);

    const sorted = durations.map((d) => d.ms).sort((a, b) => a - b);
    const mem = process.memoryUsage();

    return {
      hostname: process.env.HOSTNAME || process.env.POD_NAME || os.hostname(),
      rps: series.slice(-5).reduce((a, b) => a + b, 0) / 5,
      rpsSeries: series,
      totalRequests: [...buckets.values()].reduce((a, b) => a + b, 0),
      p50: Math.round(percentile(sorted, 0.5) * 10) / 10,
      p95: Math.round(percentile(sorted, 0.95) * 10) / 10,
      cpuPercent: Math.max(0.01, Math.ceil(cpuPercent * 100) / 100),
      memoryMb: Math.round(mem.rss / 1024 / 1024),
      load1: Math.round(os.loadavg()[0] * 100) / 100,
      endSec: nowSec - 1,
      timestamp: new Date().toISOString()
    };
  });
}
