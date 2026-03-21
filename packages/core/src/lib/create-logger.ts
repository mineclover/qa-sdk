/**
 * 서비스 공용 pino 로거 팩토리.
 *
 * pino는 peer dependency — 서비스 패키지가 직접 설치한다.
 */
import pino, { type Logger } from "pino";

function resolveLevel() {
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export function createLogger(name: string): Logger {
  return pino({
    level: resolveLevel(),
    base: { name },
    mixin: () => ({
      timestamp: new Date().toISOString(),
    }),
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}

export type { Logger } from "pino";
