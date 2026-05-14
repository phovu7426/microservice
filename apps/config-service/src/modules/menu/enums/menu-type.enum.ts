export enum MenuType {
  route = 'route',
  group = 'group',
  link = 'link',
}

export const MenuTypeOptions = [
  { value: MenuType.route, label: 'Route (Nội bộ)' },
  { value: MenuType.group, label: 'Group (Nhóm)' },
  { value: MenuType.link, label: 'Link (Bên ngoài)' },
];
