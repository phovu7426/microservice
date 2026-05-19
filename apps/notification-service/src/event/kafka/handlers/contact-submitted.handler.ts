import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';
import { MailService } from '../../../modules/mail/services/mail.service';

@Injectable()
export class ContactSubmittedHandler implements KafkaHandler {
  constructor(
    @InjectQueue('notification') private readonly notifQueue: Queue,
    private readonly mailService: MailService,
  ) {}

  async handle(payload: any) {
    const adminEmail = this.mailService.getAdminEmail();
    if (!adminEmail) return;

    const safeVars = {
      name: typeof payload?.name === 'string' ? payload.name : '',
      email: typeof payload?.email === 'string' ? payload.email : '',
      phone: typeof payload?.phone === 'string' ? payload.phone : '',
      subject: typeof payload?.subject === 'string' ? payload.subject : '',
      message: typeof payload?.message === 'string' ? payload.message : '',
    };

    await this.notifQueue.add(
      'send_email_template',
      {
        templateCode: 'contact_submitted',
        options: { to: adminEmail, variables: safeVars },
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
        jobId: payload?.event_id ?? payload?.id ?? undefined,
      },
    );
  }
}
