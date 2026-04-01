/**
 * @qa-sdk/pino — zero-dependency pino 호환 구조화 JSON 로거.
 *
 * npm pino의 핵심 인터페이스를 순수 JS로 구현한다.
 * native C++ binding (sonic-boom) 없이 동작하므로
 * Cloudflare Workers 등 edge runtime에서 사용 가능.
 *
 * pnpm workspace alias로 drop-in 교체:
 *   "pino": "workspace:@qa-sdk/pino@^9.9.4"
 *   → from "pino" import가 이 패키지를 resolve
 */

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/** 구조화 로그 메서드. pino의 3가지 호출 패턴을 지원. */
export interface LogMethod {
  /** logger.info("메시지") */
  (msg: string, ...args: unknown[]): void;
  /** logger.info({ key: val }, "메시지") */
  (obj: Record<string, unknown>, msg?: string, ...args: unknown[]): void;
  /** logger.info(error, "메시지") */
  (err: Error, msg?: string, ...args: unknown[]): void;
}

export interface Logger {
  level: Level;
  readonly trace: LogMethod;
  readonly debug: LogMethod;
  readonly info: LogMethod;
  readonly warn: LogMethod;
  readonly error: LogMethod;
  readonly fatal: LogMethod;
  /** 현재 레벨에서 해당 레벨이 출력되는지 확인 */
  isLevelEnabled(level: Level): boolean;
  /** 부모 바인딩을 상속하고 추가 바인딩을 병합한 자식 로거 생성 */
  child(bindings: Record<string, unknown>): Logger;
  /** silent 레벨 로거 (아무것도 출력하지 않음) */
  silent: LogMethod;
}

export interface Destination {
  write(message: string): void;
  /** flush 지원 시 동기 flush */
  flushSync?(): void;
}

export interface LoggerOptions {
  level?: Level | string;
  /** 모든 로그에 포함될 고정 필드 */
  base?: Record<string, unknown>;
  /** 메시지 필드 키 (기본: "msg") */
  messageKey?: string;
  /** 에러 직렬화 필드 키 (기본: "err") */
  errorKey?: string;
  /** 매 로그 호출 시 동적 필드 생성 함수 */
  mixin?: () => Record<string, unknown>;
  /** 특정 키의 값을 변환하는 함수 맵 */
  serializers?: Record<string, (value: unknown) => unknown>;
  /** 레벨 포맷터 */
  formatters?: {
    level?: (label: string, number: number) => Record<string, unknown>;
  };
  /** 타임스탬프 비활성화 (기본: true = Date.now()) */
  timestamp?: boolean | (() => string);
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const LEVEL_PRIORITY: Readonly<Record<Level, number>> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
};

const LEVEL_NAMES: Readonly<Record<number, Level>> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function resolveLevel(input: string | undefined): Level {
  if (
    input === "trace" ||
    input === "debug" ||
    input === "info" ||
    input === "warn" ||
    input === "error" ||
    input === "fatal" ||
    input === "silent"
  ) {
    return input;
  }
  return "info";
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  const base: Record<string, unknown> = {
    type: error.name,
    message: error.message,
    stack: error.stack,
  };

  // Error 인스턴스의 열거 가능 속성도 포함 (cause, code 등)
  for (const [key, value] of Object.entries(error)) {
    if (!(key in base)) {
      base[key] = value;
    }
  }

  // ES2022 cause 지원
  if ("cause" in error && error.cause !== undefined && !("cause" in base)) {
    base.cause = error.cause instanceof Error
      ? serializeError(error.cause)
      : error.cause;
  }

  return base;
}

function normalizeFirstArg(value: unknown, errorKey: string): {
  details: Record<string, unknown>;
  text: string | undefined;
} {
  if (typeof value === "string") {
    return { details: {}, text: value };
  }

  if (value instanceof Error) {
    return { details: { [errorKey]: serializeError(value) }, text: undefined };
  }

  if (value !== null && value !== undefined && typeof value === "object") {
    return { details: { ...(value as Record<string, unknown>) }, text: undefined };
  }

  return { details: {}, text: undefined };
}

// ── Logger 구현 ──────────────────────────────────────────────────────────────

class PinoLoggerImpl implements Logger {
  level: Level;

  readonly #base: Readonly<Record<string, unknown>>;
  readonly #dest: Destination;
  readonly #options: Readonly<LoggerOptions>;
  readonly #messageKey: string;
  readonly #errorKey: string;
  readonly #levelFormatter: ((label: string, num: number) => Record<string, unknown>) | undefined;
  readonly #timestamp: boolean | (() => string);

  constructor(
    level: Level,
    base: Record<string, unknown>,
    dest: Destination,
    options: LoggerOptions,
  ) {
    this.level = level;
    this.#base = Object.freeze({ ...base });
    this.#dest = dest;
    this.#options = options;
    this.#messageKey = options.messageKey ?? "msg";
    this.#errorKey = options.errorKey ?? "err";
    this.#levelFormatter = options.formatters?.level;
    this.#timestamp = options.timestamp ?? true;
  }

