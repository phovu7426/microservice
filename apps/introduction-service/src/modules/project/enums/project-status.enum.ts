export enum ProjectStatus {
  planning = 'planning',
  in_progress = 'in_progress',
  completed = 'completed',
  cancelled = 'cancelled',
}

export const ProjectStatusOptions = [
  { value: ProjectStatus.planning, label: 'Lên kế hoạch' },
  { value: ProjectStatus.in_progress, label: 'Đang thực hiện' },
  { value: ProjectStatus.completed, label: 'Hoàn thành' },
  { value: ProjectStatus.cancelled, label: 'Đã hủy' },
];
