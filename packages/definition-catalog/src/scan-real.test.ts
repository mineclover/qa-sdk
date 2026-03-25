/**
 * 실제 docs/ 디렉토리 스캔 통합 테스트
 *
 * qa-sdk의 docs/ 문서에 주입된 frontmatter를 스캔하여
 * registry가 올바르게 구성되는지 검증한다.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { scanAndBuild, computeAllConcerns } from "./frontmatter.js";
import type { ScanResult } from "./frontmatter.js";

const ROOT = join(import.meta.dirname, "../../..");  // qa-sdk root

let result: ScanResult;

beforeAll(async () => {
  result = await scanAndBuild(ROOT, [
    join(ROOT, "docs"),
  ]);
});

describe("실제 docs/ 스캔", () => {
  it("frontmatter가 있는 문서가 등록된다", () => {
    expect(result.registered).toBeGreaterThanOrEqual(5);
  });

  it("파싱 에러가 없다", () => {
    // frontmatter가 있는 문서는 모두 유효해야 함
    expect(result.errors.length).toBe(0);
  });

  it("등록된 문서를 ID로 조회할 수 있다", () => {
    const reg = result.registry;
    expect(reg.get("system-overview")).toBeDefined();
    expect(reg.get("gate-service-spec")).toBeDefined();
    expect(reg.get("record-spec")).toBeDefined();
    expect(reg.get("ingest-api-spec")).toBeDefined();
    expect(reg.get("decision-flow-spec")).toBeDefined();
  });

  it("ref 경로가 올바르다 (baseDir 기준 상대)", () => {
    const reg = result.registry;
    expect(reg.get("system-overview")!.ref).toBe("docs/system-overview.md");
    expect(reg.get("gate-service-spec")!.ref).toBe("docs/specs/services/gate-service.spec.md");
    expect(reg.get("record-spec")!.ref).toBe("docs/specs/data-model/record.spec.md");
  });

  it("title이 # 제목에서 추출된다", () => {
    const reg = result.registry;
    expect(reg.get("system-overview")!.title).toBe("QA-SDK 시스템 개요");
    expect(reg.get("gate-service-spec")!.title).toBe("Gate Service 스펙");
    expect(reg.get("record-spec")!.title).toBe("EventRecord + RecordStore");
  });

  it("tags가 보존된다", () => {
    const reg = result.registry;
    expect(reg.get("system-overview")!.tags).toContain("cross-scope");
    expect(reg.get("system-overview")!.tags).toContain("entry-point");
    expect(reg.get("gate-service-spec")!.tags).toContain("security");
    expect(reg.get("ingest-api-spec")!.tags).toContain("performance");
  });

  it("좌표가 자동 계산된다", () => {
    const reg = result.registry;
    for (const entry of reg.all()) {
      expect(entry.address, `${entry.id}에 address 없음`).toBeDefined();
      expect(entry.serialized, `${entry.id}에 serialized 없음`).toBeDefined();
    }
  });
});

describe("링크 연결", () => {
  it("frontmatter의 links가 연결된다", () => {
    const reg = result.registry;

    // gate-service-spec → gate-engine-spec (depends_on)
    // gate-engine-spec이 없으면 linkErrors에 들어감
    const gateLinkError = result.linkErrors.find(e => e.source === "gate-service-spec" && e.target === "gate-engine-spec");
    if (gateLinkError) {
      // gate-engine-spec에 아직 frontmatter가 없으므로 미등록 — 예상된 에러
      expect(gateLinkError.error).toContain("미등록");
    }

    // ingest-api-spec의 depends_on들이 연결됨 — 둘 다 등록됨
    const ingestLinks = reg.getLinks("ingest-api-spec", "outgoing");
    expect(ingestLinks.length).toBeGreaterThan(0);
    expect(ingestLinks.some(link =>
      link.targetId === "record-spec" && link.linkType === "depends_on"
    )).toBe(true);
  });
});

describe("concern 전파", () => {
  it("ingest-api-spec의 performance가 직접 부여", () => {
    const concerns = computeAllConcerns(result.registry);
    const ingest = concerns.get("ingest-api-spec")!;
    expect(ingest.direct).toContain("performance");
  });

  it("gate-service-spec의 security가 직접 부여", () => {
    const concerns = computeAllConcerns(result.registry);
    const gate = concerns.get("gate-service-spec")!;
    expect(gate.direct).toContain("security");
  });
});

describe("scope 기반 질의", () => {
  it("interface scope 문서 조회", () => {
    const apis = result.registry.findByScope("interface");
    expect(apis.length).toBeGreaterThanOrEqual(2);
    expect(apis.some(e => e.id === "gate-service-spec")).toBe(true);
    expect(apis.some(e => e.id === "ingest-api-spec")).toBe(true);
  });

  it("flow scope 문서 조회", () => {
    const flows = result.registry.findByScope("flow");
    expect(flows.some(e => e.id === "system-overview")).toBe(true);
  });
});
