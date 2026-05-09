import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwksService } from '../services/jwks.service';
import { Public } from '@package/common';

@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwksService: JwksService) {}

  @Get('jwks.json')
  @Public()
  async getJwks(@Res() res: Response) {
    const jwks = await this.jwksService.getJwkSet();
    res.json(jwks);
  }
}
