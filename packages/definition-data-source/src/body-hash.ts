// @def.boundary definition-data-source
// @def.doc definition-data-source

import { createHash } from 'node:crypto';

/** 모든 definition datasource가 공유하는 본문 fingerprint 규칙. */
export function hashDefinitionBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}
