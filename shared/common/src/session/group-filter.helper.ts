import { session } from './session-context.storage';

/**
 * Returns groupId when in group context, null when in system context.
 * Use in services: const gid = getSessionGroupId(); if (gid) { filter by gid }
 */
export function getSessionGroupId(): bigint | null {
  const ctx = session();
  if (!ctx || ctx.isSystemContext) return null;
  return ctx.groupId;
}

/**
 * Returns current authenticated user's ID from session (req.user.sub).
 * Use in services instead of passing actorId as parameter.
 */
export function getSessionUserId(): bigint | null {
  const uid = session()?.userId;
  if (!uid) return null;
  try { return BigInt(uid); } catch { return null; }
}
