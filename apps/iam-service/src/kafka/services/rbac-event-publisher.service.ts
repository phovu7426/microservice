import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../core/database/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

/**
 * Publishes RBAC-related events to the outbox table.
 * The outbox relay cron will pick them up and send to Kafka.
 */
@Injectable()
export class RbacEventPublisher {
  private readonly logger = new Logger(RbacEventPublisher.name);

  constructor(private readonly prisma: PrismaService) {}

  async publishRoleChanged(
    payload: {
      roleId: bigint;
      action: 'created' | 'updated' | 'deleted';
      roleCode: string;
      userId?: bigint;
    },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'role.changed',
      {
        role_id: String(payload.roleId),
        action: payload.action,
        role_code: payload.roleCode,
        user_id: payload.userId ? String(payload.userId) : undefined,
      },
      tx,
    );
  }

  async publishPermissionChanged(
    payload: {
      permissionId: bigint;
      action: 'created' | 'updated' | 'deleted';
      permissionCode: string;
      userId?: bigint;
    },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'permission.changed',
      {
        permission_id: String(payload.permissionId),
        action: payload.action,
        permission_code: payload.permissionCode,
        user_id: payload.userId ? String(payload.userId) : undefined,
      },
      tx,
    );
  }

  async publishRolePermissionChanged(
    payload: {
      roleId: bigint;
      permissionIds: bigint[];
      action: 'attached' | 'detached';
      userId?: bigint;
    },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'role.permission.changed',
      {
        role_id: String(payload.roleId),
        permission_ids: payload.permissionIds.map(String),
        action: payload.action,
        user_id: payload.userId ? String(payload.userId) : undefined,
      },
      tx,
    );
  }

  async publishUserRoleAssigned(
    payload: {
      userId: bigint;
      roleId: bigint;
      groupId: bigint;
    },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'user.role.assigned',
      {
        user_id: String(payload.userId),
        role_id: String(payload.roleId),
        group_id: String(payload.groupId),
      },
      tx,
    );
  }

  async publishUserRoleRevoked(
    payload: {
      userId: bigint;
      roleId: bigint;
      groupId: bigint;
    },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'user.role.revoked',
      {
        user_id: String(payload.userId),
        role_id: String(payload.roleId),
        group_id: String(payload.groupId),
      },
      tx,
    );
  }

  async publishCacheInvalidation(
    payload: {
      pattern: string;
      reason: string;
      affectedUserIds?: bigint[];
    },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'rbac.cache.invalidate',
      {
        pattern: payload.pattern,
        reason: payload.reason,
        affected_user_ids: payload.affectedUserIds?.map(String),
      },
      tx,
    );
  }

  async publishGroupMemberAdded(
    payload: { groupId: bigint; userId: bigint },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'group.member.added',
      {
        group_id: String(payload.groupId),
        user_id: String(payload.userId),
        timestamp: new Date().toISOString(),
      },
      tx,
    );
  }

  async publishGroupMemberRemoved(
    payload: { groupId: bigint; userId: bigint },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'group.member.removed',
      {
        group_id: String(payload.groupId),
        user_id: String(payload.userId),
        timestamp: new Date().toISOString(),
      },
      tx,
    );
  }

  async publishGroupDeleted(
    payload: { groupId: bigint },
    tx?: Tx,
  ): Promise<void> {
    await this.insertOutboxEvent(
      'group.deleted',
      {
        group_id: String(payload.groupId),
        timestamp: new Date().toISOString(),
      },
      tx,
    );
  }

  private async insertOutboxEvent(
    eventType: string,
    payload: Record<string, any>,
    tx: Tx = this.prisma,
  ): Promise<void> {
    try {
      await tx.outbox.create({
        data: {
          eventType: eventType,
          payload,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to insert outbox event [${eventType}]`, err);
      throw err;
    }
  }
}
