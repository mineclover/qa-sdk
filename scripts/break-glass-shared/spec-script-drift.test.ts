// scripts/break-glass-shared/spec-script-drift.test.ts
// Plan E Stage 12 Task 12.4 — spec 05 §2 ↔ root package.json drift 정적 검사.
// spec 표가 인용한 명령(`pnpm sim:canary ...`, `pnpm sim:scale set ...`)이 모두
// root scripts에 등록되었는지를 검증한다.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("spec 05 §2 ↔ package.json 동기화", () => {
  it("표에서 인용된 명령이 모두 root package.json scripts에 매핑되어 있다", () => {
    const root = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    );
    expect(root.scripts["sim:canary"]).toBeDefined();
    expect(root.scripts["sim:scale"]).toBeDefined();

    const spec = readFileSync(
      resolve(
        __dirname,
        "../../docs/superpowers/specs/2026-04-28-canary-scaling/05-error-and-scenarios.md",
      ),
      "utf8",
    );
    for (const literal of [
      "pnpm sim:canary abort",
      "pnpm sim:canary force-promote",
      "pnpm sim:canary controller stop",
      "pnpm sim:scale set",
    ]) {
      expect(spec.includes(literal)).toBe(true);
    }
  });
});
