/**
 * resource.ts — resource 정규화 + 검증 + 패턴 타입별 규칙.
 *
 * resource는 기능 단위를 식별하는 canonical path-like key이다.
 * 실제 코드 경로와 직관적으로 매핑되지만, 물리 경로 변경에 종속되지 않는
 * 안정적인 식별자로 유지해야 한다.
 *
 * 형식: segment(/segment)*
 * segment: [a-z0-9_-]+  또는  :param (패턴 파라미터)
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** resource 타입. 같은 resource를 type으로 구분한다. */
export type ResourceType = "page" | "api" | "action" | (string & {});

/** 검증 실패 정보. */
export interface ResourceError {
  readonly rule: string;
  readonly message: string;
}

/** 검증 옵션. */
export interface ValidateOptions {
  /** 최대 depth (세그먼트 수). 기본 4. */
  maxDepth?: number;
  /** :param 세그먼트 허용 여부. 기본 true. */
  allowParams?: boolean;
}

/** 파싱된 resource 구조. */
export interface ParsedResource {
  /** 원본 canonical 문자열. */
  readonly raw: string;
  /** `/` 로 분리된 세그먼트 배열. */
  readonly segments: readonly string[];
  /** depth (세그먼트 수). */
  readonly depth: number;
  /** :param 세그먼트가 포함되었는지. */
  readonly hasParams: boolean;
  /** :param 세그먼트 이름 배열. */
  readonly paramNames: readonly string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_RE = /^[a-z0-9_-]+$/;
const PARAM_RE = /^:[a-zA-Z][a-zA-Z0-9_]*$/;

const DEFAULT_MAX_DEPTH = 4;

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * resource 문자열 검증. 실패 시 ResourceError[] 반환, 성공 시 빈 배열.
 */
export function validateResource(
  raw: string,
  opts: ValidateOptions = {},
): ResourceError[] {
  const errors: ResourceError[] = [];
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const allowParams = opts.allowParams ?? true;

  // 빈 문자열
  if (!raw || raw.length === 0) {
    errors.push({ rule: "non-empty", message: "resource는 빈 문자열일 수 없습니다" });
    return errors;
  }

  // leading/trailing slash
  if (raw.startsWith("/")) {
    errors.push({ rule: "no-leading-slash", message: "leading slash 금지" });
  }
  if (raw.endsWith("/")) {
    errors.push({ rule: "no-trailing-slash", message: "trailing slash 금지" });
  }

  // query/fragment
  if (raw.includes("?")) {
    errors.push({ rule: "no-query", message: "query string 금지" });
  }
  if (raw.includes("#")) {
    errors.push({ rule: "no-fragment", message: "fragment 금지" });
  }

  // 공백
  if (/\s/.test(raw)) {
    errors.push({ rule: "no-whitespace", message: "공백 문자 금지" });
  }

  // 연속 슬래시
  if (raw.includes("//")) {
    errors.push({ rule: "no-double-slash", message: "연속 슬래시 금지" });
  }

  if (errors.length > 0) return errors;

  const segments = raw.split("/");

  // depth
  if (segments.length > maxDepth) {
    errors.push({
      rule: "max-depth",
      message: `depth ${segments.length} > 최대 ${maxDepth}`,
    });
  }

  // 각 세그먼트 검증
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.length === 0) {
      errors.push({ rule: "segment-empty", message: `세그먼트 [${i}] 빈 문자열` });
      continue;
    }

    if (seg.startsWith(":")) {
      // param 세그먼트
      if (!allowParams) {
        errors.push({ rule: "no-params", message: `파라미터 세그먼트 금지: "${seg}"` });
      } else if (!PARAM_RE.test(seg)) {
        errors.push({
          rule: "param-format",
          message: `파라미터 형식 오류: "${seg}" (expected :camelCase)`,
        });
      }
    } else {
      // 일반 세그먼트
      if (seg !== seg.toLowerCase()) {
        errors.push({ rule: "lowercase", message: `대문자 금지: "${seg}"` });
      }
      if (!SEGMENT_RE.test(seg)) {
        errors.push({
          rule: "segment-chars",
          message: `허용 문자 [a-z0-9_-] 위반: "${seg}"`,
        });
      }
    }
  }

  return errors;
}

/**
 * resource 검증 + 정규화. 유효하면 canonical 문자열 반환, 아니면 throw.
 */
export function canonicalizeResource(
  raw: string,
  opts: ValidateOptions = {},
): string {
  const trimmed = raw.trim();
  const errors = validateResource(trimmed, opts);
  if (errors.length > 0) {
    const msgs = errors.map(e => `[${e.rule}] ${e.message}`).join("; ");
    throw new RangeError(`Invalid resource "${raw}": ${msgs}`);
  }
  return trimmed;
}

/**
 * 유효한 resource인지 boolean 반환.
 */
export function isValidResource(
  raw: string,
  opts: ValidateOptions = {},
): boolean {
  return validateResource(raw, opts).length === 0;
}

/**
 * resource 파싱. 유효성 검사 후 구조화된 정보 반환.
 */
export function parseResource(
  raw: string,
  opts: ValidateOptions = {},
): ParsedResource {
  const canonical = canonicalizeResource(raw, opts);
  const segments = canonical.split("/");
  const paramNames = segments
    .filter(s => s.startsWith(":"))
    .map(s => s.slice(1));

  return {
    raw: canonical,
    segments,
    depth: segments.length,
    hasParams: paramNames.length > 0,
    paramNames,
  };
}

// ── Type-specific patterns ───────────────────────────────────────────────────

/**
 * resource 타입별 권장 패턴 규칙.
 *
 * 각 타입이 resource를 어떻게 해석하는지 정의한다.
 * 이 규칙은 강제가 아니라 권장이며, 별도 검증 함수로 확인할 수 있다.
 */
export interface ResourcePattern {
  readonly type: ResourceType;
  /** 이 타입에서 허용되는 action 목록. 미지정 시 자유. */
  readonly actions?: readonly string[];
  /** 이 타입에서 :param 허용 여부. */
  readonly allowParams: boolean;
  /** 이 타입의 max depth. */
  readonly maxDepth: number;
}

/** 기본 제공 타입별 패턴. */
export const DEFAULT_PATTERNS: Record<string, ResourcePattern> = {
  page: {
    type: "page",
    actions: ["view", "edit", "create", "delete"],
    allowParams: false,
    maxDepth: 3,
  },
  api: {
    type: "api",
    actions: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowParams: true,
    maxDepth: 4,
  },
  action: {
    type: "action",
    // action 타입은 임의 이벤트명 허용
    allowParams: false,
    maxDepth: 3,
  },
};

/**
 * resource를 타입별 패턴으로 검증.
 * 일반 검증 + 타입 특화 규칙 적용.
 */
export function validateResourceForType(
  raw: string,
  type: ResourceType,
  patterns: Record<string, ResourcePattern> = DEFAULT_PATTERNS,
): ResourceError[] {
  const pattern = patterns[type];
  if (!pattern) {
    return validateResource(raw);
  }

  return validateResource(raw, {
    maxDepth: pattern.maxDepth,
    allowParams: pattern.allowParams,
  });
}
