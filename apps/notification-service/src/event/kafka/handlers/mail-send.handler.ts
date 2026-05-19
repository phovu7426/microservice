import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;
const TEMPLATE_CODE_RE = /^[a-z][a-z0-9_]{1,80}$/;
const MAX_TEMPLATE_RECIPIENTS = 50;

@Injectable()
export class MailSendHandler implements KafkaHandler {
  constructor(@InjectQueue('notification') private readonly notifQueue: Queue) {}

  async handle(payload: any) {
    const { to, templateCode, variables, event_id } = payload ?? {};
    if (!templateCode || typeof templateCode !== 'string' || !TEMPLATE_CODE_RE.test(templateCode)) return;

    const recipients = this.normalizeRecipients(to);
    if (!recipients.length || recipients.length > MAX_TEMPLATE_RECIPIENTS) return;

    await this.notifQueue.add(
      'send_email_template',
      {
        templateCode,
        options: { to: recipients, variables: variables || {} },
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
        jobId: event_id ?? undefined,
      },
    );
  }

  private normalizeRecipients(input: unknown): string[] {
    const list = Array.isArray(input) ? input : input == null ? [] : [input];
    return list
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && v.length <= 320 && EMAIL_RE.test(v));
  }
}
