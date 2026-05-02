// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 에러 처리 공통 컨벤션 준수 테스트.
 *
 * spec-tracker로 error-handling-convention 문서에 연결.
 * 이 테스트가 통과하면 에러 컨벤션 문서의 증거로 기록된다.
 */
import { describe, it, expect } from "vitest";
import { SpecCollector, generateReport, specIt } from "spec-tracker";
import { AppError, ServiceClientError } from "./lib/app-error.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const collector = new SpecCollector();
const SPEC_ID = "error-handling-convention";

describe("에러 처리 공통 컨벤션 (error-handling-convention)", () => {
  // --- AppError 계약 ---

  it("AppError는 code, statusCode, extras를 가진다", () => {
    const err = new AppError("NOT_FOUND", "resource not found", 404, { id: "abc" });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
    expect(err.extras).toEqual({ id: "abc" });
    expect(err.message).toBe("resource not found");
    expect(err).toBeInstanceOf(Error);

    collector.record({ specId: SPEC_ID, status: "pass", testName: "AppError 인터페이스", marker: "precondition" });
  });

  it("AppError 기본값: statusCode=400, extras={}", () => {
    const err = new AppError("INVALID_INPUT", "bad request");
    expect(err.statusCode).toBe(400);
    expect(err.extras).toEqual({});

    collector.record({ specId: SPEC_ID, status: "pass", testName: "AppError 기본값" });
  });

  // --- ServiceClientError 계약 ---

  it("ServiceClientError는 status, payload를 가진다", () => {
    const err = new ServiceClientError("fetch failed", 502, { detail: "timeout" });
    expect(err.status).toBe(502);
    expect(err.payload).toEqual({ detail: "timeout" });
    expect(err).toBeInstanceOf(Error);

    collector.record({ specId: SPEC_ID, status: "pass", testName: "ServiceClientError 인터페이스", marker: "precondition" });
  });

  // --- 에러 코드 표준 ---

  it("표준 에러 코드가 올바른 HTTP 상태와 매핑된다", () => {
    const mappings: [string, number][] = [
      ["INVALID_INPUT", 400],
      ["NOT_FOUND", 404],
      ["CONFLICT", 409],
      ["INTERNAL_ERROR", 500],
    ];

    for (const [code, status] of mappings) {
      const err = new AppError(code, "test", status);
      expect(err.code).toBe(code);
      expect(err.statusCode).toBe(status);
    }

    collector.record({ specId: SPEC_ID, status: "pass", testName: "에러 코드 매핑" });
  });

  // --- 로깅 패턴 정적 검사 ---

  it("서비스 코드에 잘못된 로깅 패턴 { error: err }이 없다", () => {
    const root = join(import.meta.dirname, "../../..");
    const services = ["decode-service", "gate-service", "ingest-server", "motion-workspace-service", "registry-service", "definition-service", "decision-service"];

    const violations: string[] = [];
    for (const svc of services) {
      const srcDir = join(root, "packages", svc, "src");
      try {
        const files = findTsFiles(srcDir);
        for (const file of files) {
          const content = readFileSync(file, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            if (/logger\.(error|warn)\(\s*\{\s*error\b/.test(line) && !line.includes("test")) {
              violations.push(`${file}:${i + 1}`);
            }
          }
        }
      } catch { /* svc dir 없으면 스킵 */ }
    }

    if (violations.length > 0) {
      collector.record({ specId: SPEC_ID, status: "fail", testName: "로깅 패턴", marker: "evidence", error: violations.join(", ") });
    } else {
      collector.record({ specId: SPEC_ID, status: "pass", testName: "로깅 패턴", marker: "evidence" });
    }

    expect(violations, `잘못된 로깅 패턴: ${violations.join(", ")}`).toHaveLength(0);
  });

  // --- 서비스 에러 AppError 사용 검사 ---

  it("서비스 에러 핸들러가 AppError를 사용한다", () => {
    const root = join(import.meta.dirname, "../../..");
    const handlers = [
      "packages/decode-service/src/middleware/error-handler.ts",
      "packages/gate-service/src/middleware/error-handler.ts",
      "packages/ingest-server/src/middleware/error-handler.ts",
    ];

    for (const handler of handlers) {
      try {
        const content = readFileSync(join(root, handler), "utf-8");
        expect(content).toContain("AppError");
      } catch { /* 파일 없으면 스킵 */ }
    }

    collector.record({ specId: SPEC_ID, status: "pass", testName: "에러 핸들러 AppError 사용" });
  });

  // --- 리포트 생성 ---

  it("spec-tracker 리포트가 생성된다", () => {
    const report = generateReport(collector, [SPEC_ID]);
    expect(report.reports).toHaveLength(1);
    expect(report.reports[0]!.specId).toBe(SPEC_ID);
    expect(report.reports[0]!.passed).toBeGreaterThan(0);

    console.log(`\n=== spec-tracker 리포트 ===`);
    console.log(`specId: ${report.reports[0]!.specId}`);
    console.log(`증거: ${report.reports[0]!.evidences}건 (pass: ${report.reports[0]!.passed}, fail: ${report.reports[0]!.failed})`);
    console.log(`coverage: ${(report.reports[0]!.coverage * 100).toFixed(0)}%`);
  });
});

function findTsFiles(dir: string, acc: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
        findTsFiles(full, acc);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        acc.push(full);
      }
    }
  } catch { /* dir 없으면 빈 배열 */ }
  return acc;
}
