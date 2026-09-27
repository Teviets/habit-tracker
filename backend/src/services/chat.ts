import { and, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { conversationMembers, messages } from '../db/schema.js';
import { forbidden } from '../lib/errors.js';

export async function isConversationMember(conversationId: string, userId: string) {
  const [membership] = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(and(
    eq(conversationMembers.conversationId, conversationId),
    eq(conversationMembers.userId, userId),
  )).limit(1);
  return Boolean(membership);
}

export async function requireConversationMember(conversationId: string, userId: string) {
  if (!(await isConversationMember(conversationId, userId))) {
    throw forbidden('No perteneces a esta conversación.');
  }
}

export async function createMessage(input: { conversationId: string; senderId: string; content: string; clientId?: string; metadata?: Record<string, unknown> }) {
  const [message] = await db.insert(messages).values(input).onConflictDoNothing().returning();
  if (message) return message;
  if (input.clientId) {
    const [existing] = await db.select().from(messages).where(and(
      eq(messages.conversationId, input.conversationId),
      eq(messages.clientId, input.clientId),
    )).limit(1);
    if (existing) return existing;
  }
  throw new Error('Message insert failed');
}
