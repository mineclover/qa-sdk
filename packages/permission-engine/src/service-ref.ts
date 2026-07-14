// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

/**
 * service-ref.ts — 서비스 참조 + SDK 글로벌 컨텍스트.
 *
 * permission code의 앞부분에 위치하는 서비스 식별자를 관리한다.
 * (namespace, name)은 필수, (env, build, region)은 SDK가 일괄 설정하여 숨긴다.
 *
 * 전체 permission address:
 *   [service-ref] . [type] . [resource] . [action]
 *
 * service-ref 내부 구조:
 *   {namespace}/{name}  (canonical form)
 *   + env, build, region (SDK context — 직렬화 시 숨김)
 *
 * SDK 초기화 시 한 번 설정하면 이후 모든 permission 연산에 자동 적용된다.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * 서비스 식별자 (필수).
 *
 * @note `@qa-sdk/core`의 `ServiceBootConfig`과 구조적으로 호환.
 *   TypeScript structural typing으로 `ServiceBootConfig` 값이
 *   `ServiceIdentity`/`ServiceRef`로 자동 할당 가능.
 */
export interface ServiceIdentity {
  /** 서비스 네임스페이스. 예: "shop", "cms" */
  readonly namespace: string;
  /** 서비스 이름. 예: "payment", "auth", "gateway" */
  readonly name: string;
}

/** SDK가 일괄 설정하는 배포 컨텍스트 (선택). */
export interface DeployContext {
  /** 환경. 예: "dev", "stage", "prod" */
  readonly env?: string;
  /** 빌드/버전 식별자. 예: "v2.3.1", "canary" */
  readonly build?: string;
  /** 리전. 예: "asia", "us-east-1" */
  readonly region?: string;
}

/** 전체 서비스 참조. */
export interface ServiceRef extends ServiceIdentity {
  readonly env?: string;
  readonly build?: string;
  readonly region?: string;
}

/** 직렬화 옵션. */
export interface ServiceRefFormatOptions {
  /** 배포 컨텍스트 포함 여부. 기본 false (SDK가 숨김). */
  includeContext?: boolean;
}

// ── Validation ───────────────────────────────────────────────────────────────

const IDENT_RE = /^[a-z][a-z0-9_-]*$/;

/** service identity 검증. */
export function validateServiceIdentity(id: ServiceIdentity): string[] {
  const errors: string[] = [];
  if (!id.namespace || !IDENT_RE.test(id.namespace)) {
    errors.push(`namespace "${id.namespace}" — [a-z][a-z0-9_-]* 필요`);
  }
  if (!id.name || !IDENT_RE.test(id.name)) {
    errors.push(`name "${id.name}" — [a-z][a-z0-9_-]* 필요`);
  }
  return errors;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** ServiceRef → canonical 문자열. */
export function formatServiceRef(ref: ServiceRef, opts: ServiceRefFormatOptions = {}): string {
  const base = `${ref.namespace}/${ref.name}`;
  if (!opts.includeContext) return base;

  // 컨텍스트 포함: namespace/name@env.region.build
  const parts: string[] = [];
  if (ref.env) parts.push(ref.env);
  if (ref.region) parts.push(ref.region);
  if (ref.build) parts.push(ref.build);
  return parts.length > 0 ? `${base}@${parts.join('.')}` : base;
}

/** canonical 문자열 → ServiceRef 파싱. */
export function parseServiceRef(raw: string): ServiceRef {
  // format: namespace/name  또는  namespace/name@env.region.build
  const atIdx = raw.indexOf('@');
  const identPart = atIdx >= 0 ? raw.slice(0, atIdx) : raw;
  const ctxPart = atIdx >= 0 ? raw.slice(atIdx + 1) : '';

  const slashIdx = identPart.indexOf('/');
  if (slashIdx < 0) {
    throw new RangeError(`Invalid service-ref "${raw}": namespace/name 형식 필요`);
  }

  const namespace = identPart.slice(0, slashIdx);
  const name = identPart.slice(slashIdx + 1);

  const errors = validateServiceIdentity({ namespace, name });
  if (errors.length > 0) {
    throw new RangeError(`Invalid service-ref "${raw}": ${errors.join('; ')}`);
  }

  const ref: ServiceRef = { namespace, name };
  if (ctxPart) {
    const ctxParts = ctxPart.split('.');
    return {
      ...ref,
      env: ctxParts[0] || undefined,
      region: ctxParts[1] || undefined,
      build: ctxParts[2] || undefined,
    };
  }
  return ref;
}

// ── SDK Context ──────────────────────────────────────────────────────────────

/**
 * SDK 글로벌 서비스 컨텍스트.
 *
 * 앱 초기화 시 한 번 설정하면 이후 모든 permission 연산에 자동 적용된다.
 * env/build/region은 코드에서 매번 지정할 필요 없이 SDK가 일괄 주입한다.
 *
 * @example
 * const ctx = createServiceContext({
 *   namespace: "shop",
 *   name: "payment",
 *   env: "prod",
 *   region: "asia",
 * });
 *
 * ctx.ref();           // → "shop/payment"
 * ctx.refFull();       // → "shop/payment@prod.asia"
 * ctx.identity;        // → { namespace: "shop", name: "payment" }
 * ctx.deploy;          // → { env: "prod", region: "asia" }
 */
export interface ServiceContext {
  /** 서비스 식별자. */
  readonly identity: ServiceIdentity;
  /** 배포 컨텍스트. */
  readonly deploy: DeployContext;
  /** canonical service-ref (컨텍스트 제외). */
  ref(): string;
  /** 전체 service-ref (컨텍스트 포함). */
  refFull(): string;
}

export function createServiceContext(config: ServiceRef): ServiceContext {
  const errors = validateServiceIdentity(config);
  if (errors.length > 0) {
    throw new RangeError(`Invalid service config: ${errors.join('; ')}`);
  }

  const identity: ServiceIdentity = {
    namespace: config.namespace,
    name: config.name,
  };
  const deploy: DeployContext = {
    env: config.env,
    build: config.build,
    region: config.region,
  };

  return {
    identity,
    deploy,
    ref: () => formatServiceRef(config),
    refFull: () => formatServiceRef(config, { includeContext: true }),
  };
}
