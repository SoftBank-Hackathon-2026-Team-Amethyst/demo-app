import { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import { getDb, memoryFallback } from '../db/index.js';
import { guestbook } from '../db/schema.js';

interface CreateGuestbookBody {
  name: string;
  message: string;
}

export async function guestbookRoutes(app: FastifyInstance) {
  // GET /api/guestbook
  app.get('/api/guestbook', async () => {
    const { db, isDbConnected } = getDb();

    if (isDbConnected && db) {
      const entries = await db
        .select()
        .from(guestbook)
        .orderBy(desc(guestbook.createdAt))
        .limit(50);
      return { entries };
    } else {
      const entries = [...memoryFallback.guestbook].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return { entries };
    }
  });

  // POST /api/guestbook
  app.post<{ Body: CreateGuestbookBody }>('/api/guestbook', async (request, reply) => {
    const { name, message } = request.body || {};

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Name is required' });
    }
    if (!message || !message.trim()) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    const trimmedName = name.trim().slice(0, 50);
    const trimmedMessage = message.trim().slice(0, 500);

    const { db, isDbConnected } = getDb();

    if (isDbConnected && db) {
      const inserted = await db
        .insert(guestbook)
        .values({
          name: trimmedName,
          message: trimmedMessage,
          createdAt: new Date()
        })
        .returning();

      return { success: true, entry: inserted[0] };
    } else {
      const newEntry = {
        id: memoryFallback.guestbook.length + 1,
        name: trimmedName,
        message: trimmedMessage,
        createdAt: new Date()
      };
      memoryFallback.guestbook.unshift(newEntry);
      return { success: true, entry: newEntry };
    }
  });
}
