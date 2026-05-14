export enum TemplateStatus {
  active = 'active',
  inactive = 'inactive',
}

export const TemplateStatusOptions = [
  { value: TemplateStatus.active, label: 'Hoạt động' },
  { value: TemplateStatus.inactive, label: 'Ngừng hoạt động' },
];
