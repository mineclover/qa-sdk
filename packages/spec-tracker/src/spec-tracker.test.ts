import { describe, it, expect } from "vitest";
import { SpecCollector } from "./collector.js";
import { generateReport } from "./reporter.js";
import { spec } from "./vitest-adapter.js";

// ═══════════════════════════════════════════════════════════════
// Collector
// ═══════════════════════════════════════════════════════════════

describe("SpecCollector", () => {
  it("증거를 수집하고 조회한다", () => {
    const col = new SpecCollector();
    col.record({ specId: "registry-api", status: "pass" });
    col.record({ specId: "registry-api", status: "fail", error: "timeout" });
    col.record({ specId: "gate-api", status: "pass" });

    expect(col.count()).toBe(3);
    expect(col.bySpec("registry-api")).toHaveLength(2);
    expect(col.bySpec("gate-api")).toHaveLength(1);
    expect(col.specIds()).toEqual(expect.arrayContaining(["registry-api", "gate-api"]));
  });

  it("clear가 모든 증거를 제거한다", () => {
    const col = new SpecCollector();
    col.record({ specId: "a", status: "pass" });
    col.record({ specId: "b", status: "pass" });
    col.clear();
    expect(col.count()).toBe(0);
  });

  it("마커가 포함된 증거를 수집한다", () => {
    const col = new SpecCollector();
    col.record({ specId: "api", status: "pass", marker: "inputs" });
    const [ev] = col.all();
    expect(ev!.marker).toBe("inputs");
  });

  it("timestamp가 ISO-8601이다", () => {
    const col = new SpecCollector();
    col.record({ specId: "x", status: "pass" });
    const [ev] = col.all();
    expect(() => new Date(ev!.timestamp)).not.toThrow();
    expect(ev!.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

// ═══════════════════════════════════════════════════════════════
// Reporter
// ═══════════════════════════════════════════════════════════════

describe("generateReport", () => {
  it("specId별로 집계한다", () => {
    const col = new SpecCollector();
    col.record({ specId: "api-a", status: "pass" });
    col.record({ specId: "api-a", status: "pass" });
    col.record({ specId: "api-a", status: "fail" });
    col.record({ specId: "api-b", status: "pass" });

    const summary = generateReport(col);
    expect(summary.totalSpecs).toBe(2);
    expect(summary.verifiedSpecs).toBe(2);

    const reportA = summary.reports.find((r) => r.specId === "api-a")!;
    expect(reportA.passed).toBe(2);
    expect(reportA.failed).toBe(1);
    expect(reportA.coverage).toBeCloseTo(2 / 3);

    const reportB = summary.reports.find((r) => r.specId === "api-b")!;
    expect(reportB.passed).toBe(1);
    expect(reportB.coverage).toBe(1);
  });

  it("fullyPassed는 failed=0인 spec만 세다", () => {
    const col = new SpecCollector();
    col.record({ specId: "ok", status: "pass" });
    col.record({ specId: "broken", status: "fail" });
    col.record({ specId: "empty", status: "skip" });

    const summary = generateReport(col);
    expect(summary.fullyPassed).toBe(1); // "ok"만
  });

  it("마커별 집계가 된다", () => {
    const col = new SpecCollector();
    col.record({ specId: "s", status: "pass", marker: "inputs" });
    col.record({ specId: "s", status: "fail", marker: "inputs" });
    col.record({ specId: "s", status: "pass", marker: "precondition" });

    const report = generateReport(col).reports[0]!;
    expect(report.markers["inputs"]!.total).toBe(2);
    expect(report.markers["inputs"]!.passed).toBe(1);
    expect(report.markers["precondition"]!.total).toBe(1);
  });

  it("빈 수집기는 빈 리포트를 반환한다", () => {
    const col = new SpecCollector();
    const summary = generateReport(col);
    expect(summary.totalSpecs).toBe(0);
    expect(summary.reports).toHaveLength(0);
  });

  it("specIds 필터가 동작한다", () => {
    const col = new SpecCollector();
    col.record({ specId: "a", status: "pass" });
    col.record({ specId: "b", status: "pass" });
    col.record({ specId: "c", status: "pass" });

    const summary = generateReport(col, ["a", "c"]);
    expect(summary.totalSpecs).toBe(2);
    expect(summary.reports).toHaveLength(2);
    expect(summary.reports.map((r) => r.specId)).toEqual(["a", "c"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Vitest Adapter
// ═══════════════════════════════════════════════════════════════

describe("spec() adapter", () => {
  it("동기 테스트 성공을 수집한다", () => {
    const col = new SpecCollector();
    const s = spec("my-spec", col);

    s.describe("group", () => {
      s.it("passes", () => {
        // 성공
      });
    });

    expect(col.count()).toBe(1);
    expect(col.all()[0]!.status).toBe("pass");
    expect(col.all()[0]!.specId).toBe("my-spec");
  });

  it("동기 테스트 실패를 수집한다", () => {
    const col = new SpecCollector();
    const s = spec("fail-spec", col);

    s.it("fails", () => {
      throw new Error("broken");
    });

    expect(col.count()).toBe(1);
    expect(col.all()[0]!.status).toBe("fail");
    expect(col.all()[0]!.error).toContain("broken");
  });

  it("마커 지정 it이 마커를 기록한다", () => {
    const col = new SpecCollector();
    const s = spec("marker-spec", col);

    s.marker("inputs").it("checks inputs", () => {});

    expect(col.all()[0]!.marker).toBe("inputs");
  });

  it("describe가 중첩 실행된다", () => {
    const col = new SpecCollector();
    const s = spec("nested", col);
    let ran = false;

    s.describe("outer", () => {
      s.describe("inner", () => {
        s.it("test", () => { ran = true; });
      });
    });

    expect(ran).toBe(true);
    expect(col.count()).toBe(1);
  });
});
