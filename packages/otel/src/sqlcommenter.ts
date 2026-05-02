// @def.boundary observability-system-root
// @def.doc observability-system-root

import { context, trace } from "@opentelemetry/api";

/**
 * sqlcommenter 포맷으로 메타데이터 문자열을 빌드한다.
 * 결과물은 Drizzle `.comment()`에 전달하여 SQL 쿼리 끝에 주석으로 추가된다.
 *
 * @example
 * db.select().from(table).comment(buildSqlComment({ service: 'ingest', action: 'findByTrace' }))
 * // SELECT ... /* service='ingest',action='findByTrace' *\/
 */
export function buildSqlComment(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([k, v]) => `${encodeKey(k)}='${encodeValue(v)}'`)
    .join(",");
}

/**
 * 현재 활성 OTel span context에서 traceparent + 커스텀 태그를 합쳐 sqlcommenter 문자열을 빌드한다.
 * OTel이 비활성이면 커스텀 태그만 포함된다.
 */
export function buildSqlCommentWithTrace(tags: Record<string, string>): string {
  const merged = { ...tags };

  const span = trace.getSpan(context.active());
  if (span) {
    const spanContext = span.spanContext();
    if (spanContext.traceId) {
      // W3C traceparent: version-traceId-spanId-traceFlags
      const traceFlags = (spanContext.traceFlags ?? 0).toString(16).padStart(2, "0");
      merged["traceparent"] = `00-${spanContext.traceId}-${spanContext.spanId}-${traceFlags}`;
    }
  }

  return buildSqlComment(merged);
}

/**
 * 어댑터 메서드에서 간편하게 사용할 수 있는 헬퍼.
 *
 * @example
 * .comment(sqlComment("RecordStore", "findByTraceId"))
 */
export function sqlComment(adapter: string, method: string): string {
  return buildSqlCommentWithTrace({ adapter, method });
}

// sqlcommenter spec: URL-encode 특수 문자
function encodeKey(key: string): string {
  return key.replace(/[=,']/g, encodeURIComponent);
}

function encodeValue(value: string): string {
  return value.replace(/'/g, "\\'");
}
