import { describe, it, expect } from "vitest";
import {
  parseDecisionFile,
  serializeDecisionFile,
  extractMarkers,
} from "../src/decision-file.js";

const SAMPLE = `---
id: lesson-builder.layer.cue
subject: "tax:lesson-builder-content:layer.cue"
lifecycle: review
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

# Decision: Cue/Beat 경계

interaction이 어디서 끝나는지의 경계를 정해야 한다. ^purpose

현재 Cue가 Beat을 포함한다고 본다. ^context

## 옵션

### 옵션 A
Cue 안에 interaction 포함. ^option:cue-includes-interaction

### 옵션 B
Beat을 별도 entry로 분리. ^option:beat-as-entry

## 증거

TAXONOMY.md §Cue 정의가 interaction 포함을 함의. ^evidence:precedent weight=0.8

PoC 실행 결과 Beat 분리 시 navigation 복잡도 증가. ^evidence:data weight=0.6

## 결정

(미정) ^outcome
`;

describe("parseDecisionFile", () => {
  it("frontmatter meta + 본문 보존", () => {
    const f = parseDecisionFile(SAMPLE);
    expect(f.meta.id).toBe("lesson-builder.layer.cue");
    expect(f.meta.subject).toBe("tax:lesson-builder-content:layer.cue");
    expect(f.meta.lifecycle).toBe("review");
    expect(f.body).toContain("# Decision: Cue/Beat 경계");
  });

  it("frontmatter 누락 → throw", () => {
    expect(() => parseDecisionFile("# no frontmatter\n")).toThrow(/frontmatter/);
  });

  it("invalid lifecycle → throw", () => {
    const bad = SAMPLE.replace("lifecycle: review", "lifecycle: bogus");
    expect(() => parseDecisionFile(bad)).toThrow(/lifecycle/);
  });

  it("필수 필드 누락 → throw", () => {
    const noId = SAMPLE.replace("id: lesson-builder.layer.cue\n", "");
    expect(() => parseDecisionFile(noId)).toThrow(/id/);
  });
});

describe("extractMarkers", () => {
  it("^purpose / ^context / ^outcome 추출", () => {
    const f = parseDecisionFile(SAMPLE);
    expect(f.markers.purpose).toContain("interaction이 어디서 끝나는지");
    expect(f.markers.context).toContain("Cue가 Beat을 포함");
    expect(f.markers.outcome).toContain("(미정)");
  });

  it("^option:<id> 여러 개 추출", () => {
    const f = parseDecisionFile(SAMPLE);
    expect(f.markers.options).toHaveLength(2);
    expect(f.markers.options.map((o) => o.id).sort()).toEqual([
      "beat-as-entry",
      "cue-includes-interaction",
    ]);
  });

  it("^evidence:<kind> weight=N 추출", () => {
    const f = parseDecisionFile(SAMPLE);
    expect(f.markers.evidence).toHaveLength(2);
    const precedent = f.markers.evidence.find((e) => e.kind === "precedent");
    const data = f.markers.evidence.find((e) => e.kind === "data");
    expect(precedent?.weight).toBe(0.8);
    expect(data?.weight).toBe(0.6);
    expect(precedent?.content).toContain("TAXONOMY.md");
  });

  it("weight 없으면 1.0 default", () => {
    const text = "그냥 증거 한 줄. ^evidence:rule";
    const m = extractMarkers(text);
    expect(m.evidence[0].weight).toBe(1);
  });

  it("마커 없으면 빈 결과", () => {
    const m = extractMarkers("그냥 평범한 문단.");
    expect(m.purpose).toBeUndefined();
    expect(m.options).toEqual([]);
    expect(m.evidence).toEqual([]);
    expect(m.dependsOn).toEqual([]);
    expect(m.phase).toBeUndefined();
    expect(m.weight).toBeUndefined();
  });

  it("^phase:<phase> 추출 (유효 값만)", () => {
    expect(extractMarkers("진행 단계 ^phase:evaluate").phase).toBe("evaluate");
    expect(extractMarkers("잘못된 값 ^phase:bogus").phase).toBeUndefined();
  });

  it("^weight:<weight> 추출 (유효 값만)", () => {
    expect(extractMarkers("핵심 결정 ^weight:core").weight).toBe("core");
    expect(extractMarkers("잘못된 값 ^weight:high").weight).toBeUndefined();
  });

  it("^depends_on:<id> default kind constrains", () => {
    const m = extractMarkers("upstream 결정 ^depends_on:scope-mode");
    expect(m.dependsOn).toEqual([{ gateId: "scope-mode", kind: "constrains" }]);
  });

  it("^depends_on:<id>:<kind> 유효 kind만 적용", () => {
    const m = extractMarkers(
      "여러 의존 ^depends_on:a:enables ^depends_on:b:invalidates ^depends_on:c:bogus",
    );
    expect(m.dependsOn).toEqual([
      { gateId: "a", kind: "enables" },
      { gateId: "b", kind: "invalidates" },
      { gateId: "c", kind: "constrains" }, // bogus → default
    ]);
  });

  it("^gate 마커 없음 → single-gate (gates 빈 배열)", () => {
    const m = extractMarkers("질문 ^purpose\n\nA ^option:a");
    expect(m.gates).toEqual([]);
    expect(m.options).toHaveLength(1);
  });

  it("^gate 마커 → multi-gate (각 gate 자체 options/evidence)", () => {
    const body = `질문 ^purpose

^gate:risk

낮음 ^option:low ^weight:tactical

높음 ^option:high

데이터 ^evidence:data weight=0.5

^gate:scope

확장 ^option:expand ^phase:evaluate

축소 ^option:shrink

선례 ^evidence:precedent weight=0.7
`;
    const m = extractMarkers(body);
    expect(m.purpose).toContain("질문");
    expect(m.gates).toHaveLength(2);
    expect(m.gates[0].id).toBe("risk");
    expect(m.gates[0].options.map((o) => o.id)).toEqual(["low", "high"]);
    expect(m.gates[0].weight).toBe("tactical");
    expect(m.gates[0].evidence[0]).toMatchObject({ kind: "data", weight: 0.5 });
    expect(m.gates[1].id).toBe("scope");
    expect(m.gates[1].options.map((o) => o.id)).toEqual(["expand", "shrink"]);
    expect(m.gates[1].phase).toBe("evaluate");
    expect(m.gates[1].evidence[0]).toMatchObject({ kind: "precedent", weight: 0.7 });
    // schema 전체 options/evidence는 비어있음
    expect(m.options).toEqual([]);
    expect(m.evidence).toEqual([]);
  });

  it("^outcome은 항상 schema 전체 (multi-gate에서도)", () => {
    const body = `^gate:g1\n\nA ^option:a\n\n결정 ^outcome`;
    const m = extractMarkers(body);
    expect(m.outcome).toContain("결정");
    expect(m.gates).toHaveLength(1);
  });
});

