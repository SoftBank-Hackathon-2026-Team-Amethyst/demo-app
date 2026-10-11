import type { FastifyInstance } from 'fastify';
import { hostname } from 'node:os';
import { CpuPool } from '../load/cpu-pool.js';

export const CPU_WORK = { light: 5000, medium: 15000, heavy: 30000 } as const;

export function loadEnabledFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(true|1|yes|on)$/i.test((env.LOAD_TEST_ENABLED || '').trim());
}

export async function loadRoutes(app: FastifyInstance, opts: { enabled?: boolean } = {}) {
  // Deliberately independent of NODE_ENV: prod can opt in through the same flag.
  const enabled = opts.enabled ?? loadEnabledFromEnv();
  app.get('/api/load/config', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { enabled, intensities: Object.keys(CPU_WORK), maxRps: 20, maxDurationSec: 300 };
  });
  if (!enabled) return;

  const pool = new CpuPool();
  app.addHook('onClose', async () => { await pool.close(); });
  app.post<{ Body: { intensity: keyof typeof CPU_WORK } }>('/api/load/cpu', {
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['intensity'],
        properties: { intensity: { type: 'string', enum: Object.keys(CPU_WORK) } },
      },
    },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const result = await pool.run(CPU_WORK[request.body.intensity]);
    return { hostname: process.env.HOSTNAME || hostname(), intensity: request.body.intensity, ...result };
  });
}
