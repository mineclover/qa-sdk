/**
 * 모듈 경계 lint — @qa-sdk/convergence 패키지가 spec-core에 역의존하지 않는지 검증.
 *
 * convergence는 독립 패키지로 분리됨.
 * @qa-sdk/core, weighted-index만 의존 허용. spec-core 역의존 금지.
 * 이 테스트가 실패하면 convergence → spec-core 순환 의존이 발생한 것.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// convergence 패키지 소스 디렉토리 (이 테스트가 convergence 패키지 안에 있음)
const CONVERGENCE_DIR = resolve(import.meta.dirname, ".");

function getSourceFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
      .map(f => join(dir, f));
  } catch {
    return [];
  }
}

describe("@qa-sdk/convergence → spec-core 역의존 금지", () => {
  const files = getSourceFiles(CONVERGENCE_DIR);

  it("convergence 소스 파일이 존재한다", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("convergence는 @qa-sdk/spec-core를 import하지 않는다", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("from") && line.includes("@qa-sdk/spec-core")) {
          violations.push(`${file.split("/").pop()}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations, `convergence → @qa-sdk/spec-core import 발견:\n${violations.join("\n")}`).toEqual([]);
  });

  it("convergence는 spec-core 내부 모듈 경로를 사용하지 않는다", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // ../dkg/, ../schema/, ../shared/ 등 spec-core 내부 상대 경로
        if (line.includes("from") && (
          line.includes("../dkg/") ||
          line.includes("../schema/") ||
          line.includes("../shared/") ||
          line.includes("../store/") ||
          line.includes("../loader/")
        )) {
          violations.push(`${file.split("/").pop()}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations, `convergence → spec-core 내부 경로 참조:\n${violations.join("\n")}`).toEqual([]);
  });

  it("convergence는 @qa-sdk/core와 weighted-index만 외부 의존한다", () => {
    const allowedExternal = new Set(["@qa-sdk/core", "weighted-index", "spec-schema"]);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const matches = content.matchAll(/from\s+["']([^"'.][^"']*)["']/g);
      for (const m of matches) {
        const mod = m[1];
        if (mod.startsWith(".")) continue; // 내부 상대 경로는 허용
        if (allowedExternal.has(mod)) continue;
        violations.push(`${file.split("/").pop()}: ${mod}`);
      }
    }
    expect(violations, `convergence 허용되지 않은 외부 의존:\n${violations.join("\n")}`).toEqual([]);
  });
});
