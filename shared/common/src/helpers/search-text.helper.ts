/**
 * Sinh chuỗi searchText từ nhiều trường.
 *
 * Tất cả giá trị được lowercase + trim + join bằng dấu cách.
 * Lưu vào cột search_text trong DB và đánh index để tìm kiếm nhanh.
 *
 * @example
 * buildSearchText('John Doe', 'john@email.com', 'johndoe', '0912345678')
 * // → "john doe john@email.com johndoe 0912345678"
 */
export function buildSearchText(...fields: (string | null | undefined)[]): string {
  return fields
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .map(f => f.trim().toLowerCase())
    .join(' ');
}
