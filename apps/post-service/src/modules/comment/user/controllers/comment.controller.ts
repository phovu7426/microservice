import { Controller, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { Authenticated, session } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { UserCommentService } from '../services/comment.service';
import { CreateCommentDto } from '../dtos/create-comment.dto';
import { UpdateCommentDto } from '../dtos/update-comment.dto';

@Controller('user/post-comments')
export class UserCommentController {
  constructor(private readonly commentService: UserCommentService) {}

  @Authenticated()
  @Post()
  async create(@Body() dto: CreateCommentDto) {
    const userId = toPrimaryKey(session()!.userId!);
    return this.commentService.create(userId, dto);
  }

  @Authenticated()
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    const userId = toPrimaryKey(session()!.userId!);
    return this.commentService.update(userId, toPrimaryKey(id), dto.content);
  }

  @Authenticated()
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const userId = toPrimaryKey(session()!.userId!);
    return this.commentService.delete(userId, toPrimaryKey(id));
  }
}
