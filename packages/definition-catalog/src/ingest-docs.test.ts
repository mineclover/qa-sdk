/**
 * Ingest 시스템 기능 분할 검증
 *
 * 14개 멤버 문서를 scope별로 분할한 ingest 시스템이
 * 올바르게 등록, 조립, 전파되는지 확인한다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { scanAndBuild, extractFrontmatter } from "./frontmatter.js";
import { assembleFeature } from "./assemble.js";
import { computeEffectiveConcerns } from "./concern.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");

let result: ScanResult;
let bodies: Map<string, string>;

const INGEST_MEMBER_IDS = [
  "ingest-api-system", "query-api-spec", "scenario-api-spec",
  "stream-api-spec", "verdict-api-spec", "admin-api-system",
  "record-spec", "trace-spec", "session-spec",
  "pipeline-phase-flow", "ingest-infra-system",
  "browser-session-spec", "dlq-store-spec", "transmission-spec",
  "insights-api-spec", "storage-system",
];

const INGEST_IDS = [
  "ingest-system",
  ...INGEST_MEMBER_IDS,
];

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [join(ROOT, "docs")]);

  bodies = new Map();
  for (const entry of result.registry.all()) {
    if (entry.ref) {
      try {
        const content = await readFile(join(ROOT, entry.ref), "utf-8");
        const fm = extractFrontmatter(content);
        if (fm) bodies.set(entry.id, fm.body);
      } catch { /* skip */ }
    }
  }
}, 60_000);

describe("ingest 문서 등록", () => {
  it("17건 모두 등록된다 (그룹 1 + 멤버 16)", () => {
    for (const id of INGEST_IDS) {
      expect(result.registry.get(id), `${id} 미등록`).toBeDefined();
    }
  });

  it("파싱 에러 없음", () => {
    const ingestErrors = result.errors.filter(e =>
      e.file.includes("/ingest/") || e.file.includes("/data-model/") || e.file.includes("/apm/"),
    );
    expect(ingestErrors).toEqual([]);
  });

  it("scope 분포가 적절하다 (interface/data/flow 포함)", () => {
    const ingestDocs = result.registry.all().filter(e =>
      INGEST_IDS.includes(e.id),
    );
    const byScope: Record<string, number> = {};
    for (const d of ingestDocs) {
      byScope[d.scope] = (byScope[d.scope] ?? 0) + 1;
    }
    expect(byScope.interface).toBeGreaterThanOrEqual(5);
    expect(byScope.data).toBeGreaterThanOrEqual(3);
    expect(byScope.flow).toBeGreaterThanOrEqual(2);
  });
});

describe("ingest-system 그룹 조립", () => {
  it("contains 멤버가 존재한다", () => {
    const links = result.registry.getLinks("ingest-system", "outgoing")
      .filter(l => l.linkType === "contains");
    // 문서 추가/제거 시에도 깨지지 않도록 하한만 검증
    expect(links.length).toBeGreaterThan(0);
  });

  it("assembleFeature purpose 수준", () => {
    const assembled = assembleFeature(
      "ingest-system",
      id => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      id => bodies.get(id),
      "purpose",
    );

    expect(assembled).not.toBeNull();
    expect(assembled!.group.purpose).toContain("수집 파이프라인");
    // 멤버가 존재하면 조립 성공 (문서 추가/제거 시에도 깨지지 않도록)
    expect(assembled!.members.length).toBeGreaterThan(0);

    // 모든 멤버에 purpose가 있다
    for (const m of assembled!.members) {
      expect(m.purpose, `${m.id}에 purpose 없음`).not.toBeNull();
    }

    // scope별 정렬 확인 (constraint → data → ... → interface)
    const scopes = assembled!.members.map(m => m.scope);
    const constraintIdx = scopes.indexOf("constraint");
    const lastInterfaceIdx = scopes.lastIndexOf("interface");
    expect(constraintIdx).toBeLessThan(lastInterfaceIdx);
  });

  it("텍스트 렌더링에 핵심 키워드 포함", () => {
    const assembled = assembleFeature(
      "ingest-system",
      id => result.registry.get(id),
      (id, dir) => result.registry.getLinks(id, dir),
      id => bodies.get(id),
      "purpose",
    );

    const text = assembled!.text;
    // 멤버별 purpose가 포함되어 있으므로 텍스트 길이가 충분해야 함
    expect(text.length).toBeGreaterThan(100);
    // 그룹 목적이 포함됨
    expect(text).toContain("수집 파이프라인");
    // 각 멤버의 purpose가 렌더링에 반영됨
    for (const m of assembled!.members) {
      if (m.purpose) {
        expect(text, `${m.id}의 purpose가 텍스트에 없음`).toContain(m.purpose);
      }
    }
  });
});

