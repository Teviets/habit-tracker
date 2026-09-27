import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';

import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import { authPlugin } from './plugins/auth.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  await app.register(websocket, {
    options: {
      maxPayload: 64 * 1024,
      perMessageDeflate: true,
    },
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
  });
  await app.register(compress, {
    global: true,
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
  });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
  });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Florece API', version: '1.0.0' },
      servers: [{ url: 'http://localhost:4000', description: 'Local' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(authPlugin);
  await registerRoutes(app);

  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: { code: 'ROUTE_NOT_FOUND', message: 'La ruta solicitada no existe.' },
      requestId: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const validation = error && typeof error === 'object' && 'validation' in error ? error.validation : undefined;
    const isAppError = error instanceof AppError;
    const statusCode = isAppError ? error.statusCode : validation ? 400 : 500;
    const code = isAppError ? error.code : validation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    const message = isAppError ? error.message : validation ? 'Los datos enviados no son válidos.' : 'Ocurrió un error inesperado.';

    if (statusCode >= 500) request.log.error({ err: error }, 'request failed');

    void reply.code(statusCode).send({
      error: {
        code,
        message,
        ...(isAppError && error.details !== undefined ? { details: error.details } : {}),
        ...(validation ? { details: validation } : {}),
      },
      requestId: request.id,
    });
  });

  return app;
}
