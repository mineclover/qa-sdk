/**
 * 모듈 경계 lint — convergence가 dkg에 runtime 의존하지 않는지 검증.
 *
 * convergence는 shared/ (GraphPort, decision-scaffold) + dkg.types (type-only)만 참조해야 한다.
 * dkg/graph-registry, dkg/bootstrap, dkg/skills 등에 대한 runtime import는 금지.
 * 이 테스트가 실패하면 convergence → dkg 순방향 경계가 침범된 것.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CONVERGENCE_DIR = join(import.meta.dirname, ".");

function getSourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map(f => join(dir, f));
}

describe("convergence → dkg 경계 검증", () => {
  const files = getSourceFiles(CONVERGENCE_DIR);

  it("convergence 소스 파일이 존재한다", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("convergence는 dkg/graph-registry를 runtime import하지 않는다", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // runtime import (import type은 허용)
        if (line.includes("from") && line.includes("graph-registry") && !line.trimStart().startsWith("import type")) {
          violations.push(`${file.split("/").pop()}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations, `convergence → dkg/graph-registry runtime import 발견:\n${violations.join("\n")}`).toEqual([]);
  });

  it("convergence는 dkg/skills를 import하지 않는다", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("from") && line.includes("dkg/skills")) {
          violations.push(`${file.split("/").pop()}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations, `convergence → dkg/skills import 발견:\n${violations.join("\n")}`).toEqual([]);
  });

  it("convergence는 dkg/bootstrap를 import하지 않는다", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("from") && line.includes("dkg/bootstrap")) {
          violations.push(`${file.split("/").pop()}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations, `convergence → dkg/bootstrap import 발견:\n${violations.join("\n")}`).toEqual([]);
  });

  it("convergence의 dkg 참조는 dkg.types (type-only)만 허용된다", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // ../dkg/ 경로의 import 중 dkg.types가 아닌 것 (shared/ 경유는 허용)
        if (line.includes("from") && line.includes("../dkg/") && !line.includes("dkg.types") && !line.trimStart().startsWith("//")) {
          // import type만 허용
          if (!line.trimStart().startsWith("import type")) {
            violations.push(`${file.split("/").pop()}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }
    expect(violations, `convergence → dkg runtime import (dkg.types 외):\n${violations.join("\n")}`).toEqual([]);
  });
});
