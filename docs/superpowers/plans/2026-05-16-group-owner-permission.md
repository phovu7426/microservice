# Group Owner Permission — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi admin tạo group với `ownerId`, tự động gán role `group_owner` cho chủ nhóm trong group đó — nhờ đó chủ nhóm thấy menu "Quản lý nhóm" khi gọi `GET /user/menus` với header `x-group-id: <groupId>`.

**Architecture:** Permission `group.owner` được thêm vào seed data của iam-service và gán vào role `group_owner` (đã tồn tại). `GroupService` inject `RbacRepository` (global) để grant/revoke lifecycle. Menu entries thêm vào seed data của config-service với `required_permission_code: "group.owner"`. Khi xóa group, `UserRoleAssignment.onDelete: Cascade` tự xử lý — không cần revoke thủ công.

**Tech Stack:** NestJS, Prisma (BigInt), TypeScript — iam-service (port 3002), config-service (port 3003).

---

## File map

| Action | File |
|--------|------|
| Modify | `apps/iam-service/prisma/seed/data/permissions.json` |
| Modify | `apps/iam-service/prisma/seed/seeders/role.seeder.ts` |
| Create | `apps/iam-service/src/modules/group/constants/group-owner.constants.ts` |
| Modify | `apps/iam-service/src/rbac/repositories/rbac.repository.ts` |
| Modify | `apps/iam-service/src/modules/group/admin/services/group.service.ts` |
| Modify | `apps/iam-service/tests/modules/group/admin/services/group.service.spec.ts` |
| Modify | `apps/config-service/prisma/seed/data/menus.json` |

---

## Task 1: Thêm permission `group.owner` vào seed data iam-service

**Files:**
- Modify: `apps/iam-service/prisma/seed/data/permissions.json`
- Modify: `apps/iam-service/prisma/seed/seeders/role.seeder.ts`

- [ ] **Step 1: Thêm permission vào `permissions.json`**

Thêm vào cuối mảng (trước dấu `]`):

```json
  { "code": "group.owner", "name": "Chủ nhóm (Group Owner)", "status": "active", "parent_code": null }
```

- [ ] **Step 2: Gán permission `group.owner` vào role `group_owner` trong role seeder**

Trong `role.seeder.ts`, tìm mảng `ownerPermCodes` (khoảng dòng 72), thêm `'group.owner'` vào:

```typescript
const ownerPermCodes = [
  'group.owner',  // <-- thêm dòng này đầu tiên
  'comic.manage', 'comic.view', 'comic.create', 'comic.update', 'comic.delete', 'comic.approve',
  'chapter.view', 'chapter.create', 'chapter.update', 'chapter.delete',
  'post.manage', 'post_category.manage', 'post_tag.manage',
  'notification.manage', 'notification.view', 'notification.send',
  'group.manage', 'group.member.manage', 'group.member.add', 'group.member.remove',
];
```

- [ ] **Step 3: Chạy seed để verify**

```bash
npm run prisma:migrate -w apps/iam-service
# Hoặc nếu chỉ muốn chạy seed:
npx prisma db seed --schema=apps/iam-service/prisma/schema.prisma
```

Kết quả expect:
```
✔ Permission: group.owner
✔ group_owner → N permissions linked   (N tăng thêm 1)
```

- [ ] **Step 4: Commit**

```bash
git add apps/iam-service/prisma/seed/data/permissions.json
git add apps/iam-service/prisma/seed/seeders/role.seeder.ts
git commit -m "feat(iam): add group.owner permission and assign to group_owner role"
```

---

## Task 2: Thêm menu entries vào seed data config-service

**Files:**
- Modify: `apps/config-service/prisma/seed/data/menus.json`

Menu structure:
```
Quản lý nhóm (type: group, code: owner-group-management)
├── Thông tin nhóm (type: route, code: owner-group-detail)
└── Danh sách thành viên (type: route, code: owner-group-members)
```

- [ ] **Step 1: Thêm 3 menu entries vào `menus.json`**

Thêm vào cuối mảng (trước dấu `]`):

