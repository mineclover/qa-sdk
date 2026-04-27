// Phase 3 — cross-slice convention gate.
//
// 모든 마이그레이션 슬라이스가 sim-domain-slice-kit 의 표준 (LoggerPort,
// TransactionPort, DomainExceptionFilter) 을 일관되게 사용하는지 정적 grep 으로
// 검증한다. 인벤토리는 ARCHITECTURE_SIMULATION_SLICES 단일 소스에서 읽어온다 —
// 24 개 경로를 본 파일에 다시 하드코딩하지 않는다.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCHITECTURE_MIGRATION_SLICES,
  type MigrationSlice,
} from "../architecture/architecture-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

/**
 * DomainExceptionFilter 미사용 슬라이스 허용 목록.
 * 각 항목은 *왜* 표준 filter 를 사용하지 않는지를 명시한다.
 */
const EXCEPTION_FILTER_EXEMPTIONS: Record<string, string> = {
  // Phase 2 보고: CurrentUserGuard 의 UnauthorizedException 흐름을 보존하기 위해
  // Nest 기본 filter 를 의도적으로 유지. DomainExceptionFilter 가 401 을 다른
  // shape 로 변환하면 인증 실패 응답이 깨진다.
  "pm-api/project": "CurrentUserGuard 의 UnauthorizedException flow 를 Nest 기본 filter 로 전달.",
  // Phase 2 보고: budget HTTP 컨트롤러는 slice-local BudgetExceptionFilter 를
  // 사용. 도메인 예외 → BudgetExceptionFilter (DomainExceptionFilter 와 같은
  // shape 로 매핑하지만 401 흐름 보존) 로 처리.
  "approval-api/budget": "Slice-local BudgetExceptionFilter 가 같은 응답 shape 를 보장.",
  // BFF 슬라이스. 외부 도메인 예외를 그대로 노출하지 않고 BFF 가 응답 변환을
  // 책임지므로 Filter 가 필요 없음 (read-only + maintenance).
  "audit-browser-api/audit-explorer": "BFF 슬라이스 — 도메인 예외 노출 없음.",
  "audit-browser-api/graph-explorer": "BFF 슬라이스 — 도메인 예외 노출 없음.",
};

/**
 * TransactionPort 미사용이 정상인 슬라이스 (read-model + BFF + 쓰기 없음).
 */
const TRANSACTION_PORT_EXEMPTIONS: ReadonlySet<string> = new Set([
  "reporting-api/report",
  "reporting-api/metric",
  "reporting-api/density",
  "audit-browser-api/audit-explorer",
  "audit-browser-api/graph-explorer",
  "auth-api/bitmap",
]);

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function listFiles(dir: string, suffix: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listFiles(full, suffix));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      found.push(full);
    }
  }
  return found;
}

function listControllers(sliceDir: string): string[] {
  const presentation = join(sliceDir, "presentation");
  try {
    statSync(presentation);
  } catch {
    return [];
  }
  return listFiles(presentation, ".controller.ts").filter((p) => !p.endsWith(".test.ts"));
}

function listUseCases(sliceDir: string): string[] {
  const useCasesDir = join(sliceDir, "application", "use-cases");
  try {
    statSync(useCasesDir);
  } catch {
    return [];
  }
  return listFiles(useCasesDir, ".use-case.ts").filter((p) => !p.endsWith(".test.ts"));
}

function sliceDir(slice: MigrationSlice): string {
  const target = slice.targets.find((t) => t.kind === "service");
  if (!target) throw new Error(`slice ${slice.id} missing service target`);
  return join(REPO_ROOT, target.path);
}