  isLevelEnabled(level: Level): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLoggerImpl(
      this.level,
      { ...this.#base, ...bindings },
      this.#dest,
      this.#options,
    );
  }

  readonly trace: LogMethod = (...args: unknown[]) => {
    this.#write("trace", args);
  };

  readonly debug: LogMethod = (...args: unknown[]) => {
    this.#write("debug", args);
  };

  readonly info: LogMethod = (...args: unknown[]) => {
    this.#write("info", args);
  };

  readonly warn: LogMethod = (...args: unknown[]) => {
    this.#write("warn", args);
  };

  readonly error: LogMethod = (...args: unknown[]) => {
    this.#write("error", args);
  };

  readonly fatal: LogMethod = (...args: unknown[]) => {
    this.#write("fatal", args);
  };

  readonly silent: LogMethod = () => {
    // noop
  };

  #write(level: Level, args: unknown[]): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    const [first, second, ...rest] = args;
    const { details, text: firstText } = normalizeFirstArg(first, this.#errorKey);

    let text: string | undefined = firstText;

    if (text === undefined && second !== undefined) {
      // first가 객체/에러, second가 메시지
      if (typeof second === "string") {
        text = second;
      } else if (second instanceof Error) {
        details[this.#errorKey] = this.#serialize(this.#errorKey, second);
      }
    } else if (text !== undefined && second !== undefined) {
      // first가 메시지, second부터 추가 args
      rest.unshift(second);
    }

    // printf-style 인터폴레이션 (%s, %d, %j, %o)
    if (rest.length > 0 && text !== undefined) {
      text = this.#interpolate(text, rest);
    }

    const mixin = this.#options.mixin?.() ?? {};

    // 직렬화 적용
    const serializedDetails: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      serializedDetails[key] = this.#serialize(key, value);
    }

    const payload: Record<string, unknown> = {
      ...this.#base,
      ...mixin,
      ...(this.#levelFormatter
        ? this.#levelFormatter(level, LEVEL_PRIORITY[level])
        : { level: LEVEL_PRIORITY[level] }),
      ...serializedDetails,
    };

    // 타임스탬프
    if (this.#timestamp === true) {
      payload.time = Date.now();
    } else if (typeof this.#timestamp === "function") {
      // pino 호환: 함수가 `,"time":1234` 형태를 반환하는 패턴
      const ts = this.#timestamp();
      if (ts) {
        try {
          const parsed = JSON.parse(`{${ts.replace(/^,/, "")}}`);
          Object.assign(payload, parsed);
        } catch {
          payload.time = Date.now();
        }
      }
    }

    if (text !== undefined) {
      payload[this.#messageKey] = text;
    }

    this.#dest.write(`${JSON.stringify(payload)}\n`);
  }

  #serialize(key: string, value: unknown): unknown {
    const serializer = this.#options.serializers?.[key];
    if (serializer !== undefined) {
      return serializer(value);
    }
    if (key === this.#errorKey && value instanceof Error) {
      return serializeError(value);
    }
    return value;
  }

  /** printf-style 인터폴레이션: %s, %d, %j, %o */
  #interpolate(template: string, args: unknown[]): string {
    let i = 0;
    return template.replace(/%([sdjo%])/g, (match, spec: string) => {
      if (spec === "%" || i >= args.length) return match;
      const arg = args[i++];
      switch (spec) {
        case "s": return String(arg);
        case "d": return Number(arg).toString();
        case "j":
        case "o":
          try { return JSON.stringify(arg); }
          catch { return String(arg); }
        default: return match;
      }
    });
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

function createDefaultDestination(): Destination {
  // Edge runtime 호환: globalThis 기반 stdout 탐색
  const write = typeof globalThis !== "undefined" && "process" in globalThis
    ? (msg: string) => (globalThis as { process: { stdout: { write: (m: string) => void } } }).process.stdout.write(msg)
    : typeof console !== "undefined"
      ? (msg: string) => console.log(msg.replace(/\n$/, ""))
      : (_msg: string) => {};

  return { write };
}

function pino(options?: LoggerOptions, destination?: Destination): Logger {
  const resolvedOptions = options ?? {};
  const level = resolveLevel(resolvedOptions.level);
  const base = resolvedOptions.base ?? {};
  return new PinoLoggerImpl(
    level,
    base,
    destination ?? createDefaultDestination(),
    resolvedOptions,
  );
}

// ── 유틸리티 export ──────────────────────────────────────────────────────────

export const stdSerializers = {
  err: serializeError,
};

/** 레벨 이름 → 숫자 */
export const levels = {
  values: LEVEL_PRIORITY as Record<string, number>,
  labels: LEVEL_NAMES as Record<number, string>,
};

// pino.stdSerializers, pino.levels 정적 프로퍼티
const pinoExport = pino as typeof pino & {
  stdSerializers: typeof stdSerializers;
  levels: typeof levels;
};
pinoExport.stdSerializers = stdSerializers;
pinoExport.levels = levels;

export default pinoExport;
