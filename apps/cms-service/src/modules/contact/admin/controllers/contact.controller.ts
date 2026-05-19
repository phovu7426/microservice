import { Controller, Get, Param, Query, Patch, Body } from '@nestjs/common';
import { Permission, session } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminContactService } from '../services/contact.service';
import { ReplyContactDto } from '../dtos/reply-contact.dto';
import { ListContactsAdminQueryDto } from '../dtos/list-contacts.query.dto';

@Controller('admin/contacts')
export class AdminContactController {
  constructor(
    private readonly contactService: AdminContactService,
  ) {}

  @Permission('cms.contact.manage')
  @Get()
  async getList(@Query() query: ListContactsAdminQueryDto) {
    return this.contactService.getList(query);
  }

  @Permission('cms.contact.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.contactService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.contact.manage')
  @Patch(':id/reply')
  async reply(
    @Param('id') id: string,
    @Body() body: ReplyContactDto,
  ) {
    const ctx = session()!;
    const actorId = ctx.userId ? toPrimaryKey(ctx.userId) : undefined;
    return this.contactService.reply(toPrimaryKey(id), body.reply, actorId);
  }

  @Permission('cms.contact.manage')
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.contactService.markAsRead(toPrimaryKey(id));
  }

  @Permission('cms.contact.manage')
  @Patch(':id/close')
  async closeContact(@Param('id') id: string) {
    return this.contactService.closeContact(toPrimaryKey(id));
  }
}
