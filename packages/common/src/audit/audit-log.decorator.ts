import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMeta {
  /** Stable name for the action — e.g. 'user.delete', 'role.update' */
  action: string;
  /** Resource family the action targets — e.g. 'user', 'role'. Optional. */
  resource?: string;
  /**
   * Whether to include the request body in the audit record. Default false
   * because request bodies often contain PII / passwords. Only enable for
   * actions where the diff is small and non-sensitive (e.g. role assignment).
   */
  includeBody?: boolean;
}

/**
 * Mark a controller handler as an auditable action. The AuditLogInterceptor
 * picks up the metadata and emits a structured log line containing actor,
 * action, target, IP, request id, status, and (optionally) the body.
 *
 * Usage:
 *   @Post(':id/delete')
 *   @AuditLog({ action: 'user.delete', resource: 'user' })
 *   async deleteUser(@Param('id') id: string) { ... }
 */
export const AuditLog = (meta: AuditLogMeta) => SetMetadata(AUDIT_LOG_KEY, meta);