```json
  ,
  {
    "code": "owner-group-management",
    "name": "Quản lý nhóm",
    "path": null,
    "icon": "🏢",
    "type": "group",
    "status": "active",
    "parent_code": null,
    "sort_order": 50,
    "is_public": false,
    "show_in_menu": true,
    "group": "admin",
    "required_permission_code": "group.owner"
  },
  {
    "code": "owner-group-detail",
    "name": "Thông tin nhóm",
    "path": "/owner/groups",
    "icon": null,
    "type": "route",
    "status": "active",
    "parent_code": "owner-group-management",
    "sort_order": 1,
    "is_public": false,
    "show_in_menu": true,
    "group": "admin",
    "required_permission_code": "group.owner"
  },
  {
    "code": "owner-group-members",
    "name": "Danh sách thành viên",
    "path": "/owner/groups/:id/members",
    "icon": null,
    "type": "route",
    "status": "active",
    "parent_code": "owner-group-management",
    "sort_order": 2,
    "is_public": false,
    "show_in_menu": true,
    "group": "admin",
    "required_permission_code": "group.owner"
  }
```

- [ ] **Step 2: Chạy seed config-service để verify**

```bash
npx prisma db seed --schema=apps/config-service/prisma/schema.prisma
```

Kết quả expect:
```
✔ Menu: owner-group-management
✔ Menu: owner-group-detail
✔ Menu: owner-group-members
```

- [ ] **Step 3: Commit**

```bash
git add apps/config-service/prisma/seed/data/menus.json
git commit -m "feat(config): add group owner menu entries to seed data"
```

---

## Task 3: Constants + 2 methods mới trong `RbacRepository`

**Files:**
- Create: `apps/iam-service/src/modules/group/constants/group-owner.constants.ts`
- Modify: `apps/iam-service/src/rbac/repositories/rbac.repository.ts`

- [ ] **Step 1: Tạo constants file**

```typescript
// apps/iam-service/src/modules/group/constants/group-owner.constants.ts
export const GROUP_OWNER_ROLE_CODE = 'group_owner';
```

- [ ] **Step 2: Viết test thất bại cho 2 methods mới**

Kiểm tra `apps/iam-service/tests/rbac/repositories/rbac.repository.spec.ts` — nếu chưa có, tạo mới:

```typescript
jest.mock('src/generated/prisma', () => ({ Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../../src/core/database/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('src/types', () => ({ toPrimaryKey: (v: any) => BigInt(v) }), { virtual: true });

import { RbacRepository } from '../../../src/rbac/repositories/rbac.repository';

function makeRepo() {
  const mockPrisma: any = {
    role: { findFirst: jest.fn() },
    userRoleAssignment: { deleteMany: jest.fn() },
  };
  return { repo: new RbacRepository(mockPrisma), mockPrisma };
}

describe('RbacRepository — findRoleByCode', () => {
  it('returns active role when found', async () => {
    const { repo, mockPrisma } = makeRepo();
    const role = { id: BigInt(10), code: 'group_owner' };
    mockPrisma.role.findFirst.mockResolvedValue(role);

    const result = await repo.findRoleByCode('group_owner');

    expect(result).toEqual(role);
    expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
      where: { code: 'group_owner', status: 'active' },
    });
  });

  it('returns null when role not found', async () => {
    const { repo, mockPrisma } = makeRepo();
    mockPrisma.role.findFirst.mockResolvedValue(null);

    expect(await repo.findRoleByCode('nonexistent')).toBeNull();
  });
});

describe('RbacRepository — revokeOwnerRoleInGroup', () => {
  it('deletes the exact user/group/role assignment', async () => {
    const { repo, mockPrisma } = makeRepo();
    mockPrisma.userRoleAssignment.deleteMany.mockResolvedValue({ count: 1 });

    await repo.revokeOwnerRoleInGroup(BigInt(1), BigInt(2), BigInt(3));

    expect(mockPrisma.userRoleAssignment.deleteMany).toHaveBeenCalledWith({
      where: { userId: BigInt(1), groupId: BigInt(2), roleId: BigInt(3) },
    });
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

```bash
npm test -w apps/iam-service -- --testPathPattern="rbac.repository"
# Expect: FAIL — findRoleByCode / revokeOwnerRoleInGroup is not a function
```

- [ ] **Step 4: Thêm 2 methods vào `RbacRepository`**

Thêm sau method `findActiveGroup` (dòng ~34):

```typescript
findRoleByCode(code: string) {
  return this.prisma.role.findFirst({ where: { code, status: 'active' } });
}

