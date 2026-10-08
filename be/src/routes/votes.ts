import { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { getDb, memoryFallback } from '../db/index.js';
import { votes, voteLogs } from '../db/schema.js';

interface VoteQuery {
  voterId?: string;
}

interface VoteBody {
  voterId?: string;
}

export async function votesRoutes(app: FastifyInstance) {
  // GET /api/votes?voterId=xxx
  app.get<{ Querystring: VoteQuery }>('/api/votes', async (request) => {
    const voterId = request.query.voterId;
    const { db, isDbConnected } = getDb();

    let items;
    let myVotedOptionId: number | null = null;

    if (isDbConnected && db) {
      items = await db.select().from(votes).orderBy(votes.id);

      if (voterId) {
        const userLog = await db
          .select()
          .from(voteLogs)
          .where(eq(voteLogs.voterId, voterId))
          .limit(1);

        if (userLog.length > 0 && userLog[0].optionId) {
          myVotedOptionId = userLog[0].optionId;
        }
      }
    } else {
      items = memoryFallback.votes;
      if (voterId && memoryFallback.voteLogs.has(voterId)) {
        myVotedOptionId = memoryFallback.voteLogs.get(voterId) || null;
      }
    }

    const totalVotes = items.reduce((acc, item) => acc + item.count, 0);
    const results = items.map(item => ({
      ...item,
      percentage: totalVotes > 0 ? Math.round((item.count / totalVotes) * 100) : 0
    }));

    return {
      totalVotes,
      myVotedOptionId,
      items: results
    };
  });

  // POST /api/votes/:id
  app.post<{ Params: { id: string }; Body: VoteBody }>('/api/votes/:id', async (request, reply) => {
    const optionId = parseInt(request.params.id, 10);
    if (isNaN(optionId)) {
      return reply.code(400).send({ error: '유효하지 않은 투표 항목입니다.' });
    }

    const voterId = request.body?.voterId || request.headers['x-voter-id'] as string;
    if (!voterId) {
      return reply.code(400).send({ error: 'voterId 식별자가 필요합니다.' });
    }

    const { db, isDbConnected } = getDb();

    if (isDbConnected && db) {
      // 1. 이미 투표했는지 중복 확인 (서버 레벨 검증)
      const existing = await db
        .select()
        .from(voteLogs)
        .where(eq(voteLogs.voterId, voterId))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: '이미 투표에 참여하셨습니다. (1인 1투표 제한)',
          alreadyVoted: true,
          votedOptionId: existing[0].optionId
        });
      }

      // 2. 투표 로그 기록 및 카운트 증가
      try {
        await db.insert(voteLogs).values({
          voterId,
          optionId,
          createdAt: new Date()
        });

        const updated = await db
          .update(votes)
          .set({
            count: sql`${votes.count} + 1`,
            updatedAt: new Date()
          })
          .where(eq(votes.id, optionId))
          .returning();

        if (!updated.length) {
          return reply.code(404).send({ error: '해당 투표 항목을 찾을 수 없습니다.' });
        }

        return { success: true, updated: updated[0], votedOptionId: optionId };
      } catch (err: any) {
        // Unique 제약 위반 발생 시 (동시 요청 방어)
        if (err.code === '23505') {
          return reply.code(409).send({
            error: '이미 투표에 참여하셨습니다.',
            alreadyVoted: true
          });
        }
        throw err;
      }
    } else {
      // Fallback 메모리 모드
      if (memoryFallback.voteLogs.has(voterId)) {
        return reply.code(409).send({
          error: '이미 투표에 참여하셨습니다. (1인 1투표 제한)',
          alreadyVoted: true,
          votedOptionId: memoryFallback.voteLogs.get(voterId)
        });
      }

      const target = memoryFallback.votes.find(v => v.id === optionId);
      if (!target) {
        return reply.code(404).send({ error: '해당 투표 항목을 찾을 수 없습니다.' });
      }

      target.count += 1;
      target.updatedAt = new Date();
      memoryFallback.voteLogs.set(voterId, optionId);

      return { success: true, updated: target, votedOptionId: optionId };
    }
  });
}
