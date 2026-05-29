export interface MailSendEvent {
  to: string;
  templateCode: string;
  variables?: Record<string, unknown>;
}

export const MAIL_SEND_TOPIC = 'mail.send';
