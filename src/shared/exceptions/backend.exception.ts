import { HttpException, HttpStatus } from '@nestjs/common';

type BackendErrors = Record<string, string[]>;

export class BackendException extends HttpException {
  constructor(errors: BackendErrors, status: number) {
    super({ errors }, status);
  }

  static validation(field: string, message: string): BackendException {
    return new BackendException({ [field]: [message] }, HttpStatus.UNPROCESSABLE_ENTITY);
  }

  static unauthorized(message: string): BackendException {
    return new BackendException({ body: [message] }, HttpStatus.UNAUTHORIZED);
  }

  static notFound(message: string): BackendException {
    return new BackendException({ body: [message] }, HttpStatus.NOT_FOUND);
  }

  static forbidden(message: string): BackendException {
    return new BackendException({ body: [message] }, HttpStatus.FORBIDDEN);
  }

  static badRequest(message: string): BackendException {
    return new BackendException({ body: [message] }, HttpStatus.BAD_REQUEST);
  }
}

