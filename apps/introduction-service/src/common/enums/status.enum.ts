/**
 * Shared status used by partner / staff / testimonial / gallery / certificate
 * / faq / about. Public services filter on `active` — anything else stays
 * hidden. Allowing arbitrary `string` here let admins write `"active "` /
 * `"actiev"` and silently hide entries.
 */
export enum BasicStatus {
  active = 'active',
  inactive = 'inactive',
  draft = 'draft',
}

export const BasicStatusOptions = [
  { value: BasicStatus.active, label: 'Hoạt động' },
  { value: BasicStatus.inactive, label: 'Ngừng hoạt động' },
  { value: BasicStatus.draft, label: 'Nháp' },
];
