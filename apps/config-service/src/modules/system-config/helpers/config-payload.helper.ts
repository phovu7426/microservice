import { toPrimaryKey } from '../../../types';

export function buildConfigPayload<T extends object>(
  dto: T,
  bigIntFields: string[],
  updatedBy?: any,
  existing?: any,
): any {
  const payload: any = { ...dto };

  bigIntFields.forEach((field) => {
    if (payload[field] !== undefined) {
      payload[field] = payload[field] ? toPrimaryKey(payload[field]) : null;
    }
  });

  if (updatedBy) {
    const pk = toPrimaryKey(updatedBy);
    if (!existing) {
      payload.createdUserId = pk;
    }
    payload.updatedUserId = pk;
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return payload;
}
