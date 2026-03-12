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
