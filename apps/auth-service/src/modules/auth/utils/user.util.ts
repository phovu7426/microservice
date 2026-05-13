export function safeUser<T extends { password?: any; rememberToken?: any }>(
  user: T,
) {
  const {
    password: _password,
    rememberToken: _rememberToken,
    ...rest
  } = user as any;
  return rest as Omit<T, 'password' | 'rememberToken'>;
}
