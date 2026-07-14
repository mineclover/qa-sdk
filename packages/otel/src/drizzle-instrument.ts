// @def.boundary observability-system-root
// @def.doc observability-system-root

import { context, trace, SpanKind, SpanStatusCode, type Tracer } from '@opentelemetry/api';

const DB_SYSTEM = 'postgresql';
const TRACER_NAME = '@qa-sdk/otel/drizzle';

/**
 * Drizzle DB 인스턴스의 쿼리 메서드(select, insert, update, delete)를 Proxy로 감싸서
 * 각 쿼리 실행 시 OTel span을 자동 생성한다.
 *
 * postgres.js는 auto-instrumentation이 없으므로 Drizzle 레벨에서 계측한다.
 *
 * @example
 * const db = createDb(url);
 * const instrumentedDb = withQueryTracing(db);
 * // 이후 instrumentedDb.select().from(table) 호출 시 자동으로 span이 생성됨
 */
export function withQueryTracing<T extends object>(db: T): T {
  const tracer = trace.getTracer(TRACER_NAME);

  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof prop === 'string' && isQueryMethod(prop) && typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = value.apply(target, args);
          // Drizzle 쿼리 빌더는 체이닝 후 then()에서 실행됨
          // 최종 실행을 가로채기 위해 반환된 빌더도 Proxy로 감싸서 then/execute를 계측
          if (result && typeof result === 'object') {
            return wrapQueryBuilder(result, prop, tracer);
          }
          return result;
        };
      }

      return value;
    },
  });
}

const QUERY_METHODS = new Set(['select', 'insert', 'update', 'delete', 'execute']);

function isQueryMethod(name: string): boolean {
  return QUERY_METHODS.has(name);
}

/**
 * Drizzle 쿼리 빌더의 then()을 감싸서 실제 쿼리 실행 시 span을 생성한다.
 */
function wrapQueryBuilder(
  builder: Record<string, unknown>,
  operation: string,
  tracer: Tracer,
): unknown {
  // then() 호출 = 실제 쿼리 실행 시점
  const originalThen = builder.then;
  if (typeof originalThen === 'function') {
    // eslint-disable-next-line unicorn/no-thenable -- Drizzle 쿼리 빌더의 thenable 패턴을 의도적으로 감싸는 instrumentation
    builder.then = function (
      this: unknown,
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      // 테이블 이름 추출 시도
      const tableName = extractTableName(builder);
      const spanName = tableName ? `db.${operation} ${tableName}` : `db.${operation}`;

      return tracer.startActiveSpan(
        spanName,
        { kind: SpanKind.CLIENT },
        context.active(),
        (span) => {
          span.setAttribute('db.system', DB_SYSTEM);
          span.setAttribute('db.operation', operation);
          if (tableName) {
            span.setAttribute('db.sql.table', tableName);
          }

          return (originalThen as Function).call(
            this,
            (value: unknown) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              return onFulfilled ? onFulfilled(value) : value;
            },
            (reason: unknown) => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: reason instanceof Error ? reason.message : String(reason),
              });
              span.recordException(reason instanceof Error ? reason : new Error(String(reason)));
              span.end();
              if (onRejected) return onRejected(reason);
              throw reason;
            },
          );
        },
      );
    };
  }

  return builder;
}

/** 쿼리 빌더에서 테이블 이름 추출 (best-effort) */
function extractTableName(builder: Record<string, unknown>): string | undefined {
  // Drizzle 내부: _table, table, config.table 등
  const table = (builder as Record<string, Record<string, unknown>>).config?.table;
  if (table && typeof table === 'object') {
    const sym = Object.getOwnPropertySymbols(table).find((s) => s.description === 'drizzle:Name');
    if (sym) return String((table as Record<symbol, unknown>)[sym]);
  }

  // fallback: _?.tableName
  const tableName = (builder as Record<string, Record<string, unknown>>)._?.tableName;
  if (typeof tableName === 'string') return tableName;

  return undefined;
}
