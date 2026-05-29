export interface UserRegisteredEvent {
  user_id: string;
  email: string;
  username: string;
}

export interface UserPasswordResetEvent {
  user_id: string;
  email: string;
}

export const USER_REGISTERED_TOPIC = 'user.registered';
export const USER_PASSWORD_RESET_TOPIC = 'user.password.reset';
