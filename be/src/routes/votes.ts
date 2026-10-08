import { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb, memoryFallback } from '../db/index.js';
import { votes } from '../db/schema.js';

export async function votesRoutes(app: FastifyInstance) {
  // GET /api/votes
  app.get('/api/votes', async () => {
    const { db, isDbConnected } = getDb();

    let items;
    if (isDbConnected && db) {
      items = await db.select().from(votes).orderBy(votes.id);
    } else {
      items = memoryFallback.votes;
    }

    const totalVotes = items.reduce((acc, item) => acc + item.count, 0);
    const results = items.map(item => ({
      ...item,
      percentage: totalVotes > 0 ? Math.round((item.count / totalVotes) * 100) : 0
    }));

    return {
      totalVotes,
      items: results
    };
  });

  // POST /api/votes/:id
  app.post<{ Params: { id: string } }>('/api/votes/:id', async (request, reply) => {
    const optionId = parseInt(request.params.id, 10);
    if (isNaN(optionId)) {
      return reply.code(400).send({ error: 'Invalid vote option ID' });
    }

    const { db, isDbConnected } = getDb();

    if (isDbConnected && db) {
      const updated = await db
        .update(votes)
        .set({
          count: sql`${votes.count} + 1`,
          updatedAt: new Date()
        })
        .where(eq(votes.id, optionId))
        .returning();

      if (!updated.length) {
        return reply.code(404).send({ error: 'Option not found' });
      }
      return { success: true, updated: updated[0] };
    } else {
      const target = memoryFallback.votes.find(v => v.id === optionId);
      if (!target) {
        return reply.code(404).send({ error: 'Option not found' });
      }
      target.count += 1;
      target.updatedAt = new Date();
      return { success: true, updated: target };
    }
  });
}
