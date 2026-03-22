/**
 * 복사본 드리프트 방지 — 물리 분할로 인한 복사본이 원본과 동기화되는지 검증.
 *
 * @qa-sdk/convergence는 독립 패키지이므로 spec-core의 shared/ 파일을 직접 import 불가.
 * 대신 복사본을 유지하되, 이 테스트가 구조적 동기화를 검증한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SPEC_CORE = resolve(import.meta.dirname, "..");
const CONVERGENCE = resolve(import.meta.dirname, "../../../convergence/src");

/**
 * 두 파일의 "의미적 동일성"을 검증한다.
 * import 경로는 다를 수 있으므로 import 줄 제외 후 비교.
 */
function compareExcludingImports(fileA: string, fileB: string): { match: boolean; diff?: string } {
  try {
    const contentA = readFileSync(fileA, "utf-8");
    const contentB = readFileSync(fileB, "utf-8");

    const stripImports = (s: string) =>
      s.split("\n").filter(l => !l.startsWith("import") && !l.startsWith("export {") && !l.startsWith("export type {") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/**") && !l.trimStart().startsWith("//")).join("\n").trim();

    const a = stripImports(contentA);
    const b = stripImports(contentB);

    if (a === b) return { match: true };

    // 첫 번째 다른 줄 찾기
    const linesA = a.split("\n");
    const linesB = b.split("\n");
    for (let i = 0; i < Math.max(linesA.length, linesB.length); i++) {
      if (linesA[i] !== linesB[i]) {
        return { match: false, diff: `line ${i + 1}:\n  A: ${linesA[i] ?? "(없음)"}\n  B: ${linesB[i] ?? "(없음)"}` };
      }
    }
    return { match: false, diff: "길이 차이" };
  } catch (e) {
    return { match: false, diff: `파일 읽기 실패: ${(e as Error).message}` };
  }
}

describe("convergence 복사본 드리프트 방지", () => {
  it("GraphPort 인터페이스가 동기화되어 있다", () => {
    // 인터페이스 메서드 목록으로 비교 (구현 아닌 계약 동기화)
    const specPort = readFileSync(resolve(SPEC_CORE, "shared/graph-port.ts"), "utf-8");
    const convPort = readFileSync(resolve(CONVERGENCE, "graph-port.ts"), "utf-8");

    // GraphPort 인터페이스 내부의 메서드 시그니처 추출
    const extractMethods = (content: string) => {
      const match = content.match(/export interface GraphPort \{([\s\S]*?)\n\}/);
      if (!match) return [];
      return match[1].split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("//") && !l.startsWith("*"));
    };

    const specMethods = extractMethods(specPort);
    const convMethods = extractMethods(convPort);

    expect(specMethods.length).toBeGreaterThan(10);
    expect(convMethods).toEqual(specMethods);
  });

  it("decision-scaffold 함수 시그니처가 동기화되어 있다", () => {
    const specFile = readFileSync(resolve(SPEC_CORE, "shared/decision-scaffold.ts"), "utf-8");
    const convFile = readFileSync(resolve(CONVERGENCE, "decision-scaffold.ts"), "utf-8");

    // export function 시그니처 추출
    const extractExports = (content: string) =>
      content.split("\n")
        .filter(l => l.startsWith("export function") || l.startsWith("export interface"))
        .map(l => l.trim());

    const specExports = extractExports(specFile);
    const convExports = extractExports(convFile);

    expect(specExports.length).toBeGreaterThan(0);
    expect(convExports).toEqual(specExports);
  });

  it("DkgNodePort 기본 형태가 서비스 포트와 호환된다", () => {
    // convergence의 dkg-types.ts에서 DecisionNode 형태 확인
    const convTypes = readFileSync(resolve(CONVERGENCE, "dkg-types.ts"), "utf-8");

    // 최소 필수 타입이 존재하는지
    expect(convTypes).toContain("DecisionNode");
    expect(convTypes).toContain("ObservationNode");
    expect(convTypes).toContain("ConstraintNode");
    expect(convTypes).toContain("kind: \"decision\"");
    expect(convTypes).toContain("kind: \"observation\"");
    expect(convTypes).toContain("kind: \"constraint\"");
  });
});
