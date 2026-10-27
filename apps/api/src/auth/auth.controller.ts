import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { auth } from './auth';

@Controller('auth')
export class AuthController {
  @All('*')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    return toNodeHandler(auth)(req, res);
  }
}
