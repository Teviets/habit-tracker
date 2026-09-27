import { Static, Type } from '@sinclair/typebox';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { habitEntries, habitGroups, habits, posts, users } from '../db/schema.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseLimit, sendData } from '../lib/response.js';
import { recalculateHabitStreak } from '../services/streaks.js';

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
const HexColor = Type.String({ pattern: '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$' });
const HabitUnit = Type.Union([
  Type.Literal('veces'), Type.Literal('cantidad'), Type.Literal('completado'), Type.Literal('cronometro'),
  Type.Literal('minutos'), Type.Literal('horas'), Type.Literal('pasos'), Type.Literal('vasos'),
  Type.Literal('paginas'), Type.Literal('kilometros'), Type.Literal('calorias'),
]);
const HabitFields = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  icon: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
  color: Type.Optional(HexColor),
  frequency: Type.Optional(Type.Union([Type.Literal('daily'), Type.Literal('weekly'), Type.Literal('custom')])),
  daysOfWeek: Type.Optional(Type.Array(Type.Integer({ minimum: 1, maximum: 7 }), { minItems: 1, maxItems: 7, uniqueItems: true })),
  targetCount: Type.Optional(Type.Integer({ minimum: 1, maximum: 100000 })),
  unit: Type.Optional(HabitUnit),
  reminderTime: Type.Optional(Type.Union([Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$' }), Type.Null()])),
  startDate: Type.Optional(Type.String({ format: 'date' })),
  privacy: Type.Optional(Type.Union([Type.Literal('private'), Type.Literal('group'), Type.Literal('public')])),
  habitGroupId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
});
const CreateHabitBody = HabitFields;
const UpdateHabitBody = Type.Partial(Type.Composite([HabitFields, Type.Object({
  status: Type.Union([Type.Literal('active'), Type.Literal('paused'), Type.Literal('archived')]),
})]), { minProperties: 1 });
const CheckInBody = Type.Object({
  occurredOn: Type.String({ format: 'date' }),
  value: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000000 })),
  completed: Type.Optional(Type.Boolean()),
  note: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
});

async function ownedHabit(id: string, userId: string) {
  const [habit] = await db.select().from(habits).where(and(eq(habits.id, id), eq(habits.userId, userId))).limit(1);
  if (!habit) throw notFound('Hábito');
  return habit;
}

async function ensureOwnedPremiumGroup(groupId: string, userId: string) {
  const [user] = await db.select({ isPremium: users.isPremium }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isPremium) throw new AppError(403, 'PREMIUM_REQUIRED', 'Los grupos de hábitos son una función Premium.');
  const [group] = await db.select({ id: habitGroups.id }).from(habitGroups).where(and(
    eq(habitGroups.id, groupId),
    eq(habitGroups.userId, userId),
  )).limit(1);
  if (!group) throw notFound('Grupo de hábitos');
}

