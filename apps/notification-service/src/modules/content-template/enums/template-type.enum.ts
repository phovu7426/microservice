export enum TemplateType {
  email = 'email',
  telegram = 'telegram',
  zalo = 'zalo',
  sms = 'sms',
}

export const TemplateTypeOptions = [
  { value: TemplateType.email, label: 'Email' },
  { value: TemplateType.telegram, label: 'Telegram' },
  { value: TemplateType.zalo, label: 'Zalo' },
  { value: TemplateType.sms, label: 'SMS' },
];
