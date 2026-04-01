declare const process: {
  stdout: {
    write(message: string): void;
  };
};

export type Level =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

type LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => void;

export interface Logger {
  level: Level;
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  child(bindings: Record<string, unknown>): Logger;
}

export interface Destination {
  write(message: string): void;
}

export interface LoggerOptions {
  level?: Level | string;
  base?: Record<string, unknown>;
  messageKey?: string;
  errorKey?: string;
  mixin?: () => Record<string, unknown>;
  serializers?: Record<string, (value: unknown) => unknown>;
  formatters?: {
    level?: (label: string, number: number) => Record<string, unknown>;
  };
}

const LEVEL_PRIORITY: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
};

function resolveLevel(input: string | undefined): Level {
  switch (input) {
    case "trace":
    case "debug":
    case "info":
    case "warn":
    case "error":
    case "fatal":
    case "silent":
      return input;
    default:
      return "info";
  }
}

function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  const base: Record<string, unknown> = {
    type: error.name,
    message: error.message,
    stack: error.stack,
  };

  for (const key of Object.keys(error)) {
    base[key] = (error as unknown as Record<string, unknown>)[key];
  }

  return base;
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  if (value instanceof Error) {
    return { err: serializeError(value) };
  }

  if (typeof value === "object") {
    return { ...(value as Record<string, unknown>) };
  }

  return { value };
}

class PinoLoggerImpl implements Logger {
  level: Level;

  readonly #base: Record<string, unknown>;
  readonly #dest: Destination;
  readonly #options: LoggerOptions;

  constructor(
    level: Level,
    base: Record<string, unknown>,
    dest: Destination,
    options: LoggerOptions,
  ) {
    this.level = level;
    this.#base = base;
    this.#dest = dest;
    this.#options = options;
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLoggerImpl(
      this.level,
      { ...this.#base, ...bindings },
      this.#dest,
      this.#options,
    );
  }

  trace: LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => {
    this.#write("trace", obj, msg, args);
  };

  debug: LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => {
    this.#write("debug", obj, msg, args);
  };

  info: LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => {
    this.#write("info", obj, msg, args);
  };

  warn: LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => {
    this.#write("warn", obj, msg, args);
  };

  error: LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => {
    this.#write("error", obj, msg, args);
  };

  fatal: LogMethod = (obj?: unknown, msg?: unknown, ...args: unknown[]) => {
    this.#write("fatal", obj, msg, args);
  };

  #write(level: Level, obj?: unknown, msg?: unknown, args: unknown[] = []): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    const messageKey = this.#options.messageKey ?? "msg";
    const errorKey = this.#options.errorKey ?? "err";
    const levelFormatter = this.#options.formatters?.level;

    let details: Record<string, unknown> = {};
    let text: string | undefined;

    if (typeof obj === "string") {
      text = obj;
    } else if (obj instanceof Error) {
      details[errorKey] = this.#serialize(errorKey, obj);
    } else if (obj !== undefined) {
      details = normalizeObject(obj);
    }

    if (msg !== undefined) {
      if (typeof msg === "string") {
        text = msg;
      } else if (msg instanceof Error) {
        details[errorKey] = this.#serialize(errorKey, msg);
      }
    }

    if (args.length > 0 && text !== undefined) {
      text = `${text} ${args.map((entry) => String(entry)).join(" ")}`;
    }

    const mixin = this.#options.mixin?.() ?? {};
    const serializedDetails: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      serializedDetails[key] = this.#serialize(key, value);
    }

    const payload: Record<string, unknown> = {
      ...this.#base,
      ...mixin,
      ...(levelFormatter ? levelFormatter(level, LEVEL_PRIORITY[level]) : { level }),
      time: Date.now(),
      ...serializedDetails,
    };

    if (text !== undefined) {
      payload[messageKey] = text;
    }

    this.#dest.write(`${JSON.stringify(payload)}\n`);
  }

  #serialize(key: string, value: unknown): unknown {
    const serializer = this.#options.serializers?.[key];
    if (serializer !== undefined) {
      return serializer(value);
    }

    if (key === "err") {
      return serializeError(value);
    }

    return value;
  }
}

function createDefaultDestination(): Destination {
  return {
    write(message: string): void {
      process.stdout.write(message);
    },
  };
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

export const stdSerializers = {
  err: serializeError,
};

(pino as typeof pino & { stdSerializers: typeof stdSerializers }).stdSerializers =
  stdSerializers;

export default pino as typeof pino & { stdSerializers: typeof stdSerializers };
