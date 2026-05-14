export enum CertificateType {
  iso = 'iso',
  quality = 'quality',
  safety = 'safety',
  environment = 'environment',
  other = 'other',
}

export const CertificateTypeOptions = [
  { value: CertificateType.iso, label: 'ISO' },
  { value: CertificateType.quality, label: 'Chất lượng' },
  { value: CertificateType.safety, label: 'An toàn' },
  { value: CertificateType.environment, label: 'Môi trường' },
  { value: CertificateType.other, label: 'Khác' },
];
