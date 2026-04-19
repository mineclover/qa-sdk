// @def.boundary gate-system
// @def.doc gate-system

import { createLogger as _createLogger, type Logger } from "@qa-sdk/core";
import { createIngestForwarder } from "@qa-sdk/logger";

const ingestEndpoint = process.env["QA_INGEST_ENDPOINT"];

export function createLogger(name: string): Logger {
  if (!ingestEndpoint) return _createLogger(name);
  return _createLogger(name, {
    destinations: [{
      stream: createIngestForwarder({ endpoint: ingestEndpoint, serviceName: name }),
      level: "info",
    }],
  });
}

export type { Logger } from "@qa-sdk/core";
