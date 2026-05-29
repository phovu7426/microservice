export interface UserRegisteredEvent {
    user_id: string;
    email: string;
    username: string;
}
export interface UserPasswordResetEvent {
    user_id: string;
    email: string;
}
export declare const USER_REGISTERED_TOPIC = "user.registered";
export declare const USER_PASSWORD_RESET_TOPIC = "user.password.reset";
