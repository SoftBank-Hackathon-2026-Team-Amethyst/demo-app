import { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb, memoryFallback } from '../db/index.js';
import { votes } from '../db/schema.js';

// 1인 1투표 제한은 프론트엔드 localStorage에서 처리한다 (로그인 없는 데모 특성상 UX 수준 제한).
export async function votesRoutes(app: FastifyInstance) {
  // GET /api/votes
  app.get('/api/votes', async () => {
    const { db, isDbConnected } = getDb();

    const items = isDbConnected && db
      ? await db.select().from(votes).orderBy(votes.id)
      : memoryFallback.votes;

    const totalVotes = items.reduce((acc, item) => acc + item.count, 0);
    const results = items.map(item => ({
      ...item,
      percentage: totalVotes > 0 ? Math.round((item.count / totalVotes) * 100) : 0
    }));

    return { totalVotes, items: results };
  });

  // POST /api/votes/:id
  app.post<{ Params: { id: string } }>('/api/votes/:id', async (request, reply) => {
    const optionId = parseInt(request.params.id, 10);
    if (isNaN(optionId)) {
      return reply.code(400).send({ error: '유효하지 않은 투표 항목입니다.' });
    }

    const { db, isDbConnected } = getDb();

    if (isDbConnected && db) {
      const updated = await db
        .update(votes)
        .set({ count: sql`${votes.count} + 1`, updatedAt: new Date() })
        .where(eq(votes.id, optionId))
        .returning();

      if (!updated.length) {
        return reply.code(404).send({ error: '해당 투표 항목을 찾을 수 없습니다.' });
      }
      return { success: true, updated: updated[0] };
    }

    const target = memoryFallback.votes.find(v => v.id === optionId);
    if (!target) {
      return reply.code(404).send({ error: '해당 투표 항목을 찾을 수 없습니다.' });
    }
    target.count += 1;
    target.updatedAt = new Date();
    return { success: true, updated: target };
  });
}
