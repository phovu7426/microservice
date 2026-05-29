import { AsyncLocalStorage } from 'async_hooks';
import { SessionContext } from './session-context';

export const sessionContextStorage = new AsyncLocalStorage<SessionContext>();

export function session(): SessionContext | undefined {
  return sessionContextStorage.getStore();
}
