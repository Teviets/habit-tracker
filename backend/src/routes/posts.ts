import { Static, Type } from '@sinclair/typebox';
import { and, desc, eq, isNull, lt, or, SQL, sql } from 'drizzle-orm';
import { FastifyPluginAsync } from 'fastify';

import { db } from '../db/client.js';
import { groupMembers, habits, postComments, postLikes, posts, users } from '../db/schema.js';
import { AppError, notFound } from '../lib/errors.js';
import { parseDateCursor, parseLimit, sendData } from '../lib/response.js';
import { requireGroupMember } from '../services/groups.js';

const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
const CreatePostBody = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 2000 }),
  kind: Type.Optional(Type.Union([Type.Literal('update'), Type.Literal('milestone'), Type.Literal('tip')])),
  privacy: Type.Optional(Type.Union([Type.Literal('private'), Type.Literal('group'), Type.Literal('public')])),
  habitId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  groupId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  streakValue: Type.Optional(Type.Union([Type.Integer({ minimum: 0, maximum: 100000 }), Type.Null()])),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
const UpdatePostBody = Type.Partial(Type.Omit(CreatePostBody, ['habitId', 'groupId']), { minProperties: 1 });
const CommentBody = Type.Object({ content: Type.String({ minLength: 1, maxLength: 1000 }) });
const CommentParams = Type.Object({ id: Type.String({ format: 'uuid' }), commentId: Type.String({ format: 'uuid' }) });

async function validateRelations(userId: string, habitId?: string | null, groupId?: string | null) {
  if (habitId) {
    const [habit] = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, habitId), eq(habits.userId, userId))).limit(1);
    if (!habit) throw notFound('Hábito');
  }
  if (groupId) await requireGroupMember(groupId, userId);
}

