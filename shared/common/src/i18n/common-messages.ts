import * as path from 'path';
import en from './en/common.json';
import vi from './vi/common.json';

export const COMMON_I18N_PATH = path.join(__dirname);

export const COMMON_MESSAGES: Record<string, Record<string, string>> = { en, vi };

export function commonMsg(lang: string, key: string, vars?: Record<string, string>): string {
  const msgs = COMMON_MESSAGES[lang] ?? COMMON_MESSAGES['vi'];
  let msg = msgs[key] ?? COMMON_MESSAGES['vi'][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  return msg;
}
