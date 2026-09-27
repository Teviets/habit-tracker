import { FastifyReply } from 'fastify';

export function sendData<T>(reply: FastifyReply, data: T, statusCode = 200, meta?: Record<string, unknown>) {
  return reply.code(statusCode).send(meta ? { data, meta } : { data });
}

export function parseLimit(value: unknown, fallback = 20, maximum = 100) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function parseDateCursor(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
