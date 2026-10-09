import { FastifyInstance } from 'fastify';
import os from 'node:os';
import { checkDbHealth } from '../db/index.js';

export async function metaRoutes(app: FastifyInstance) {
  app.get('/api/info', async () => {
    const version = process.env.APP_VERSION || 'v1.0.0';
    const isV2 = version.startsWith('v2');
    const isDbConnected = await checkDbHealth();

    return {
      version,
      themeColor: isV2 ? '#10B981' : '#3B82F6', // Green for v2, Blue for v1
      themeName: isV2 ? 'Emerald Green (v2)' : 'Classic Blue (v1)',
      env: process.env.NODE_ENV || 'production',
      uptime: Math.floor(process.uptime()),
      hostname: process.env.HOSTNAME || process.env.POD_NAME || os.hostname(),
      region: process.env.REGION || 'ap-northeast-2',
      dbConnected: isDbConnected,
      timestamp: new Date().toISOString()
    };
  });
}
