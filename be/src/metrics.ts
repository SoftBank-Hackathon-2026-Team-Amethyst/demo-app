import type { FastifyInstance } from 'fastify';
import { Counter, Histogram, Registry } from '@prometheus-io/client';

// Same metric names and buckets as the FE access-log exporter. Identity labels
// (cluster, environment, service, pod) are attached by the platform scraper.
export function registerMetrics(app: FastifyInstance) {
  const registry = new Registry();
  const requests = new Counter({
    name: 'app_http_response_count_total', help: 'Completed application HTTP requests',
    labelNames: ['method', 'status'], registers: [registry],
  });
  const duration = new Histogram({
    name: 'app_http_response_time_seconds_hist', help: 'Application HTTP response time in seconds',
    labelNames: ['method', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], registers: [registry],
  });
  app.addHook('onResponse', async (request, reply) => {
    const path = request.url.split('?')[0];
    const agent = request.headers['user-agent'] || '';
    if (path === '/metrics' || path === '/health' || path.startsWith('/healthz/') ||
        /^(kube-probe|ELB-HealthChecker|GoogleHC)\//.test(agent) || agent === 'one-tatchi-smoke') return;
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)
      ? request.method : 'OTHER';
    const labels = { method, status: String(reply.statusCode) };
    requests.inc(labels);
    duration.observe(labels, reply.elapsedTime / 1000);
  });
  app.get('/metrics', async (_request, reply) => {
    return reply.type(registry.contentType).send(await registry.metrics());
  });
  return registry;
}
