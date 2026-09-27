import { Static, Type } from '@sinclair/typebox';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { AppError, unauthorized } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { sendData } from '../lib/response.js';
import { createRefreshToken, hashToken } from '../lib/tokens.js';

const RegisterBody = Type.Object({
  email: Type.String({ format: 'email', maxLength: 320 }),
  username: Type.String({ minLength: 3, maxLength: 40, pattern: '^[a-zA-Z0-9_.-]+$' }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
  displayName: Type.String({ minLength: 2, maxLength: 100 }),
  timezone: Type.Optional(Type.String({ maxLength: 80 })),
  locale: Type.Optional(Type.Union([Type.Literal('es'), Type.Literal('en')])),
});

const LoginBody = Type.Object({
  email: Type.String({ format: 'email', maxLength: 320 }),
  password: Type.String({ minLength: 1, maxLength: 128 }),
});

const RefreshBody = Type.Object({ refreshToken: Type.String({ minLength: 32, maxLength: 256 }) });

function publicUser(user: typeof users.$inferSelect) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

async function createSession(app: FastifyInstance, user: typeof users.$inferSelect, request: FastifyRequest) {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000);
  await db.insert(sessions).values({
    userId: user.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']?.slice(0, 500),
  });
  const accessToken = app.jwt.sign({ sub: user.id, type: 'access' }, { expiresIn: env.ACCESS_TOKEN_TTL });
  return { accessToken, refreshToken, expiresAt };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Static<typeof RegisterBody> }>('/auth/register', {
    schema: { tags: ['Auth'], summary: 'Crear cuenta', body: RegisterBody },
    config: { rateLimit: { max: 8, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const username = request.body.username.trim();
    const existing = await db.select({ id: users.id }).from(users).where(
      sql`lower(${users.email}) = ${email} or lower(${users.username}) = ${username.toLowerCase()}`,
    ).limit(1);
    if (existing.length) throw new AppError(409, 'ACCOUNT_EXISTS', 'El correo o nombre de usuario ya está registrado.');

    const passwordHash = await hashPassword(request.body.password);
    let user: typeof users.$inferSelect | undefined;
    try {
      [user] = await db.insert(users).values({
        email,
        username,
        passwordHash,
        displayName: request.body.displayName.trim(),
        ...(request.body.timezone ? { timezone: request.body.timezone } : {}),
        ...(request.body.locale ? { locale: request.body.locale } : {}),
      }).returning();
    } catch (error) {
      const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : undefined;
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505') {
        throw new AppError(409, 'ACCOUNT_EXISTS', 'El correo o nombre de usuario ya está registrado.');
      }
      throw error;
    }
    if (!user) throw new Error('User insert failed');

    const tokens = await createSession(app, user, request);
    return sendData(reply, { user: publicUser(user), ...tokens }, 201);
  });

  app.post<{ Body: Static<typeof LoginBody> }>('/auth/login', {
    schema: { tags: ['Auth'], summary: 'Iniciar sesión', body: LoginBody },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const email = request.body.email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'No encontramos una cuenta con ese correo.');
    if (!user.isActive) throw new AppError(403, 'ACCOUNT_BLOCKED', 'Esta cuenta está bloqueada. Contacta a soporte para recuperarla.');
    if (!(await verifyPassword(request.body.password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_PASSWORD', 'La contraseña es incorrecta.');
    }

    const now = new Date();
    await db.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, user.id));
    const tokens = await createSession(app, { ...user, lastLoginAt: now, updatedAt: now }, request);
    return sendData(reply, { user: publicUser({ ...user, lastLoginAt: now, updatedAt: now }), ...tokens });
  });

  app.post<{ Body: Static<typeof RefreshBody> }>('/auth/refresh', {
    schema: { tags: ['Auth'], summary: 'Rotar tokens de sesión', body: RefreshBody },
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const tokenHash = hashToken(request.body.refreshToken);
    const [record] = await db.select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.refreshTokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!record || !record.user.isActive) throw unauthorized('El refresh token no es válido.');

    const refreshToken = createRefreshToken();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000);
    const rotated = await db.update(sessions).set({ refreshTokenHash: hashToken(refreshToken), expiresAt }).where(and(
      eq(sessions.id, record.session.id),
      eq(sessions.refreshTokenHash, tokenHash),
      isNull(sessions.revokedAt),
    )).returning({ id: sessions.id });
    if (!rotated.length) throw unauthorized('El refresh token ya fue utilizado.');
    const accessToken = app.jwt.sign({ sub: record.user.id, type: 'access' }, { expiresIn: env.ACCESS_TOKEN_TTL });
    return sendData(reply, { accessToken, refreshToken, expiresAt });
  });

  app.post<{ Body: Static<typeof RefreshBody> }>('/auth/logout', {
    schema: { tags: ['Auth'], summary: 'Cerrar sesión', body: RefreshBody },
  }, async (request, reply) => {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.refreshTokenHash, hashToken(request.body.refreshToken)));
    return reply.code(204).send();
  });
};
