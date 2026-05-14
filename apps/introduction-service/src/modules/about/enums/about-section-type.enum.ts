export enum AboutSectionType {
  general = 'general',
  mission = 'mission',
  vision = 'vision',
  history = 'history',
  values = 'values',
}

export const AboutSectionTypeOptions = [
  { value: AboutSectionType.general, label: 'Tổng quan' },
  { value: AboutSectionType.mission, label: 'Sứ mệnh' },
  { value: AboutSectionType.vision, label: 'Tầm nhìn' },
  { value: AboutSectionType.history, label: 'Lịch sử' },
  { value: AboutSectionType.values, label: 'Giá trị' },
];
