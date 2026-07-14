// @def.boundary db-traffic-control-spec
// @def.doc db-traffic-control-spec
import type { TrafficController } from './controller.js';
import type { QueryAttributes, QueryOperation } from './types.js';
import {
  extractFingerprint,
  extractOperation,
  extractTable,
  extractTableFromBuilder,
} from './fingerprint.js';

/** withTrafficControl에 전달하는 정적 컨텍스트 */
export interface TrafficControlContext {
  /** 발신 서비스 이름 */
  readonly service?: string;
  /** DB 사용자 */
  readonly dbUser?: string;
  /** 모든 쿼리에 추가할 기본 태그 */
  readonly defaultTags?: Readonly<Record<string, string>>;
}

const QUERY_METHODS = new Set(['select', 'insert', 'update', 'delete']);
const OP_MAP: Record<string, QueryOperation> = {
  select: 'select',
  insert: 'insert',
  update: 'update',
  delete: 'delete',
};

/**
 * Drizzle DB 인스턴스를 Traffic Control aware로 래핑한다.
 *
 * 기존 @qa-sdk/otel의 withQueryTracing과 동일한 Proxy 패턴.
 * 체이닝 가능: withTrafficControl(withQueryTracing(db), controller)
 *
 * 동작:
 * 1. select/insert/update/delete 호출 감지
 * 2. 쿼리 빌더의 .then() (실제 실행 시점)을 가로채기
 * 3. controller.beforeQuery() → 판정
 * 4. enforce + 차단이면 에러 throw
 * 5. 허용이면 원본 쿼리 실행
 * 6. controller.afterQuery() → 메트릭 기록
 * 7. .comment()에 budget 정보 자동 추가
 *
 * @example
 * const controller = new TrafficController({ budgets: [...] });
 * const db = withTrafficControl(rawDb, controller, { service: "ingest-server" });
 */
export function withTrafficControl<T extends object>(
  db: T,
  controller: TrafficController,
  ctx?: TrafficControlContext,
): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof prop === 'string' && QUERY_METHODS.has(prop) && typeof value === 'function') {
        const operation = OP_MAP[prop]!;
        return (...args: unknown[]) => {
          const builder = value.apply(target, args);
          if (builder && typeof builder === 'object') {
            return wrapQueryBuilder(builder as Record<string, unknown>, operation, controller, ctx);
          }
          return builder;
        };
      }

      return value;
    },
  });
}

function wrapQueryBuilder(
  builder: Record<string, unknown>,
  operation: QueryOperation,
  controller: TrafficController,
  ctx?: TrafficControlContext,
): unknown {
  const originalThen = builder.then;
  if (typeof originalThen !== 'function') return builder;

  // .comment() 원본 보존 — 사용자가 설정한 태그와 병합
  const originalComment = builder.comment;
  let userComment: Record<string, string> | string | undefined;

  if (typeof originalComment === 'function') {
    builder.comment = function (this: unknown, arg: unknown) {
      if (typeof arg === 'object' && arg !== null) {
        userComment = arg as Record<string, string>;
      } else if (typeof arg === 'string') {
        userComment = arg;
      }
      // 원본 comment 호출은 then()에서 budget 태그와 병합 후 수행
      return builder;
    };
  }

  // eslint-disable-next-line unicorn/no-thenable
  builder.then = function (
    this: unknown,
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    // 쿼리 속성 추출
    const table = extractTableFromBuilder(builder as Record<string, unknown>);
    const tags = buildTags(ctx, userComment);
    const attrs: QueryAttributes = {
      fingerprint: buildFingerprint(builder, operation, table),
      operation,
      table,
      service: ctx?.service,
      dbUser: ctx?.dbUser,
      tags,
    };

    // traffic control 판정 후 실행
    return executeWithControl(
      builder,
      originalThen as Function,
      originalComment as Function | undefined,
      attrs,
      controller,
      tags,
      onFulfilled,
      onRejected,
    );
  };

  return builder;
}

async function executeWithControl(
  builder: Record<string, unknown>,
  originalThen: Function,
  originalComment: Function | undefined,
  attrs: QueryAttributes,
  controller: TrafficController,
  tags: Record<string, string>,
  onFulfilled?: (value: unknown) => unknown,
  onRejected?: (reason: unknown) => unknown,
): Promise<unknown> {
  const { decision, release } = await controller.beforeQuery(attrs);

  // enforce 모드에서 차단
  if (decision.enforced) {
    const err = new TrafficControlError(
      `쿼리 차단: ${decision.reason} (budget: ${decision.budgetName})`,
      decision,
    );
    if (onRejected) return onRejected(err);
    throw err;
  }

  // .comment()에 budget 태그 추가
  if (typeof originalComment === 'function' && decision.budgetId) {
    const mergedTags = {
      ...tags,
      budget_id: decision.budgetId,
      verdict: decision.verdict,
    };
    // object 형태로 전달 (Drizzle beta.19 sqlcommenter 형식)
    originalComment.call(builder, mergedTags);
  } else if (typeof originalComment === 'function') {
    // budget 미매칭이어도 기본 태그 전달
    if (Object.keys(tags).length > 0) {
      originalComment.call(builder, tags);
    }
  }

  const started = Date.now();

  try {
    const result = await new Promise((resolve, reject) => {
      originalThen.call(
        builder,
        (value: unknown) => resolve(value),
        (reason: unknown) => reject(reason),
      );
    });

    const durationMs = Date.now() - started;
    release();
    controller.afterQuery(attrs, decision, durationMs);

    return onFulfilled ? onFulfilled(result) : result;
  } catch (error) {
    const durationMs = Date.now() - started;
    release();
    controller.afterQuery(attrs, decision, durationMs);

    if (onRejected) return onRejected(error);
    throw error;
  }
}

function buildTags(
  ctx?: TrafficControlContext,
  userComment?: Record<string, string> | string,
): Record<string, string> {
  const tags: Record<string, string> = {};
  if (ctx?.defaultTags) Object.assign(tags, ctx.defaultTags);
  if (typeof userComment === 'object' && userComment !== null) {
    Object.assign(tags, userComment);
  }
  return tags;
}

function buildFingerprint(
  builder: Record<string, unknown>,
  operation: QueryOperation,
  table?: string,
): string {
  // toSQL() 지원 시 실제 SQL에서 fingerprint 추출
  if (typeof (builder as Record<string, Function>).toSQL === 'function') {
    try {
      const sqlResult = (builder as Record<string, Function>).toSQL();
      if (sqlResult && typeof sqlResult.sql === 'string') {
        return extractFingerprint(sqlResult.sql);
      }
    } catch {
      // toSQL 실패 시 fallback
    }
  }

  // fallback: operation + table 기반 대략적 fingerprint
  return table ? `${operation}:${table}` : operation;
}

/** Traffic Control에 의한 쿼리 차단 에러 */
export class TrafficControlError extends Error {
  readonly decision: import('./types.js').QueryDecision;

  constructor(message: string, decision: import('./types.js').QueryDecision) {
    super(message);
    this.name = 'TrafficControlError';
    this.decision = decision;
  }
}
