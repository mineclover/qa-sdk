// @def.boundary ingest-system
// @def.doc ingest-system

import type { ErrorHandler } from 'hono';
import { isCodecContractError } from '@qa-sdk/core';
import { AppError } from '../lib/errors.js';
import { ZodError } from 'zod';
import type { Logger } from 'pino';

export function createErrorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.statusCode as 400 | 404 | 500,
      );
    }

    // 좌표 계약 오류 (ADR-010): 손상된 envelope은 400, 판정이 확정된 계약 위반은 422
    if (isCodecContractError(err)) {
      return c.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        err.code === 'CorruptEnvelope' ? 400 : 422,
      );
    }

    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: err.errors
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; '),
          },
        },
        400,
      );
    }

    logger.error(
      {
        err,
        requestId: c.res.headers.get('x-request-id'),
      },
      'unhandled error',
    );
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'internal server error' } }, 500);
  };
}