describe("option annotation (^cost/^benefit/^risk)", () => {
  it("blank line 분리된 annotation 추출 (kind 별 1건씩)", () => {
    const body = `A 옵션 ^option:a\n\n비용 높음 ^cost:a\n\n이점 큼 ^benefit:a\n\n위험 중간 ^risk:a`;
    const m = extractMarkers(body);
    expect(m.options.length).toBe(1);
    const opt = m.options[0];
    expect(opt.id).toBe("a");
    expect(opt.annotations?.map((x) => x.kind).sort()).toEqual([
      "benefit",
      "cost",
      "risk",
    ]);
    const ann = (k: string) => opt.annotations?.find((x) => x.kind === k)?.body;
    expect(ann("cost")).toBe("비용 높음");
    expect(ann("benefit")).toBe("이점 큼");
    expect(ann("risk")).toBe("위험 중간");
  });

  it("annotation은 별도 block에서도 option id로 매칭", () => {
    const body = `A 옵션 ^option:a\n\nB 옵션 ^option:b\n\nA비용 ^cost:a\n\nB비용 ^cost:b`;
    const m = extractMarkers(body);
    expect(m.options.find((o) => o.id === "a")?.annotations?.[0].body).toBe("A비용");
    expect(m.options.find((o) => o.id === "b")?.annotations?.[0].body).toBe("B비용");
  });

  it("multi-gate — annotation은 같은 gate option 우선 매칭", () => {
    const body = `^gate:g1\n\nA ^option:a\n\n비용1 ^cost:a\n\n^gate:g2\n\nA ^option:a\n\n비용2 ^cost:a`;
    const m = extractMarkers(body);
    const g1opt = m.gates[0].options[0];
    const g2opt = m.gates[1].options[0];
    expect(g1opt.annotations?.[0].body).toBe("비용1");
    expect(g2opt.annotations?.[0].body).toBe("비용2");
  });

  it("매칭 option 없으면 annotation 폐기 (silent skip)", () => {
    const body = `A ^option:a\n\n고아 ^cost:nonexistent`;
    const m = extractMarkers(body);
    expect(m.options[0].annotations).toBeUndefined();
  });
});

describe("serializeDecisionFile 라운드트립", () => {
  it("parse → serialize → parse 동일 meta + body 보존", () => {
    const f1 = parseDecisionFile(SAMPLE);
    const text = serializeDecisionFile(f1);
    const f2 = parseDecisionFile(text);
    expect(f2.meta).toEqual(f1.meta);
    expect(f2.body).toBe(f1.body);
    expect(f2.markers).toEqual(f1.markers);
  });
});
