// @def.boundary registry-system
// @def.doc registry-system

import { ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppError, fromIndexMetaError } from '../../lib/errors.js';

@Catch()
export class PrefixExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrefixExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { send(body: unknown): unknown };
    }>();

    if (exception instanceof AppError) {
      return response.status(exception.statusCode).send({
        error: {
          code: exception.code,
          message: exception.message,
        },
      });
    }

    if (exception instanceof ZodError) {
      return response.status(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: exception.errors
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        },
      });
    }

    const mapped = fromIndexMetaError(exception);
    if (mapped) {
      return response.status(mapped.statusCode).send({
        error: {
          code: mapped.code,
          message: mapped.message,
        },
      });
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
    );

    return response.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'internal server error',
      },
    });
  }
}
