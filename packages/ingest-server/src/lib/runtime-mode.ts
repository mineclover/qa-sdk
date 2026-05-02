// @def.boundary ingest-system
// @def.doc ingest-system

export type RuntimeMode = "server" | "worker";

const DEFAULT_RUNTIME_MODE: RuntimeMode = "server";

export function resolveRuntimeMode(argv: string[]): RuntimeMode {
  const rawMode = findModeArg(argv);
  if (rawMode === undefined) {
    return DEFAULT_RUNTIME_MODE;
  }

  if (rawMode === "server" || rawMode === "worker") {
    return rawMode;
  }

  throw new Error(
    `Unsupported runtime mode "${rawMode}". Expected "server" or "worker".`,
  );
}

function findModeArg(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--mode requires a value");
      }

      return value;
    }

    if (arg.startsWith("--mode=")) {
      return arg.slice("--mode=".length);
    }
  }

  return undefined;
}
