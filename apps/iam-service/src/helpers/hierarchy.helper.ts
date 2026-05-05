import { BadRequestException } from '@nestjs/common';

/**
 * Asserts that setting `parentId` as the parent of `id` does not create a cycle
 * in the hierarchy. Walks up the parent chain from `parentId` and throws if it
 * ever reaches `id` (which would form a loop).
 */
export async function assertNoCycle(
  id: string | bigint,
  parentId: string | bigint,
  getParentId: (id: bigint) => Promise<bigint | null>,
  errorMessage: string,
): Promise<void> {
  if (String(id) === String(parentId)) {
    throw new BadRequestException(errorMessage);
  }
  const visited = new Set<string>();
  let cur: bigint | null = typeof parentId === 'bigint' ? parentId : BigInt(parentId);
  while (cur != null) {
    const key = String(cur);
    if (visited.has(key)) break;
    visited.add(key);
    if (String(cur) === String(id)) {
      throw new BadRequestException(errorMessage);
    }
    cur = await getParentId(cur);
  }
}
