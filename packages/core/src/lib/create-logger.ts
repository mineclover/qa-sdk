// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 서비스 공용 pino 로거 팩토리.
 *
 * pino는 peer dependency — 서비스 패키지가 직접 설치한다.
 */
import pino, { type Logger, type Destination } from 'pino';

function resolveLevel() {
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/** 추가 pino destination. write(msg: string) 계약을 구현하면 된다. */
export interface LoggerDestination {
  stream: Destination;
  level?: string;
}

export interface CreateLoggerOptions {
  /** 추가 destination 배열. 지정 시 stdout + destinations에 동시 출력. */
  destinations?: LoggerDestination[];
}

/** 레벨 우선순위. destination별 level 필터링에 사용. */
const LEVEL_PRIORITY: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * 여러 Destination에 동시 write하는 래퍼.
 * primary(stdout)는 무조건 write, 추가 destination은 level 필터 적용.
 */
function createMultiDestination(primary: Destination, extras: LoggerDestination[]): Destination {
  return {
    write(chunk: string) {
      primary.write(chunk);

      // 추가 destination에 level 필터 적용
      for (const extra of extras) {
        if (extra.level) {
          try {
            const parsed = JSON.parse(chunk) as Record<string, unknown>;
            const logLevel = typeof parsed.level === 'string' ? parsed.level : 'info';
            const threshold = LEVEL_PRIORITY[extra.level] ?? 0;
            const actual = LEVEL_PRIORITY[logLevel] ?? 0;
            if (actual < threshold) continue;
          } catch {
            // JSON 파싱 실패 시 그냥 전달
          }
        }
        extra.stream.write(chunk);
      }
    },
  };
}

export function createLogger(name: string, options?: CreateLoggerOptions): Logger {
  const pinoOpts = {
    level: resolveLevel(),
    base: { name },
    mixin: () => ({
      timestamp: new Date().toISOString(),
    }),
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  };

  // destinations 옵션이 있으면 multi-destination 구성
  if (options?.destinations && options.destinations.length > 0) {
    const stdout: Destination = { write: (msg: string) => process.stdout.write(msg) };
    const multi = createMultiDestination(stdout, options.destinations);
    return pino(pinoOpts, multi);
  }

  return pino(pinoOpts);
}

export type { Logger } from 'pino';
