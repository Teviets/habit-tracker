import { Static, Type } from '@sinclair/typebox';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { conversationMembers, conversations, messages, users } from '../db/schema.js';
import { AppError, notFound, unauthorized } from '../lib/errors.js';
import { parseDateCursor, parseLimit, sendData } from '../lib/response.js';
import { createMessage, isConversationMember, requireConversationMember } from '../services/chat.js';
import { chatHub } from '../services/chatHub.js';

const ConversationParams = Type.Object({ conversationId: Type.String({ format: 'uuid' }) });
const MessageParams = Type.Object({ conversationId: Type.String({ format: 'uuid' }), messageId: Type.String({ format: 'uuid' }) });
const CreateConversationBody = Type.Object({
  memberIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1, maxItems: 20, uniqueItems: true }),
  title: Type.Optional(Type.String({ maxLength: 100 })),
});
const CreateMessageBody = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 4000 }),
  clientId: Type.Optional(Type.String({ format: 'uuid' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
const UpdateMessageBody = Type.Object({ content: Type.String({ minLength: 1, maxLength: 4000 }) });

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get('/conversations', {
    preHandler: app.authenticate,
    schema: { tags: ['Chat'], summary: 'Listar conversaciones', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const items = await db.select({
      id: conversations.id,
      kind: conversations.kind,
      groupId: conversations.groupId,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
      lastMessage: sql<unknown>`(
        select json_build_object('id', m.id, 'content', m.content, 'senderId', m.sender_id, 'createdAt', m.created_at)
        from messages m where m.conversation_id = ${conversations.id} and m.deleted_at is null
        order by m.created_at desc limit 1
      )`,
    }).from(conversations).innerJoin(conversationMembers, and(
      eq(conversationMembers.conversationId, conversations.id),
      eq(conversationMembers.userId, request.user.sub),
    )).orderBy(desc(conversations.updatedAt));
    return sendData(reply, items);
  });

  app.post<{ Body: Static<typeof CreateConversationBody> }>('/conversations', {
    preHandler: app.authenticate,
    schema: { tags: ['Chat'], summary: 'Crear conversación directa', security: [{ bearerAuth: [] }], body: CreateConversationBody },
  }, async (request, reply) => {
    const memberIds = [...new Set([request.user.sub, ...request.body.memberIds])];
    const existingUsers = await db.select({ id: users.id }).from(users).where(sql`${users.id} = any(${memberIds}::uuid[])`);
    if (existingUsers.length !== memberIds.length) {
      throw new AppError(400, 'INVALID_MEMBERS', 'Uno o más usuarios de la conversación no existen.');
    }
    const result = await db.transaction(async (tx) => {
      const [conversation] = await tx.insert(conversations).values({ kind: 'direct', title: request.body.title }).returning();
      if (!conversation) throw new Error('Conversation insert failed');
      await tx.insert(conversationMembers).values(memberIds.map((userId) => ({ conversationId: conversation.id, userId })));
      return { ...conversation, memberIds };
    });
    return sendData(reply, result, 201);
  });

  app.get<{ Params: Static<typeof ConversationParams>; Querystring: { before?: string; limit?: string } }>('/conversations/:conversationId/messages', {
    preHandler: app.authenticate,
    schema: { tags: ['Chat'], summary: 'Historial de mensajes', security: [{ bearerAuth: [] }], params: ConversationParams },
  }, async (request, reply) => {
    await requireConversationMember(request.params.conversationId, request.user.sub);
    const filters = [eq(messages.conversationId, request.params.conversationId), isNull(messages.deletedAt)];
    const before = parseDateCursor(request.query.before);
    if (before) filters.push(lt(messages.createdAt, before));
    const limit = parseLimit(request.query.limit, 30, 100);
    const items = await db.select().from(messages).where(and(...filters)).orderBy(desc(messages.createdAt)).limit(limit + 1);
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return sendData(reply, page, 200, { hasMore, nextCursor: hasMore ? page.at(-1)?.createdAt.toISOString() : null });
  });

  app.post<{ Params: Static<typeof ConversationParams>; Body: Static<typeof CreateMessageBody> }>('/conversations/:conversationId/messages', {
    preHandler: app.authenticate,
    schema: { tags: ['Chat'], summary: 'Enviar mensaje por HTTP', security: [{ bearerAuth: [] }], params: ConversationParams, body: CreateMessageBody },
  }, async (request, reply) => {
    await requireConversationMember(request.params.conversationId, request.user.sub);
    const message = await createMessage({ conversationId: request.params.conversationId, senderId: request.user.sub, ...request.body });
    await db.update(conversations).set({ updatedAt: message.createdAt }).where(eq(conversations.id, request.params.conversationId));
    chatHub.broadcast(request.params.conversationId, { type: 'message', data: message });
    return sendData(reply, message, 201);
  });

  app.patch<{ Params: Static<typeof MessageParams>; Body: Static<typeof UpdateMessageBody> }>('/conversations/:conversationId/messages/:messageId', {
    preHandler: app.authenticate,
    schema: { tags: ['Chat'], summary: 'Editar mensaje', security: [{ bearerAuth: [] }], params: MessageParams, body: UpdateMessageBody },
  }, async (request, reply) => {
    await requireConversationMember(request.params.conversationId, request.user.sub);
    const [message] = await db.update(messages).set({ content: request.body.content, editedAt: new Date() }).where(and(
      eq(messages.id, request.params.messageId),
      eq(messages.conversationId, request.params.conversationId),
      eq(messages.senderId, request.user.sub),
      isNull(messages.deletedAt),
    )).returning();
    if (!message) throw notFound('Mensaje');
    chatHub.broadcast(request.params.conversationId, { type: 'message_updated', data: message });
    return sendData(reply, message);
  });

  app.delete<{ Params: Static<typeof MessageParams> }>('/conversations/:conversationId/messages/:messageId', {
    preHandler: app.authenticate,
    schema: { tags: ['Chat'], summary: 'Eliminar mensaje', security: [{ bearerAuth: [] }], params: MessageParams },
  }, async (request, reply) => {
    await requireConversationMember(request.params.conversationId, request.user.sub);
    const [message] = await db.update(messages).set({ deletedAt: new Date() }).where(and(
      eq(messages.id, request.params.messageId),
      eq(messages.conversationId, request.params.conversationId),
      eq(messages.senderId, request.user.sub),
      isNull(messages.deletedAt),
    )).returning({ id: messages.id });
    if (!message) throw notFound('Mensaje');
    chatHub.broadcast(request.params.conversationId, { type: 'message_deleted', data: message });
    return reply.code(204).send();
  });

  app.get<{ Params: Static<typeof ConversationParams> }>('/chat/:conversationId/ws', {
    websocket: true,
    schema: { tags: ['Chat'], summary: 'WebSocket de chat (autenticación en primer mensaje)', params: ConversationParams },
  }, (socket, request) => {
    const conversationId = request.params.conversationId;
    let userId: string | undefined;
    const authTimer = setTimeout(() => socket.close(4401, 'Authentication timeout'), 10_000);

    socket.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (!userId) {
          if (payload.type !== 'auth' || typeof payload.token !== 'string') throw unauthorized();
          const decoded = app.jwt.verify<{ sub: string; type: string }>(payload.token);
          if (decoded.type !== 'access' || !(await isConversationMember(conversationId, decoded.sub))) throw unauthorized();
          userId = decoded.sub;
          clearTimeout(authTimer);
          chatHub.join(conversationId, socket);
          socket.send(JSON.stringify({ type: 'authenticated', data: { conversationId } }));
          return;
        }

        if (payload.type === 'typing') {
          chatHub.broadcast(conversationId, { type: 'typing', data: { userId, active: Boolean(payload.active) } });
          return;
        }
        if (payload.type !== 'message' || typeof payload.content !== 'string') return;
        const content = payload.content.trim();
        if (!content || content.length > 4000) {
          socket.send(JSON.stringify({ type: 'error', error: { code: 'INVALID_MESSAGE', message: 'El mensaje debe tener entre 1 y 4000 caracteres.' } }));
          return;
        }
        const message = await createMessage({
          conversationId,
          senderId: userId,
          content,
          ...(typeof payload.clientId === 'string' ? { clientId: payload.clientId } : {}),
        });
        await db.update(conversations).set({ updatedAt: message.createdAt }).where(eq(conversations.id, conversationId));
        chatHub.broadcast(conversationId, { type: 'message', data: message });
      } catch (error) {
        request.log.warn({ err: error }, 'websocket message rejected');
        socket.send(JSON.stringify({ type: 'error', error: { code: 'MESSAGE_REJECTED', message: 'No se pudo procesar el mensaje.' } }));
        if (!userId) socket.close(4401, 'Unauthorized');
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      chatHub.leave(conversationId, socket);
    });
  });
};
