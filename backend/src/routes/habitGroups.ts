import { Static, Type } from '@sinclair/typebox';
import { and, asc, eq } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { habitGroups, users } from '../db/schema.js';
import { AppError, notFound } from '../lib/errors.js';
import { sendData } from '../lib/response.js';

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
const HexColor = Type.String({ pattern: '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$' });
const GroupBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  color: Type.Optional(HexColor),
  icon: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
});
const UpdateGroupBody = Type.Partial(GroupBody, { minProperties: 1 });

async function requirePremium(userId: string) {
  const [user] = await db.select({ isPremium: users.isPremium }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPremium) throw new AppError(403, 'PREMIUM_REQUIRED', 'Los grupos de hábitos son una función Premium.');
}

async function ownedGroup(id: string, userId: string) {
  const [group] = await db.select().from(habitGroups).where(and(eq(habitGroups.id, id), eq(habitGroups.userId, userId))).limit(1);
  if (!group) throw notFound('Grupo de hábitos');
  return group;
}

export const habitGroupRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', async (request) => requirePremium(request.user.sub));

  app.get('/habit-groups', {
    schema: { tags: ['Habit groups'], summary: 'Listar grupos Premium de hábitos', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const items = await db.select().from(habitGroups).where(eq(habitGroups.userId, request.user.sub)).orderBy(asc(habitGroups.name));
    return sendData(reply, items);
  });

  app.post<{ Body: Static<typeof GroupBody> }>('/habit-groups', {
    schema: { tags: ['Habit groups'], summary: 'Crear grupo Premium de hábitos', security: [{ bearerAuth: [] }], body: GroupBody },
  }, async (request, reply) => {
    const [group] = await db.insert(habitGroups).values({ userId: request.user.sub, ...request.body }).returning();
    return sendData(reply, group, 201);
  });

  app.patch<{ Params: Static<typeof IdParams>; Body: Static<typeof UpdateGroupBody> }>('/habit-groups/:id', {
    schema: { tags: ['Habit groups'], summary: 'Actualizar grupo Premium de hábitos', security: [{ bearerAuth: [] }], params: IdParams, body: UpdateGroupBody },
  }, async (request, reply) => {
    await ownedGroup(request.params.id, request.user.sub);
    const [group] = await db.update(habitGroups).set({ ...request.body, updatedAt: new Date() }).where(eq(habitGroups.id, request.params.id)).returning();
    return sendData(reply, group);
  });

  app.delete<{ Params: Static<typeof IdParams> }>('/habit-groups/:id', {
    schema: { tags: ['Habit groups'], summary: 'Eliminar grupo Premium de hábitos', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await ownedGroup(request.params.id, request.user.sub);
    await db.delete(habitGroups).where(eq(habitGroups.id, request.params.id));
    return reply.code(204).send();
  });
};
