export interface ContactSubmittedEvent {
    name: string;
    email: string;
    subject: string;
    message: string;
    admin_email?: string;
}
export declare const CONTACT_SUBMITTED_TOPIC = "contact.submitted";
