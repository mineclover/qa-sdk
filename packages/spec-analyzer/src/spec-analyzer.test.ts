import { describe, it, expect } from "vitest";
import { extractDeclarations } from "./extractor.js";
import { analyzeDrift } from "./drift.js";
import { scanImplementations } from "./scanner.js";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════
// Extractor
// ═══════════════════════════════════════════════════════════════

describe("extractDeclarations", () => {
  it("API 엔드포인트를 추출한다", () => {
    const md = `
## API ^api-surface

\`\`\`typescript
GET /prefixes
POST /prefixes
PUT /prefixes/:id
DELETE /prefixes/:id
\`\`\`
`;
    const symbols = extractDeclarations(md, "test-spec");
    expect(symbols).toHaveLength(4);
    expect(symbols[0]).toEqual(expect.objectContaining({ name: "GET /prefixes", kind: "endpoint" }));
    expect(symbols[2]).toEqual(expect.objectContaining({ name: "PUT /prefixes/:id", kind: "endpoint" }));
    expect(symbols.every((s) => s.specId === "test-spec")).toBe(true);
    expect(symbols.every((s) => s.marker === "api-surface")).toBe(true);
  });

  it("함수 시그니처를 추출한다", () => {
    const md = `
## 퍼블릭 API ^api-surface

\`\`\`typescript
createSpecTracker(options?: { autoSync?: boolean }): SpecTracker
generateReport(collector: SpecCollector): VerificationSummary
\`\`\`
`;
    const symbols = extractDeclarations(md, "tracker");
    const functions = symbols.filter((s) => s.kind === "function");
    expect(functions).toHaveLength(2);
    expect(functions[0]!.name).toBe("createSpecTracker");
    expect(functions[1]!.name).toBe("generateReport");
  });

  it("interface/type을 추출한다", () => {
    const md = `
## 타입 ^inputs

\`\`\`typescript
interface ContractEvidence {
  specId: string;
  status: "pass" | "fail";
}

type EvidenceStatus = "pass" | "fail" | "skip";

export class SpecCollector {
  record(input: RecordInput): void;
}
\`\`\`
`;
    const symbols = extractDeclarations(md, "types");
    expect(symbols.find((s) => s.name === "ContractEvidence" && s.kind === "type")).toBeDefined();
    expect(symbols.find((s) => s.name === "EvidenceStatus" && s.kind === "type")).toBeDefined();
    expect(symbols.find((s) => s.name === "SpecCollector" && s.kind === "class")).toBeDefined();
  });

  it("마커 없는 코드 블록은 무시한다", () => {
    const md = `
## 설명

\`\`\`typescript
interface NotExtracted { x: number }
\`\`\`
`;
    const symbols = extractDeclarations(md, "no-marker");
    expect(symbols).toHaveLength(0);
  });

  it("여러 마커 섹션을 각각 추출한다", () => {
    const md = `
## 입력 ^inputs

\`\`\`typescript
interface InputA { a: string }
\`\`\`

## 출력 ^outputs

\`\`\`typescript
interface OutputB { b: number }
\`\`\`
`;
    const symbols = extractDeclarations(md, "multi");
    expect(symbols).toHaveLength(2);
    expect(symbols[0]!.marker).toBe("inputs");
    expect(symbols[1]!.marker).toBe("outputs");
  });
});

// ═══════════════════════════════════════════════════════════════
// Drift
// ═══════════════════════════════════════════════════════════════

describe("analyzeDrift", () => {
  it("선언과 구현이 매칭되면 coverage=1", () => {
    const declared = [
      { name: "createFoo", kind: "function" as const, specId: "s", marker: "api-surface" },
      { name: "FooType", kind: "type" as const, specId: "s", marker: "inputs" },
    ];
    const implemented = [
      { name: "createFoo", kind: "function" as const, filePath: "src/foo.ts", exported: true },
      { name: "FooType", kind: "type" as const, filePath: "src/types.ts", exported: true },
    ];
    const report = analyzeDrift("s", "foo-svc", declared, implemented);
    expect(report.coverage).toBe(1);
    expect(report.missing).toHaveLength(0);
  });

  it("missing을 감지한다", () => {
    const declared = [
      { name: "GET /items", kind: "endpoint" as const, specId: "s" },
      { name: "DELETE /items/:id", kind: "endpoint" as const, specId: "s" },
    ];
    const implemented = [
      { name: "GET /items", kind: "endpoint" as const, filePath: "src/routes.ts", exported: true },
    ];
    const report = analyzeDrift("s", "svc", declared, implemented);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0]!.name).toBe("DELETE /items/:id");
    expect(report.coverage).toBe(0.5);
  });

  it("undocumented를 감지한다", () => {
    const declared = [
      { name: "listItems", kind: "function" as const, specId: "s" },
    ];
    const implemented = [
      { name: "listItems", kind: "function" as const, filePath: "src/a.ts", exported: true },
      { name: "internalHelper", kind: "function" as const, filePath: "src/b.ts", exported: true },
    ];
    const report = analyzeDrift("s", "svc", declared, implemented);
    expect(report.undocumented).toHaveLength(1);
    expect(report.undocumented[0]!.name).toBe("internalHelper");
  });

  it("엔드포인트 :param ↔ {param} 정규화", () => {
    const declared = [{ name: "GET /items/:id", kind: "endpoint" as const, specId: "s" }];
    const implemented = [{ name: "GET /items/{id}", kind: "endpoint" as const, filePath: "r.ts", exported: true }];
    const report = analyzeDrift("s", "svc", declared, implemented);
    expect(report.missing).toHaveLength(0);
    expect(report.coverage).toBe(1);
  });

  it("빈 선언은 coverage=1", () => {
    const report = analyzeDrift("s", "svc", [], []);
    expect(report.coverage).toBe(1);
    expect(report.missing).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scanner (실제 코드 스캔)
// ═══════════════════════════════════════════════════════════════

describe("scanImplementations", () => {
  it("spec-tracker 패키지에서 export 심볼을 수집한다", async () => {
    const trackerDir = join(import.meta.dirname, "../../spec-tracker");
    const symbols = await scanImplementations(trackerDir);

    const names = symbols.map((s) => s.name);
    expect(names).toContain("SpecCollector");
    expect(names).toContain("generateReport");
    expect(names).toContain("spec");
    expect(names).toContain("getGlobalCollector");
  });

  it("존재하지 않는 디렉토리는 빈 배열 반환", async () => {
    const symbols = await scanImplementations("/nonexistent/path");
    expect(symbols).toHaveLength(0);
  });
});
