import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { FileLogger } from '@package/bootstrap';
import { MailService, PermanentMailError } from '../../modules/mail/services/mail.service';

@Processor('notification')
export class NotificationProcessor {
  constructor(
    private readonly mail: MailService,
    private readonly fileLogger: FileLogger,
  ) {}

  @Process({ name: 'send_email_template', concurrency: 5 })
  async handleSendEmail(job: Job) {
    const { templateCode, options } = job.data;
    const log = this.fileLogger.create('queue/send-email', {
      jobId: job.id,
      templateCode,
      to: options?.to,
      attempt: job.attemptsMade + 1,
    });

    try {
      log.addDebug('sending template');
      await this.mail.sendTemplate(templateCode, options);
      log.addDebug('sent successfully');
      log.save();
    } catch (err) {
      log.addException(err);
      if (err instanceof PermanentMailError) {
        log.addDebug('permanent failure — not retrying');
        log.save();
        await job.moveToFailed(
          { message: err.message },
          true /* ignoreLock */,
        );
        return;
      }
      log.save();
      throw err;
    }
  }
}
