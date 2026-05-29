import { SetMetadata } from '@nestjs/common';

export const PERMS_KEY = 'perms_required';

export const Permission = (...permissions: string[]) =>
  SetMetadata(PERMS_KEY, permissions);

export const Public = () => SetMetadata(PERMS_KEY, ['public']);

export const Internal = () => SetMetadata(PERMS_KEY, ['internal']);

// Route chi yeu cau user da dang nhap (JWT hop le), KHONG check permission cu the.
// JwtGuard van verify token nhu route bao mat thong thuong; RbacGuard skip IAM call.
export const Authenticated = () => SetMetadata(PERMS_KEY, ['authenticated']);