const postSelection = (viewerId: string) => ({
  id: posts.id,
  content: posts.content,
  kind: posts.kind,
  privacy: posts.privacy,
  habitId: posts.habitId,
  groupId: posts.groupId,
  streakValue: posts.streakValue,
  metadata: posts.metadata,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  likes: sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`,
  comments: sql<number>`(select count(*)::int from ${postComments} where ${postComments.postId} = ${posts.id} and ${postComments.deletedAt} is null)`,
  likedByViewer: sql<boolean>`exists (select 1 from ${postLikes} where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${viewerId})`,
  author: {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  },
});

function visibilityFilter(userId: string): SQL {
  return or(
    eq(posts.privacy, 'public'),
    eq(posts.authorId, userId),
    and(
      eq(posts.privacy, 'group'),
      sql`exists (select 1 from ${groupMembers} gm where gm.group_id = ${posts.groupId} and gm.user_id = ${userId})`,
    ),
  )!;
}

export const postRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get<{ Querystring: { before?: string; limit?: string; authorId?: string; habitId?: string; groupId?: string } }>('/posts', {
    schema: { tags: ['Posts'], summary: 'Feed de publicaciones', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const filters: SQL[] = [isNull(posts.deletedAt), visibilityFilter(request.user.sub)];
    const before = parseDateCursor(request.query.before);
    if (before) filters.push(lt(posts.createdAt, before));
    if (request.query.authorId) filters.push(eq(posts.authorId, request.query.authorId));
    if (request.query.habitId) filters.push(eq(posts.habitId, request.query.habitId));
    if (request.query.groupId) filters.push(eq(posts.groupId, request.query.groupId));
    const limit = parseLimit(request.query.limit);
    const items = await db.select(postSelection(request.user.sub)).from(posts).innerJoin(users, eq(users.id, posts.authorId))
      .where(and(...filters)).orderBy(desc(posts.createdAt)).limit(limit + 1);
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return sendData(reply, page, 200, { hasMore, nextCursor: hasMore ? page.at(-1)?.createdAt.toISOString() : null });
  });

  app.post<{ Body: Static<typeof CreatePostBody> }>('/posts', {
    schema: { tags: ['Posts'], summary: 'Crear publicación de progreso', security: [{ bearerAuth: [] }], body: CreatePostBody },
  }, async (request, reply) => {
    if (!request.body.habitId && request.body.streakValue === undefined) throw new AppError(400, 'POST_CONTEXT_REQUIRED', 'Una publicación debe estar ligada a un hábito o una racha.');
    await validateRelations(request.user.sub, request.body.habitId, request.body.groupId);
    const privacy = request.body.groupId ? 'group' : request.body.privacy;
    if (privacy === 'group' && !request.body.groupId) throw new AppError(400, 'GROUP_REQUIRED', 'Las publicaciones de grupo requieren un groupId.');
    const [post] = await db.insert(posts).values({ authorId: request.user.sub, ...request.body, privacy }).returning();
    return sendData(reply, post, 201);
  });

  app.get<{ Params: Static<typeof IdParams> }>('/posts/:id', {
    schema: { tags: ['Posts'], summary: 'Obtener publicación', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const [post] = await db.select(postSelection(request.user.sub)).from(posts).innerJoin(users, eq(users.id, posts.authorId))
      .where(and(eq(posts.id, request.params.id), isNull(posts.deletedAt), visibilityFilter(request.user.sub))).limit(1);
    if (!post) throw notFound('Publicación');
    return sendData(reply, post);
  });

  app.patch<{ Params: Static<typeof IdParams>; Body: Static<typeof UpdatePostBody> }>('/posts/:id', {
    schema: { tags: ['Posts'], summary: 'Editar publicación', security: [{ bearerAuth: [] }], params: IdParams, body: UpdatePostBody },
  }, async (request, reply) => {
    const [post] = await db.update(posts).set({ ...request.body, updatedAt: new Date() }).where(and(
      eq(posts.id, request.params.id),
      eq(posts.authorId, request.user.sub),
      isNull(posts.deletedAt),
    )).returning();
    if (!post) throw notFound('Publicación');
    return sendData(reply, post);
  });

  app.delete<{ Params: Static<typeof IdParams> }>('/posts/:id', {
    schema: { tags: ['Posts'], summary: 'Eliminar publicación', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const [post] = await db.update(posts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(
      eq(posts.id, request.params.id),
      eq(posts.authorId, request.user.sub),
      isNull(posts.deletedAt),
    )).returning({ id: posts.id });
    if (!post) throw notFound('Publicación');
    return reply.code(204).send();
  });

  app.put<{ Params: Static<typeof IdParams> }>('/posts/:id/like', {
    schema: { tags: ['Posts'], summary: 'Dar me gusta', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const [post] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, request.params.id), isNull(posts.deletedAt), visibilityFilter(request.user.sub))).limit(1);
    if (!post) throw notFound('Publicación');
    await db.insert(postLikes).values({ postId: post.id, userId: request.user.sub }).onConflictDoNothing();
    return sendData(reply, { liked: true });
  });

  app.delete<{ Params: Static<typeof IdParams> }>('/posts/:id/like', {
    schema: { tags: ['Posts'], summary: 'Quitar me gusta', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    await db.delete(postLikes).where(and(eq(postLikes.postId, request.params.id), eq(postLikes.userId, request.user.sub)));
    return reply.code(204).send();
  });

  app.get<{ Params: Static<typeof IdParams> }>('/posts/:id/comments', {
    schema: { tags: ['Posts'], summary: 'Listar comentarios', security: [{ bearerAuth: [] }], params: IdParams },
  }, async (request, reply) => {
    const [post] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, request.params.id), isNull(posts.deletedAt), visibilityFilter(request.user.sub))).limit(1);
    if (!post) throw notFound('Publicación');
    const items = await db.select({ id: postComments.id, content: postComments.content, createdAt: postComments.createdAt, author: { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl } }).from(postComments).innerJoin(users, eq(users.id, postComments.authorId)).where(and(eq(postComments.postId, post.id), isNull(postComments.deletedAt))).orderBy(postComments.createdAt);
    return sendData(reply, items);
  });

  app.post<{ Params: Static<typeof IdParams>; Body: Static<typeof CommentBody> }>('/posts/:id/comments', {
    schema: { tags: ['Posts'], summary: 'Comentar publicación', security: [{ bearerAuth: [] }], params: IdParams, body: CommentBody },
  }, async (request, reply) => {
    const [post] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, request.params.id), isNull(posts.deletedAt), visibilityFilter(request.user.sub))).limit(1);
    if (!post) throw notFound('Publicación');
    const [comment] = await db.insert(postComments).values({ postId: post.id, authorId: request.user.sub, content: request.body.content.trim() }).returning();
    return sendData(reply, comment, 201);
  });

  app.delete<{ Params: Static<typeof CommentParams> }>('/posts/:id/comments/:commentId', {
    schema: { tags: ['Posts'], summary: 'Eliminar comentario propio', security: [{ bearerAuth: [] }], params: CommentParams },
  }, async (request, reply) => {
    const [comment] = await db.update(postComments).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(postComments.id, request.params.commentId), eq(postComments.postId, request.params.id), eq(postComments.authorId, request.user.sub), isNull(postComments.deletedAt))).returning({ id: postComments.id });
    if (!comment) throw notFound('Comentario');
    return reply.code(204).send();
  });
};