describe("cross-slice conventions (Phase 3)", () => {
  it("inventory has 24 slices (assignment + 23 parallel)", () => {
    expect(ARCHITECTURE_MIGRATION_SLICES.length).toBe(24);
  });

  it("every controller registers DomainExceptionFilter (with documented exemptions)", () => {
    const failures: string[] = [];
    for (const slice of ARCHITECTURE_MIGRATION_SLICES) {
      const controllers = listControllers(sliceDir(slice));
      if (controllers.length === 0) {
        // 예: BFF/read-model 인데 controller 가 없는 케이스. 이 단계에서는 무시.
        continue;
      }
      const exempt = EXCEPTION_FILTER_EXEMPTIONS[slice.id];
      for (const controllerPath of controllers) {
        const source = readFileSafe(controllerPath) ?? "";
        const hasFilter = /DomainExceptionFilter/.test(source) || /UseFilters\(/.test(source);
        if (!hasFilter && !exempt) {
          failures.push(`${slice.id}: ${controllerPath} — no DomainExceptionFilter or @UseFilters`);
        }
      }
    }
    expect(failures, `Controllers missing exception filter:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("every use-case references LoggerPort", () => {
    const failures: string[] = [];
    for (const slice of ARCHITECTURE_MIGRATION_SLICES) {
      const useCases = listUseCases(sliceDir(slice));
      for (const useCasePath of useCases) {
        const source = readFileSafe(useCasePath) ?? "";
        const hasLogger = /LoggerPort|SLICE_LOGGER_PORT/.test(source);
        if (!hasLogger) {
          failures.push(`${slice.id}: ${useCasePath} — no LoggerPort reference`);
        }
      }
    }
    expect(failures, `Use-cases missing LoggerPort:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("every use-case references TransactionPort (or slice is in read-only allowlist)", () => {
    const failures: string[] = [];
    for (const slice of ARCHITECTURE_MIGRATION_SLICES) {
      const useCases = listUseCases(sliceDir(slice));
      if (useCases.length === 0) continue; // read-model/BFF 는 use-case 자체가 없을 수 있음
      const exempt = TRANSACTION_PORT_EXEMPTIONS.has(slice.id);
      for (const useCasePath of useCases) {
        const source = readFileSafe(useCasePath) ?? "";
        const hasTransaction = /TransactionPort/.test(source);
        if (!hasTransaction && !exempt) {
          failures.push(`${slice.id}: ${useCasePath} — no TransactionPort reference`);
        }
      }
    }
    expect(failures, `Use-cases missing TransactionPort:\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("documents exception filter exemptions inline", () => {
    // 허용 목록에 없는 슬라이스가 통과하지 못하면 예외 처리 신규 발생 — 명시적 검토가
    // 필요하다는 사실을 명문화한다.
    const expected = ["pm-api/project", "approval-api/budget", "audit-browser-api/audit-explorer", "audit-browser-api/graph-explorer"];
    expect(Object.keys(EXCEPTION_FILTER_EXEMPTIONS).sort()).toEqual(expected.slice().sort());
  });

  it("OpenMetadata seed topology mirrors manifest kind (SSOT alignment)", () => {
    // architecture-manifest.ts 의 MigrationSlice.kind 가 SSOT.
    // 각 슬라이스의 metadata/openmetadata.seed.json 에 같은 위상이 명시돼야
    // validator 가 위상 분기 룰을 적용할 수 있다.
    const drift: string[] = [];
    for (const slice of ARCHITECTURE_MIGRATION_SLICES) {
      const seedTarget = slice.targets.find((t) => t.kind === "metadata");
      if (!seedTarget) {
        drift.push(`${slice.id}: manifest missing metadata target`);
        continue;
      }
      const seedPath = join(REPO_ROOT, seedTarget.path);
      const raw = readFileSafe(seedPath);
      if (raw === null) {
        drift.push(`${slice.id}: seed file missing at ${seedTarget.path}`);
        continue;
      }
      let parsed: { topology?: unknown };
      try {
        parsed = JSON.parse(raw) as { topology?: unknown };
      } catch (error) {
        drift.push(`${slice.id}: seed JSON parse failed (${(error as Error).message})`);
        continue;
      }
      if (parsed.topology !== slice.kind) {
        drift.push(`${slice.id}: seed.topology=${String(parsed.topology)} but manifest.kind=${slice.kind}`);
      }
    }
    expect(drift, `Topology drift between manifest and OM seed:\n  ${drift.join("\n  ")}`).toEqual([]);
  });
});