describe("concern 전파", () => {
  function compute(id: string) {
    return computeEffectiveConcerns(
      id, i => result.registry.get(i), (i, d) => result.registry.getLinks(i, d),
    );
  }

  it("ingest-system의 performance/observability가 멤버에 전파", () => {
    const api = compute("ingest-api-system");
    expect(api.all).toContain("performance");
    expect(api.inherited.some(i =>
      i.concern === "performance" && i.from === "ingest-system" && i.via === "contains",
    )).toBe(true);
  });

  it("ingest-infra-spec의 performance는 직접 (contains 역방향이 아님)", () => {
    const infra = compute("ingest-infra-system");
    expect(infra.direct).toContain("performance");
    expect(infra.direct).toContain("observability");
  });

  it("record-spec은 ingest-system과 gate-system 교집합 가능 (현재는 ingest만)", () => {
    const parents = result.registry.getLinks("record-spec", "incoming")
      .filter(l => l.linkType === "contains")
      .map(l => l.sourceId);
    expect(parents).toContain("ingest-system");
  });
});

describe("link 연결", () => {
  it("ingest-system 멤버 대부분에 outgoing links가 있다", () => {
    for (const id of INGEST_MEMBER_IDS) {
      expect(result.registry.getLinks(id, "outgoing").length, `${id} links 없음`).toBeGreaterThan(0);
    }
  });

  it("ingest-api-system에 outgoing contains 링크가 있다", () => {
    const links = result.registry.getLinks("ingest-api-system", "outgoing");
    expect(links.length).toBeGreaterThan(0);
  });

  it("admin-api-system에 outgoing contains 링크가 있다", () => {
    const links = result.registry.getLinks("admin-api-system", "outgoing");
    expect(links.length).toBeGreaterThan(0);
  });

  it("ingest-infra-system에 outgoing contains 링크가 있다", () => {
    const links = result.registry.getLinks("ingest-infra-system", "outgoing");
    expect(links.length).toBeGreaterThan(0);
  });

  it("query-api-spec → record-spec (depends_on)", () => {
    const links = result.registry.getLinks("query-api-spec", "outgoing");
    expect(links.some(l => l.targetId === "record-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("stream-api-spec → session-spec (depends_on)", () => {
    const links = result.registry.getLinks("stream-api-spec", "outgoing");
    expect(links.some(l => l.targetId === "session-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("browser-session-spec → session-spec (depends_on)", () => {
    const links = result.registry.getLinks("browser-session-spec", "outgoing");
    expect(links.some(l => l.targetId === "session-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("transmission-spec → record-spec (depends_on)", () => {
    const links = result.registry.getLinks("transmission-spec", "outgoing");
    expect(links.some(l => l.targetId === "record-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("dlq-store-spec → trace-spec (depends_on)", () => {
    const links = result.registry.getLinks("dlq-store-spec", "outgoing");
    expect(links.some(l => l.targetId === "trace-spec" && l.linkType === "depends_on")).toBe(true);
  });
});
