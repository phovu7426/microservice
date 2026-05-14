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
