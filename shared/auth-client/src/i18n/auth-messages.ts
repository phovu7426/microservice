import * as path from 'path';
import en from './en/auth.json';
import vi from './vi/auth.json';

export const AUTH_I18N_PATH = path.join(__dirname);

export const AUTH_MESSAGES: Record<string, Record<string, string>> = { en, vi };

export function authMsg(lang: string, key: string): string {
  return AUTH_MESSAGES[lang]?.[key] ?? AUTH_MESSAGES['vi'][key];
}
