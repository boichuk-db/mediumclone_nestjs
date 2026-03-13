import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';

import { ExpressRequestInterface } from '@app/types/expressRequest.interface';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}
  async use(req: ExpressRequestInterface, res: Response, next: NextFunction) {
    if (!req.headers.authorization) {
      req.user = undefined;
      next();
      return;
    }
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userService.findById(decoded.id);
      req.user = user;
      return next();
    } catch (error) {
      req.user = undefined;
      return next();
    }
  }
}
