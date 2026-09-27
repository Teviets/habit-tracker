import { Static, Type } from '@sinclair/typebox';
import { and, eq, or, sql } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { follows, habits, sessions, users } from '../db/schema.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { sendData } from '../lib/response.js';

const UpdateUserBody = Type.Partial(Type.Object({
  username: Type.String({ minLength: 3, maxLength: 40, pattern: '^[a-zA-Z0-9_.-]+$' }),
  displayName: Type.String({ minLength: 2, maxLength: 100 }),
  bio: Type.Union([Type.String({ maxLength: 280 }), Type.Null()]),
  avatarUrl: Type.Union([Type.String({ format: 'uri', maxLength: 2000 }), Type.Null()]),
  timezone: Type.String({ maxLength: 80 }),
  locale: Type.Union([Type.Literal('es'), Type.Literal('en')]),
  theme: Type.Union([Type.Literal('system'), Type.Literal('light'), Type.Literal('dark')]),
}), { minProperties: 1 });

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

const safeFields = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  avatarUrl: users.avatarUrl,
  timezone: users.timezone,
  locale: users.locale,
  theme: users.theme,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { query?: string; limit?: string } }>('/users', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Buscar usuarios', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const query = request.query.query?.trim().toLowerCase() ?? '';
    const limit = Math.min(Math.max(Number(request.query.limit) || 20, 1), 50);
    const filter = query ? or(sql`lower(${users.username}) like ${`%${query}%`}`, sql`lower(${users.displayName}) like ${`%${query}%`}`) : undefined;
    const items = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, isFollowing: sql<boolean>`exists (select 1 from ${follows} where ${follows.followerId} = ${request.user.sub} and ${follows.followingId} = ${users.id})` }).from(users).where(filter).limit(limit);
    return sendData(reply, items);
  });

  app.get('/users/me', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Perfil del usuario actual', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const [user] = await db.select(safeFields).from(users).where(eq(users.id, request.user.sub)).limit(1);
    if (!user) throw notFound('Usuario');
    const [summary] = await db.select({ habits: sql<number>`count(${habits.id})::int` }).from(habits).where(eq(habits.userId, request.user.sub));
    return sendData(reply, { ...user, summary: { habits: summary?.habits ?? 0 } });
  });

  app.patch<{ Body: Static<typeof UpdateUserBody> }>('/users/me', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Actualizar perfil', security: [{ bearerAuth: [] }], body: UpdateUserBody },
  }, async (request, reply) => {
    if (request.body.username) {
      const username = request.body.username.trim().toLowerCase();
      const [duplicate] = await db.select({ id: users.id }).from(users)
        .where(sql`lower(${users.username}) = ${username} and ${users.id} <> ${request.user.sub}`).limit(1);
      if (duplicate) throw conflict('Ese nombre de usuario ya está en uso.');
    }
    const [user] = await db.update(users).set({ ...request.body, updatedAt: new Date() })
      .where(eq(users.id, request.user.sub)).returning(safeFields);
    if (!user) throw notFound('Usuario');
    return sendData(reply, user);
  });

  app.get<{ Params: Static<typeof IdParams> }>('/users/:id', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Ver perfil público', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      isFollowing: sql<boolean>`exists (select 1 from ${follows} where ${follows.followerId} = ${request.user.sub} and ${follows.followingId} = ${users.id})`,
      followers: sql<number>`(select count(*)::int from ${follows} where ${follows.followingId} = ${users.id})`,
      following: sql<number>`(select count(*)::int from ${follows} where ${follows.followerId} = ${users.id})`,
    }).from(users).where(eq(users.id, request.params.id)).limit(1);
    if (!user) throw notFound('Usuario');
    const publicHabits = await db.select({ id: habits.id, name: habits.name, icon: habits.icon, color: habits.color, frequency: habits.frequency, currentStreak: habits.currentStreak, longestStreak: habits.longestStreak }).from(habits).where(and(eq(habits.userId, user.id), eq(habits.privacy, 'public'), eq(habits.status, 'active')));
    return sendData(reply, { ...user, publicHabits });
  });

  app.put<{ Params: Static<typeof IdParams> }>('/users/:id/follow', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Seguir usuario', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    if (request.params.id === request.user.sub) throw new AppError(400, 'CANNOT_FOLLOW_SELF', 'No puedes seguirte a ti mismo.');
    const [target] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, request.params.id), eq(users.isActive, true))).limit(1);
    if (!target) throw notFound('Usuario');
    await db.insert(follows).values({ followerId: request.user.sub, followingId: target.id }).onConflictDoNothing();
    return sendData(reply, { following: true });
  });

  app.delete<{ Params: Static<typeof IdParams> }>('/users/:id/follow', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Dejar de seguir usuario', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await db.delete(follows).where(and(eq(follows.followerId, request.user.sub), eq(follows.followingId, request.params.id)));
    return reply.code(204).send();
  });

  app.get<{ Params: Static<typeof IdParams>; Querystring: { type?: 'followers' | 'following' } }>('/users/:id/follows', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Listar seguidores o seguidos', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const type = request.query.type === 'following' ? 'following' : 'followers';
    const joinColumn = type === 'following' ? follows.followingId : follows.followerId;
    const targetColumn = type === 'following' ? follows.followerId : follows.followingId;
    const items = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(follows).innerJoin(users, eq(users.id, targetColumn)).where(eq(joinColumn, request.params.id));
    return sendData(reply, items);
  });

  app.delete('/users/me', {
    preHandler: app.authenticate,
    schema: { tags: ['Users'], summary: 'Desactivar cuenta', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, request.user.sub));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, request.user.sub));
    });
    return reply.code(204).send();
  });
};
