import { describe, it, expect, beforeEach } from "vitest";
import { SqliteTestScenarioStore } from "./store.js";

describe("SqliteTestScenarioStore", () => {
  let store: SqliteTestScenarioStore;

  beforeEach(() => {
    store = new SqliteTestScenarioStore(":memory:");
  });

  it("upsertDeclared → declared 상태로 저장", () => {
    store.upsertDeclared({
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit",
      scope: "single",
      intent: "입력 검증",
      primarySvc: "@qa-sdk/auth/process-auth",
    });

    const s = store.getByACoord("def:42/unit");
    expect(s?.lifecycle).toBe("declared");
    expect(s?.kind).toBe("unit");
  });

  it("중복 upsertDeclared는 skip", () => {
    const input = {
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit" as const,
      scope: "single" as const,
      intent: "테스트",
      primarySvc: "@qa-sdk/auth/process-auth",
    };
    store.upsertDeclared(input);
    store.upsertDeclared(input);
    expect(store.listAll().length).toBe(1);
  });

  it("assign → assigned 상태 + B 좌표 부여", () => {
    store.upsertDeclared({
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit",
      scope: "single",
      intent: "테스트",
      primarySvc: "@qa-sdk/auth/process-auth",
    });

    store.assign("def:42/unit", "test_scenario:v1:1", "packages/auth-service/src/auth.test.ts", false);

    const s = store.getById("test_scenario:v1:1");
    expect(s?.lifecycle).toBe("assigned");
    expect(s?.filePath).toBe("packages/auth-service/src/auth.test.ts");
  });

  it("recordRun → collected 상태 전이", () => {
    store.upsertDeclared({
      aCoord: "def:42/unit",
      specAddress: "def:42",
      kind: "unit",
      scope: "single",
      intent: "테스트",
      primarySvc: "@qa-sdk/auth/process-auth",
    });
    store.assign("def:42/unit", "test_scenario:v1:1", "auth.test.ts", false);
    store.recordRun("test_scenario:v1:1", true, "abc123", 200);

    const s = store.getById("test_scenario:v1:1");
    expect(s?.lifecycle).toBe("collected");
  });
});
