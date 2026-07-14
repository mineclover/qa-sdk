// @def.boundary observability-system-root
// @def.doc observability-system-root

import { trace, type Tracer } from '@opentelemetry/api';

/**
 * 이름으로 OTel Tracer를 얻는다.
 * OTel SDK가 초기화되지 않았으면 no-op tracer를 반환한다.
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
