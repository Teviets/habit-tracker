import { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';

import { db } from '../db/client.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', {
    schema: { tags: ['System'], summary: 'Estado del servicio' },
  }, async (_request, reply) => {
    await db.execute(sql`select 1`);
    return reply.send({ data: { status: 'ok', timestamp: new Date().toISOString() } });
  });
};
