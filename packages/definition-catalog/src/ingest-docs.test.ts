/**
 * Ingest 시스템 기능 분할 검증
 *
 * 11개 문서를 scope별로 분할한 ingest 시스템이
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
});

describe("ingest 문서 등록", () => {
  const INGEST_IDS = [
    "ingest-system",
    "ingest-api-spec", "query-api-spec", "scenario-api-spec",
    "stream-api-spec", "verdict-api-spec", "admin-api-spec",
    "record-spec", "trace-spec", "session-spec",
    "ingest-pipeline-flow", "ingest-infra-spec",
  ];

  it("12건 모두 등록된다 (그룹 1 + 멤버 11)", () => {
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

  it("scope 분포: interface 6, data 3, flow 2, constraint 1", () => {
    const ingestDocs = result.registry.all().filter(e =>
      ["ingest-system", "ingest-api-spec", "query-api-spec", "scenario-api-spec",
       "stream-api-spec", "verdict-api-spec", "admin-api-spec",
       "record-spec", "trace-spec", "session-spec",
       "ingest-pipeline-flow", "ingest-infra-spec"].includes(e.id),
    );
    const byScope: Record<string, number> = {};
    for (const d of ingestDocs) {
      byScope[d.scope] = (byScope[d.scope] ?? 0) + 1;
    }
    expect(byScope.interface).toBe(6);
    expect(byScope.data).toBe(3);
    expect(byScope.flow).toBe(2); // ingest-system(overview) + pipeline(specification)
    expect(byScope.constraint).toBe(1);
  });
});

describe("ingest-system 그룹 조립", () => {
  it("contains 멤버 11건 이상", () => {
    const links = result.registry.getLinks("ingest-system", "outgoing")
      .filter(l => l.linkType === "contains");
    expect(links.length).toBeGreaterThanOrEqual(11);
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
    expect(assembled!.members.length).toBeGreaterThanOrEqual(11);

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
    expect(text).toContain("Transmission Envelope");  // ingest-api
    expect(text).toContain("cursor");                  // query-api
    expect(text).toContain("SSE");                     // stream-api
    expect(text).toContain("verdict");                 // verdict-api
    expect(text).toContain("DLQ");                     // admin-api
    expect(text).toContain("trace_id");                // trace-spec
    expect(text).toContain("qa_session_id");           // session-spec
    expect(text).toContain("Phase 1");                 // pipeline
    expect(text).toContain("health check");            // infra
  });
});

describe("concern 전파", () => {
  function compute(id: string) {
    return computeEffectiveConcerns(
      id, i => result.registry.get(i), (i, d) => result.registry.getLinks(i, d),
    );
  }

  it("ingest-system의 performance/observability가 멤버에 전파", () => {
    const api = compute("ingest-api-spec");
    expect(api.all).toContain("performance");
    expect(api.inherited.some(i =>
      i.concern === "performance" && i.from === "ingest-system" && i.via === "contains",
    )).toBe(true);
  });

  it("ingest-infra-spec의 performance는 직접 (contains 역방향이 아님)", () => {
    const infra = compute("ingest-infra-spec");
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
  it("query-api-spec → record-spec (depends_on)", () => {
    const links = result.registry.getLinks("query-api-spec", "outgoing");
    expect(links.some(l => l.targetId === "record-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("query-api-spec → trace-spec (depends_on)", () => {
    const links = result.registry.getLinks("query-api-spec", "outgoing");
    expect(links.some(l => l.targetId === "trace-spec" && l.linkType === "depends_on")).toBe(true);
  });

  it("ingest-pipeline-flow → ingest-api-spec (refines)", () => {
    const links = result.registry.getLinks("ingest-pipeline-flow", "outgoing");
    expect(links.some(l => l.targetId === "ingest-api-spec" && l.linkType === "refines")).toBe(true);
  });
});
