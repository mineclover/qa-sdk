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
