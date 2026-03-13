import {
  ExecutionContext,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';

import { ExpressRequestInterface } from '@app/types/expressRequest.interface';
import { UserEntity } from '../user.entity';

export const User = createParamDecorator(
  (data: any, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest<ExpressRequestInterface>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (data) {
      return request.user[data];
    }
    return request.user;
  },
);
