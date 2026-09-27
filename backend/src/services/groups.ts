import { and, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import { groupMembers } from '../db/schema.js';
import { forbidden } from '../lib/errors.js';

export async function getGroupRole(groupId: string, userId: string) {
  const [membership] = await db.select({ role: groupMembers.role }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))).limit(1);
  return membership?.role;
}

export async function requireGroupMember(groupId: string, userId: string) {
  const role = await getGroupRole(groupId, userId);
  if (!role) throw forbidden('Debes pertenecer al grupo para realizar esta acción.');
  return role;
}

export async function requireGroupAdmin(groupId: string, userId: string) {
  const role = await requireGroupMember(groupId, userId);
  if (role !== 'owner' && role !== 'admin') throw forbidden();
  return role;
}
