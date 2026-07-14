// @def.boundary sim-gateway
// @def.doc sim-erp-pm-design

import { createLogger as _createLogger } from '@qa-sdk/core';
import type { Logger } from '@qa-sdk/core';
import { createIngestForwarder } from '@qa-sdk/logger';
import { env } from '../config/env.js';

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
