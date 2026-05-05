export const PERM = {
  // --- System-level ---
  SYSTEM: {
    MANAGE: 'system.manage',
    CONFIG_VIEW: 'system.config.view',
    CONFIG_UPDATE: 'system.config.update',
  },

  // --- IAM ---
  ROLE: {
    MANAGE: 'role.manage',
    VIEW: 'role.view',
    CREATE: 'role.create',
    UPDATE: 'role.update',
    DELETE: 'role.delete',
  },
  PERMISSION: {
    MANAGE: 'permission.manage',
    VIEW: 'permission.view',
    SYNC: 'permission.sync',
  },
  CONTEXT: {
    MANAGE: 'context.manage',
    VIEW: 'context.view',
  },
  GROUP: {
    MANAGE: 'group.manage',
    VIEW: 'group.view',
  },
  USER_ROLE: {
    ASSIGN: 'user.role.assign',
    VIEW: 'user.role.view',
  },
  ASSIGNMENT: {
    MANAGE: 'assignment.manage',
    VIEW: 'assignment.view',
  },

  // --- Auth / User ---
  USER: {
    MANAGE: 'user.manage',
    VIEW: 'user.view',
    CREATE: 'user.create',
    UPDATE: 'user.update',
    DELETE: 'user.delete',
    STATUS: 'user.status',
  },

  // --- Domain services ---
  COMIC: {
    MANAGE: 'comic.manage',
    VIEW: 'comic.view',
  },
  POST: {
    MANAGE: 'post.manage',
    VIEW: 'post.view',
  },
  INTRODUCTION: {
    MANAGE: 'introduction.manage',
    VIEW: 'introduction.view',
  },
  MARKETING: {
    MANAGE: 'marketing.manage',
    VIEW: 'marketing.view',
  },
  BANNER: {
    MANAGE: 'banner.manage',
    VIEW: 'banner.view',
  },
  NOTIFICATION: {
    MANAGE: 'notification.manage',
    VIEW: 'notification.view',
  },
  CONFIG: {
    MANAGE: 'config.manage',
    VIEW: 'config.view',
  },
  STORAGE: {
    WRITE: 'storage:write',
    READ: 'storage:read',
    LIST: 'storage:list',
    DELETE: 'storage:delete',
  },
};
