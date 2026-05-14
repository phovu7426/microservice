export enum PermissionScope {
  context = 'context',
  system = 'system',
}

export const PermissionScopeOptions = [
  { value: PermissionScope.context, label: 'Context' },
  { value: PermissionScope.system, label: 'System' },
];
