import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContactRepository } from '../../repositories/contact.repository';
import { CreateContactDto } from '../../admin/dtos/create-contact.dto';

@Injectable()
export class PublicContactService {
  private readonly logger = new Logger(PublicContactService.name);

  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateContactDto) {
    const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');

    const contactData = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: dto.message,
    };

    const contact = await this.contactRepo.withTransaction(async (tx) => {
      const created = await this.contactRepo.create(contactData, tx);

      if (kafkaEnabled) {
        await this.contactRepo.createOutbox(
          'contact.submitted',
          {
            // Stringify BigInt — payloads > 2^53 silently corrupt as Number.
            contact_id: String(created.id),
            name: created.name,
            email: created.email,
            phone: created.phone,
            message: created.message,
            created_at: created.createdAt.toISOString(),
          },
          tx,
        );
      }

      return created;
    });

    return {
      success: true,
      message: 'Contact submitted successfully',
      data: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        created_at: contact.createdAt,
      },
    };
  }
}
