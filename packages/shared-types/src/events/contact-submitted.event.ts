export interface ContactSubmittedEvent {
  name: string;
  email: string;
  subject: string;
  message: string;
  admin_email?: string;
}

export const CONTACT_SUBMITTED_TOPIC = 'contact.submitted';
