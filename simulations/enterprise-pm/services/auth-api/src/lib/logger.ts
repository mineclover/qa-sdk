// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { createLogger as _createLogger } from '@qa-sdk/core';
import type { Logger } from '@qa-sdk/core';
import { createIngestForwarder } from '@qa-sdk/logger';
import { env } from '../config/env.js';

/**
 * 시뮬 auth-api 전용 logger — IngestForwarder를 옵션 부착.
 *
 * - QA_INGEST_URL set → IngestForwarder 활성화 → ingest-server(3200)로 forward
 * - 미set → 표준 pino logger만
 *
 * 모든 도메인 모듈은 createLogger("sim-auth-api.<sub>")로 sub-namespace 사용.
 */
export function createLogger(name: string): Logger {
  if (!env.QA_INGEST_URL) return _createLogger(name);
  return _createLogger(name, {
    destinations: [
      {
        stream: createIngestForwarder({ endpoint: env.QA_INGEST_URL, serviceName: name }),
        level: 'info',
      },
    ],
  });
}

export type { Logger } from '@qa-sdk/core';
