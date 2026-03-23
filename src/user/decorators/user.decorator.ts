import {
  ExecutionContext,
  createParamDecorator,
} from '@nestjs/common';

import { BackendException } from '@app/shared/exceptions/backend.exception';
import { ExpressRequestInterface } from '@app/types/expressRequest.interface';
import { UserEntity } from '../user.entity';

export const User = createParamDecorator(
  (data: any, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest<ExpressRequestInterface>();
    if (!request.user) {
      throw BackendException.unauthorized('Unauthorized');
    }
    if (data) {
      return request.user[data];
    }
    return request.user;
  },
);
