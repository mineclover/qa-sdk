import { describe, expect, it } from "vitest";
import { resolveRuntimeMode } from "./runtime-mode.js";

describe("resolveRuntimeMode", () => {
  it("defaults to server mode when no flag is present", () => {
    expect(resolveRuntimeMode([])).toBe("server");
  });

  it("accepts --mode worker", () => {
    expect(resolveRuntimeMode(["--mode", "worker"])).toBe("worker");
  });

  it("accepts --mode=worker", () => {
    expect(resolveRuntimeMode(["--mode=worker"])).toBe("worker");
  });

  it("rejects invalid mode values", () => {
    expect(() => resolveRuntimeMode(["--mode", "invalid"])).toThrow(
      'Unsupported runtime mode "invalid"',
    );
  });

  it("requires a value after --mode", () => {
    expect(() => resolveRuntimeMode(["--mode"])).toThrow(
      "--mode requires a value",
    );
  });
});
