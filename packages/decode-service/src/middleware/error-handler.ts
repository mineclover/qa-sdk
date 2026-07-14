// @def.boundary decode-service-system
// @def.doc decode-service-system

import type { ErrorHandler } from 'hono';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError, fromIndexMetaError } from '../lib/errors.js';
import { IndexMetaError } from 'index-meta-workers';

export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.statusCode as 400 | 404 | 500,
      );
    }

    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          },
        },
        400,
      );
    }

    // index-meta + weighted-index 에러 자동 변환
    const mapped = fromIndexMetaError(err);
    if (mapped.code !== 'INTERNAL_ERROR' || err instanceof IndexMetaError) {
      return c.json(
        { error: { code: mapped.code, message: mapped.message } },
        mapped.statusCode as 400 | 404 | 500,
      );
    }

    logger.error({ err }, 'unhandled error');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'internal server error' } }, 500);
  };
}
