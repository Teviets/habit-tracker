import { randomBytes } from 'node:crypto';

import { Static, Type } from '@sinclair/typebox';
import { and, eq, or, sql } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { conversationMembers, conversations, groupMembers, groups, users } from '../db/schema.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { sendData } from '../lib/response.js';
import { getGroupRole, requireGroupAdmin, requireGroupMember } from '../services/groups.js';

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
const MemberParams = Type.Object({ id: Type.String({ format: 'uuid' }), userId: Type.String({ format: 'uuid' }) });
const CreateGroupBody = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  avatarUrl: Type.Optional(Type.Union([Type.String({ format: 'uri', maxLength: 2000 }), Type.Null()])),
  isPrivate: Type.Optional(Type.Boolean()),
});
const UpdateGroupBody = Type.Partial(CreateGroupBody, { minProperties: 1 });
const JoinBody = Type.Object({ joinCode: Type.Optional(Type.String({ minLength: 4, maxLength: 16 })) });
const UpdateRoleBody = Type.Object({ role: Type.Union([Type.Literal('admin'), Type.Literal('member')]) });

function newJoinCode() {
  return randomBytes(6).toString('base64url').toUpperCase();
}

async function findGroup(id: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  if (!group) throw notFound('Grupo');
  return group;
}

export const groupRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/groups', {
    schema: { tags: ['Groups'], summary: 'Listar grupos propios y públicos', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const items = await db.select({
      group: groups,
      role: groupMembers.role,
      memberCount: sql<number>`(select count(*)::int from group_members gm where gm.group_id = ${groups.id})`,
    }).from(groups)
      .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, request.user.sub)))
      .where(or(eq(groups.isPrivate, false), eq(groupMembers.userId, request.user.sub)))
      .orderBy(groups.createdAt);
    return sendData(reply, items.map(({ group, ...rest }) => ({ ...group, ...rest, joinCode: rest.role ? group.joinCode : null })));
  });

  app.post<{ Body: Static<typeof CreateGroupBody> }>('/groups', {
    schema: { tags: ['Groups'], summary: 'Crear grupo', security: [{ bearerAuth: [] }], body: CreateGroupBody },
  }, async (request, reply) => {
    const result = await db.transaction(async (tx) => {
      const [group] = await tx.insert(groups).values({
        ownerId: request.user.sub,
        ...request.body,
        joinCode: newJoinCode(),
      }).returning();
      if (!group) throw new Error('Group insert failed');
      await tx.insert(groupMembers).values({ groupId: group.id, userId: request.user.sub, role: 'owner' });
      const [conversation] = await tx.insert(conversations).values({ kind: 'group', groupId: group.id, title: group.name }).returning();
      if (conversation) await tx.insert(conversationMembers).values({ conversationId: conversation.id, userId: request.user.sub });
      return { ...group, role: 'owner' as const, conversationId: conversation?.id };
    });
    return sendData(reply, result, 201);
  });

  app.get<{ Params: Static<typeof IdParams> }>('/groups/:id', {
    schema: { tags: ['Groups'], summary: 'Obtener grupo', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const group = await findGroup(request.params.id);
    const role = await getGroupRole(group.id, request.user.sub);
    if (group.isPrivate && !role) throw forbidden('Este grupo es privado.');
    return sendData(reply, { ...group, role: role ?? null, joinCode: role ? group.joinCode : null });
  });

  app.patch<{ Params: Static<typeof IdParams>; Body: Static<typeof UpdateGroupBody> }>('/groups/:id', {
    schema: { tags: ['Groups'], summary: 'Actualizar grupo', security: [{ bearerAuth: [] }], params: IdParams, body: UpdateGroupBody },
  }, async (request, reply) => {
    await requireGroupAdmin(request.params.id, request.user.sub);
    const [group] = await db.update(groups).set({ ...request.body, updatedAt: new Date() }).where(eq(groups.id, request.params.id)).returning();
    if (!group) throw notFound('Grupo');
    if (request.body.name) await db.update(conversations).set({ title: request.body.name, updatedAt: new Date() }).where(eq(conversations.groupId, group.id));
    return sendData(reply, group);
  });

  app.delete<{ Params: Static<typeof IdParams> }>('/groups/:id', {
    schema: { tags: ['Groups'], summary: 'Eliminar grupo', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const group = await findGroup(request.params.id);
    if (group.ownerId !== request.user.sub) throw forbidden('Solo quien creó el grupo puede eliminarlo.');
    await db.delete(groups).where(eq(groups.id, group.id));
    return reply.code(204).send();
  });

  app.post<{ Params: Static<typeof IdParams>; Body: Static<typeof JoinBody> }>('/groups/:id/join', {
    schema: { tags: ['Groups'], summary: 'Unirse a un grupo', security: [{ bearerAuth: [] }], params: IdParams, body: JoinBody },
  }, async (request, reply) => {
    const group = await findGroup(request.params.id);
    if (group.isPrivate && group.joinCode !== request.body.joinCode?.toUpperCase()) throw forbidden('El código de invitación no es válido.');
    if (await getGroupRole(group.id, request.user.sub)) throw conflict('Ya perteneces a este grupo.');

    await db.transaction(async (tx) => {
      await tx.insert(groupMembers).values({ groupId: group.id, userId: request.user.sub });
      const [conversation] = await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.groupId, group.id)).limit(1);
      if (conversation) await tx.insert(conversationMembers).values({ conversationId: conversation.id, userId: request.user.sub }).onConflictDoNothing();
    });
    return sendData(reply, { joined: true }, 201);
  });

  app.post<{ Params: Static<typeof IdParams> }>('/groups/:id/leave', {
    schema: { tags: ['Groups'], summary: 'Salir de un grupo', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const role = await requireGroupMember(request.params.id, request.user.sub);
    if (role === 'owner') throw conflict('Transfiere la propiedad o elimina el grupo antes de salir.');
    await db.transaction(async (tx) => {
      await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, request.params.id), eq(groupMembers.userId, request.user.sub)));
      const [conversation] = await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.groupId, request.params.id)).limit(1);
      if (conversation) await tx.delete(conversationMembers).where(and(eq(conversationMembers.conversationId, conversation.id), eq(conversationMembers.userId, request.user.sub)));
    });
    return reply.code(204).send();
  });

  app.get<{ Params: Static<typeof IdParams> }>('/groups/:id/members', {
    schema: { tags: ['Groups'], summary: 'Listar miembros', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await requireGroupMember(request.params.id, request.user.sub);
    const members = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId)).where(eq(groupMembers.groupId, request.params.id));
    return sendData(reply, members);
  });

  app.patch<{ Params: Static<typeof MemberParams>; Body: Static<typeof UpdateRoleBody> }>('/groups/:id/members/:userId', {
    schema: { tags: ['Groups'], summary: 'Cambiar rol de miembro', security: [{ bearerAuth: [] }], params: MemberParams, body: UpdateRoleBody },
  }, async (request, reply) => {
    const group = await findGroup(request.params.id);
    if (group.ownerId !== request.user.sub) throw forbidden('Solo quien creó el grupo puede cambiar roles.');
    if (request.params.userId === group.ownerId) throw conflict('No se puede cambiar el rol del propietario.');
    const [membership] = await db.update(groupMembers).set({ role: request.body.role }).where(and(
      eq(groupMembers.groupId, group.id),
      eq(groupMembers.userId, request.params.userId),
    )).returning();
    if (!membership) throw notFound('Miembro');
    return sendData(reply, membership);
  });
};
