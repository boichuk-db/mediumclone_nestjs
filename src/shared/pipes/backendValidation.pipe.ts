import {
  ArgumentMetadata,
  HttpStatus,
  PipeTransform,
} from '@nestjs/common';
import { ValidationError, validate } from 'class-validator';

import { plainToInstance } from 'class-transformer';
import { BackendException } from '@app/shared/exceptions/backend.exception';

export class BackendValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (!metadata.metatype || !this.toValidate(metadata.metatype)) {
      return value;
    }

    const object = plainToInstance(metadata.metatype, value ?? {});
    const errors = await validate(object, { forbidUnknownValues: false });

    if (errors.length === 0) {
      return value;
    }

    throw new BackendException(
      this.formatErrors(errors),
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  private formatErrors(errors: ValidationError[]): Record<string, string[]> {
    return errors.reduce<Record<string, string[]>>((acc, error) => {
      const constraints = Object.values(error.constraints ?? {}).map(
        (message) => message.replace('should not be empty', "can't be empty"),
      );

      if (constraints.length > 0) {
        const key = error.property || 'body';
        acc[key] = constraints;
      }

      return acc;
    }, {});
  }

  private toValidate(metatype: ArgumentMetadata['metatype']): boolean {
    const types: Array<Function> = [String, Boolean, Number, Array, Object];
    return metatype ? !types.includes(metatype) : false;
  }
}
