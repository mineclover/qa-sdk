// @def.boundary registry-system
// @def.doc registry-system

import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { AppError } from '@qa-sdk/core';

@Catch(AppError)
export class CatalogExceptionFilter implements ExceptionFilter {
  catch(exception: AppError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    return response.status(exception.statusCode).send({
      error: exception.message,
      ...(Object.keys(exception.extras).length > 0 ? exception.extras : {}),
    });
  }
}
