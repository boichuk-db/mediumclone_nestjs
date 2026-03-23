import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { BackendException } from '@app/shared/exceptions/backend.exception';
import { ExpressRequestInterface } from '@app/types/expressRequest.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ExpressRequestInterface>();
    if (request.user) {
      return true;
    }
    throw BackendException.unauthorized('Unauthorized');
  }
}