revokeOwnerRoleInGroup(userId: RbacId, groupId: RbacId, roleId: RbacId) {
  return this.prisma.userRoleAssignment.deleteMany({
    where: { userId: toPk(userId), groupId: toPk(groupId), roleId: toPk(roleId) },
  });
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

```bash
npm test -w apps/iam-service -- --testPathPattern="rbac.repository"
# Expect: PASS
```

- [ ] **Step 6: Commit**

```bash
git add apps/iam-service/src/modules/group/constants/
git add apps/iam-service/src/rbac/repositories/rbac.repository.ts
git add apps/iam-service/tests/rbac/
git commit -m "feat(iam): add findRoleByCode and revokeOwnerRoleInGroup to RbacRepository"
```

---

## Task 4: Sửa `GroupService` — inject `RbacRepository`, wire grant/revoke

**Files:**
- Modify: `apps/iam-service/src/modules/group/admin/services/group.service.ts`
- Modify: `apps/iam-service/tests/modules/group/admin/services/group.service.spec.ts`

**Ghi chú về cascade:** `UserRoleAssignment.group` có `onDelete: Cascade` → khi group bị xóa, DB tự xóa assignment. Chỉ cần `clearAllUserCaches` cho owner sau khi delete.

- [ ] **Step 1: Cập nhật `group.service.spec.ts` — thêm `rbacRepo` mock và các test mới**

**Thêm mock module** vào đầu file (sau các `jest.mock` hiện có):

```typescript
jest.mock('../../../../../src/modules/group/constants/group-owner.constants', () => ({
  GROUP_OWNER_ROLE_CODE: 'group_owner',
}), { virtual: true });
```

**Thay `createService` function** (dòng 78-87):

```typescript
function createService(overrides: Record<string, any> = {}) {
  const repo = overrides.repo ?? makeMockRepo();
  const rbacCache = overrides.rbacCache ?? {
    bumpVersion: jest.fn().mockResolvedValue(undefined),
    clearAllUserCaches: jest.fn().mockResolvedValue(undefined),
  };
  const rbacRepo = overrides.rbacRepo ?? {
    findRoleByCode: jest.fn().mockResolvedValue({ id: BigInt(99) }),
    assignRoleToUser: jest.fn().mockResolvedValue({ count: 1 }),
    revokeOwnerRoleInGroup: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const i18n = {} as any;
  const service = new GroupService(repo as any, rbacCache as any, rbacRepo as any, i18n);
  return { service, repo, rbacCache, rbacRepo };
}
```

**Thêm test cases** vào cuối describe('GroupService') block:

```typescript
  describe('create — owner role', () => {
    it('grants group_owner role after creation when ownerId provided', async () => {
      const { service, repo, rbacRepo, rbacCache } = createService();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: BigInt(5) });

      await service.create({ type: 'team', code: 'x', name: 'X', contextId: '1', ownerId: '50' } as any);

      expect(rbacRepo.assignRoleToUser).toHaveBeenCalledWith(BigInt(50), BigInt(99), BigInt(5));
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(50));
    });

    it('does NOT assign role when ownerId not provided', async () => {
      const { service, repo, rbacRepo } = createService();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: BigInt(5) });

      await service.create({ type: 'team', code: 'x', name: 'X', contextId: '1' } as any);

      expect(rbacRepo.assignRoleToUser).not.toHaveBeenCalled();
    });

    it('skips assignment when role code not found in DB', async () => {
      const { service, repo, rbacRepo, rbacCache } = createService();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: BigInt(5) });
      rbacRepo.findRoleByCode.mockResolvedValue(null);

      await service.create({ type: 'team', code: 'x', name: 'X', contextId: '1', ownerId: '50' } as any);

      expect(rbacRepo.assignRoleToUser).not.toHaveBeenCalled();
      expect(rbacCache.clearAllUserCaches).not.toHaveBeenCalled();
    });
  });

  describe('update — owner role', () => {
    it('grants to new owner and revokes from old when ownerId changes', async () => {
      const { service, repo, rbacRepo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: BigInt(10) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { ownerId: '20' } as any);

      expect(rbacRepo.assignRoleToUser).toHaveBeenCalledWith(BigInt(20), BigInt(99), BigInt(1));
      expect(rbacRepo.revokeOwnerRoleInGroup).toHaveBeenCalledWith(BigInt(10), BigInt(1), BigInt(99));
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(20));
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(10));
    });

    it('only revokes old owner when ownerId set to null', async () => {
      const { service, repo, rbacRepo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: BigInt(10) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { ownerId: null } as any);

      expect(rbacRepo.assignRoleToUser).not.toHaveBeenCalled();
      expect(rbacRepo.revokeOwnerRoleInGroup).toHaveBeenCalledWith(BigInt(10), BigInt(1), BigInt(99));
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(10));
    });

    it('only grants to new owner when group had no previous owner', async () => {
      const { service, repo, rbacRepo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: null });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { ownerId: '30' } as any);

      expect(rbacRepo.assignRoleToUser).toHaveBeenCalledWith(BigInt(30), BigInt(99), BigInt(1));
      expect(rbacRepo.revokeOwnerRoleInGroup).not.toHaveBeenCalled();
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(30));
    });

    it('does NOT touch roles when ownerId not in dto', async () => {
      const { service, repo, rbacRepo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: BigInt(10) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { name: 'New Name' } as any);

      expect(rbacRepo.assignRoleToUser).not.toHaveBeenCalled();
      expect(rbacRepo.revokeOwnerRoleInGroup).not.toHaveBeenCalled();
    });

    it('does NOT touch roles when ownerId value is unchanged', async () => {
      const { service, repo, rbacRepo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: BigInt(10) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { ownerId: '10' } as any);

      expect(rbacRepo.assignRoleToUser).not.toHaveBeenCalled();
      expect(rbacRepo.revokeOwnerRoleInGroup).not.toHaveBeenCalled();
    });
  });

  describe('delete — owner cache', () => {
    it('clears owner cache after deletion', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: BigInt(7) });
      repo.delete.mockResolvedValue({});

      await service.delete(BigInt(1));

      expect(rbacCache.bumpVersion).toHaveBeenCalled();
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(7));
    });

    it('does NOT call clearAllUserCaches when group has no owner', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1), ownerId: null });
      repo.delete.mockResolvedValue({});

      await service.delete(BigInt(1));

      expect(rbacCache.bumpVersion).toHaveBeenCalled();
      expect(rbacCache.clearAllUserCaches).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
npm test -w apps/iam-service -- --testPathPattern="group.service.spec"
# Expect: FAIL — constructor mismatch (3 args thay vì 4)
```

- [ ] **Step 3: Sửa `group.service.ts`**

Thay toàn bộ nội dung file:

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { CrudService, t, getSessionUserId, parseQueryOptions, createPaginationMeta } from '@package/common';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { GroupRepository } from '../../repositories/group.repository';
import { RbacCacheService } from '../../../../rbac/services/rbac-cache.service';
import { RbacRepository } from '../../../../rbac/repositories/rbac.repository';
import { CreateGroupDto } from '../dtos/create-group.dto';
import { UpdateGroupDto } from '../dtos/update-group.dto';
import { AddMemberDto } from '../dtos/add-member.dto';
import { GROUP_OWNER_ROLE_CODE } from '../../constants/group-owner.constants';

@Injectable()
export class GroupService extends CrudService<GroupRepository> {
  private cachedOwnerRoleId: bigint | null | undefined = undefined;

  constructor(
    groupRepo: GroupRepository,
    private readonly rbacCache: RbacCacheService,
    private readonly rbacRepo: RbacRepository,
    private readonly i18n: I18nService,
  ) {
    super(groupRepo);
  }

  private async getOwnerRoleId(): Promise<bigint | null> {
    if (this.cachedOwnerRoleId !== undefined) return this.cachedOwnerRoleId;
    const role = await this.rbacRepo.findRoleByCode(GROUP_OWNER_ROLE_CODE);
    this.cachedOwnerRoleId = role?.id ?? null;
    return this.cachedOwnerRoleId;
  }

  private async grantOwnerRole(userId: bigint, groupId: bigint): Promise<void> {
    const roleId = await this.getOwnerRoleId();
    if (!roleId) return;
    await this.rbacRepo.assignRoleToUser(userId, roleId, groupId);
  }

  private async revokeOwnerRole(userId: bigint, groupId: bigint): Promise<void> {
    const roleId = await this.getOwnerRoleId();
    if (!roleId) return;
    await this.rbacRepo.revokeOwnerRoleInGroup(userId, groupId, roleId);
  }

  async getOne(id: any) {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException(t(this.i18n, 'group.NOT_FOUND'));
    return item;
  }

  async create(dto: CreateGroupDto) {
    const existing = await this.repository.findByCode(dto.code);
    if (existing) throw new ConflictException(t(this.i18n, 'group.CODE_EXISTS'));
    const actorId = getSessionUserId();
    const data: any = {
      type: dto.type,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      contextId: dto.contextId,
      createdUserId: actorId,
    };
    if (dto.ownerId) data.ownerId = dto.ownerId;
    const newGroup = await this.repository.create(data);
    if (dto.ownerId) {
      const ownerId = toPrimaryKey(dto.ownerId);
      await this.grantOwnerRole(ownerId, newGroup.id);
      await this.rbacCache.clearAllUserCaches(ownerId);
    }
    return newGroup;
  }

  async update(id: PrimaryKey, dto: UpdateGroupDto) {
    const group = await this.getOne(id);
    const actorId = getSessionUserId();
    const data: any = { updatedUserId: actorId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;

    if ('ownerId' in dto) {
      data.ownerId = dto.ownerId ? dto.ownerId : null;
      const oldOwnerId = group.ownerId ? toPrimaryKey(group.ownerId) : null;
      const newOwnerId = dto.ownerId ? toPrimaryKey(dto.ownerId) : null;
      const ownerChanged = String(oldOwnerId ?? '') !== String(newOwnerId ?? '');
      if (ownerChanged) {
        if (newOwnerId) {
          await this.grantOwnerRole(newOwnerId, toPrimaryKey(id));
          await this.rbacCache.clearAllUserCaches(newOwnerId);
        }
        if (oldOwnerId) {
          await this.revokeOwnerRole(oldOwnerId, toPrimaryKey(id));
          await this.rbacCache.clearAllUserCaches(oldOwnerId);
        }
      }
    }

    const result = await this.repository.update(id, data);
    if (dto.status !== undefined) {
      await this.rbacCache.bumpVersion();
    }
    return result;
  }

  async delete(id: PrimaryKey) {
    const group = await this.getOne(id);
    await this.repository.delete(id);
    await this.rbacCache.bumpVersion();
    if (group.ownerId) {
      await this.rbacCache.clearAllUserCaches(toPrimaryKey(group.ownerId));
    }
    return { message: t(this.i18n, 'group.DELETED') };
  }

  async getMembers(id: PrimaryKey, query: any) {
    await this.getOne(id);
    const options = parseQueryOptions(query);
    const [data, total] = await Promise.all([
      this.repository.getMembers(id, options.skip, options.take),
      this.repository.countMembers(id),
    ]);
    return { data, meta: createPaginationMeta(options, total) };
  }

  async addMember(id: PrimaryKey, dto: AddMemberDto) {
    await this.getOne(id);
    await this.repository.addMember(id, dto.userId);
    await this.rbacCache.clearAllUserCaches(dto.userId);
    return { message: t(this.i18n, 'group.MEMBER_ADDED') };
  }

  async removeMember(id: PrimaryKey, userId: PrimaryKey) {
    await this.getOne(id);
    await this.repository.removeMember(id, userId);
    await this.rbacCache.clearAllUserCaches(userId);
    return { message: t(this.i18n, 'group.MEMBER_REMOVED') };
  }
}
```

- [ ] **Step 4: Chạy toàn bộ test iam-service**

```bash
npm test -w apps/iam-service
# Expect: tất cả PASS
```

- [ ] **Step 5: Commit**

```bash
git add apps/iam-service/src/modules/group/
git add apps/iam-service/tests/modules/group/admin/services/group.service.spec.ts
git commit -m "feat(iam): auto-assign group_owner role on group ownership changes"
```

---

## Self-review checklist

- [x] Permission `group.owner` thêm vào seed JSON — không cần migration, không cần API call
- [x] Role `group_owner` đã tồn tại trong seed — chỉ cần thêm `group.owner` vào `ownerPermCodes`
- [x] Menu 3 entries — parent + 2 con — đủ theo yêu cầu (thông tin nhóm + danh sách thành viên)
- [x] Menu dùng `parent_code` — đúng pattern của menu seeder hiện có
- [x] `GROUP_OWNER_ROLE_CODE = 'group_owner'` — đúng code của role trong seed
- [x] `RbacModule` là `@Global()` → không cần sửa `GroupModule` imports
- [x] Cascade delete xử lý `UserRoleAssignment` tự động — không cần revoke thủ công khi xóa group
- [x] Lazy cache `cachedOwnerRoleId` — tránh query DB lặp lại
- [x] `String()` comparison cho BigInt null-safe — tránh `BigInt !== BigInt` pitfall
- [x] Test coverage: create (có/không ownerId, role không tìm thấy), update (5 cases), delete (có/không owner)