export const habitRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get<{ Querystring: { status?: 'active' | 'paused' | 'archived' } }>('/habits', {
    schema: { tags: ['Habits'], summary: 'Listar hábitos', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const filters = [eq(habits.userId, request.user.sub)];
    if (request.query.status) filters.push(eq(habits.status, request.query.status));
    const items = await db.select().from(habits).where(and(...filters)).orderBy(desc(habits.createdAt));
    return sendData(reply, items, 200, { count: items.length });
  });

  app.post<{ Body: Static<typeof CreateHabitBody> }>('/habits', {
    schema: { tags: ['Habits'], summary: 'Crear hábito', security: [{ bearerAuth: [] }], body: CreateHabitBody },
  }, async (request, reply) => {
    if (request.body.habitGroupId) await ensureOwnedPremiumGroup(request.body.habitGroupId, request.user.sub);
    const [habit] = await db.insert(habits).values({ userId: request.user.sub, ...request.body }).returning();
    if (habit?.privacy === 'public') {
      await db.insert(posts).values({
        authorId: request.user.sub,
        habitId: habit.id,
        content: `Comencé el hábito “${habit.name}”. ¡Un pequeño paso para cuidar de mí!`,
        kind: 'milestone',
        privacy: 'public',
        streakValue: 0,
      });
    }
    return sendData(reply, habit, 201);
  });

  app.get<{ Params: Static<typeof IdParams> }>('/habits/:id', {
    schema: { tags: ['Habits'], summary: 'Obtener hábito', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => sendData(reply, await ownedHabit(request.params.id, request.user.sub)));

  app.patch<{ Params: Static<typeof IdParams>; Body: Static<typeof UpdateHabitBody> }>('/habits/:id', {
    schema: { tags: ['Habits'], summary: 'Actualizar hábito', security: [{ bearerAuth: [] }], params: IdParams, body: UpdateHabitBody },
  }, async (request, reply) => {
    await ownedHabit(request.params.id, request.user.sub);
    if (request.body.habitGroupId) await ensureOwnedPremiumGroup(request.body.habitGroupId, request.user.sub);
    const [habit] = await db.update(habits).set({ ...request.body, updatedAt: new Date() })
      .where(and(eq(habits.id, request.params.id), eq(habits.userId, request.user.sub))).returning();
    return sendData(reply, habit);
  });

  app.delete<{ Params: Static<typeof IdParams> }>('/habits/:id', {
    schema: { tags: ['Habits'], summary: 'Eliminar hábito', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await ownedHabit(request.params.id, request.user.sub);
    await db.delete(habits).where(and(eq(habits.id, request.params.id), eq(habits.userId, request.user.sub)));
    return reply.code(204).send();
  });

  app.get<{ Params: Static<typeof IdParams>; Querystring: { from?: string; to?: string; limit?: string } }>('/habits/:id/check-ins', {
    schema: { tags: ['Habits'], summary: 'Listar registros de un hábito', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await ownedHabit(request.params.id, request.user.sub);
    const filters = [eq(habitEntries.habitId, request.params.id), eq(habitEntries.userId, request.user.sub)];
    if (request.query.from) filters.push(gte(habitEntries.occurredOn, request.query.from));
    if (request.query.to) filters.push(lte(habitEntries.occurredOn, request.query.to));
    const limit = parseLimit(request.query.limit, 60, 366);
    const items = await db.select().from(habitEntries).where(and(...filters)).orderBy(desc(habitEntries.occurredOn)).limit(limit);
    return sendData(reply, items, 200, { count: items.length });
  });

  app.put<{ Params: Static<typeof IdParams>; Body: Static<typeof CheckInBody> }>('/habits/:id/check-ins', {
    schema: { tags: ['Habits'], summary: 'Crear o actualizar registro diario', security: [{ bearerAuth: [] }], params: IdParams, body: CheckInBody },
  }, async (request, reply) => {
    await ownedHabit(request.params.id, request.user.sub);
    const now = new Date();
    const [entry] = await db.insert(habitEntries).values({
      habitId: request.params.id,
      userId: request.user.sub,
      ...request.body,
    }).onConflictDoUpdate({
      target: [habitEntries.habitId, habitEntries.occurredOn],
      set: { ...request.body, updatedAt: now },
    }).returning();
    const streak = await recalculateHabitStreak(request.params.id, request.user.sub);
    return sendData(reply, { entry, streak });
  });

  app.delete<{ Params: Static<typeof IdParams>; Querystring: { occurredOn: string } }>('/habits/:id/check-ins', {
    schema: { tags: ['Habits'], summary: 'Eliminar registro diario', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await ownedHabit(request.params.id, request.user.sub);
    await db.delete(habitEntries).where(and(
      eq(habitEntries.habitId, request.params.id),
      eq(habitEntries.userId, request.user.sub),
      eq(habitEntries.occurredOn, request.query.occurredOn),
    ));
    const streak = await recalculateHabitStreak(request.params.id, request.user.sub);
    return sendData(reply, { streak });
  });
};
