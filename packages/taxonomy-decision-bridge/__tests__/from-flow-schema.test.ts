import { describe, it, expect } from "vitest";
import { parseDecisionFile } from "../src/decision-file.js";
import { toFlowSchema, extractEvidence } from "../src/to-flow-schema.js";
import { toMarkdown, toMarkdownText } from "../src/from-flow-schema.js";
import type { DecisionFile } from "../src/decision-file.js";

const RICH_DECISION = `---
id: cue-boundary
subject: "tax:lesson-builder-content:layer.cue"
lifecycle: approved
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

# Decision

interaction 경계 정의 ^purpose ^phase:evaluate ^weight:core ^depends_on:scope-mode:constrains

## 옵션

Cue가 포함 ^option:cue-includes

Beat 분리 ^option:beat-separate

## 증거

TAXONOMY.md §Cue ^evidence:precedent weight=0.8

PoC 데이터 ^evidence:data weight=0.6

## 결정

Beat을 별도 entry로 분리 ^outcome
`;

function parse(text: string): DecisionFile {
  return parseDecisionFile(text);
}

describe("toMarkdown", () => {
  it("FlowSchema + lifecycle → DecisionFile (markers 보존)", () => {
    const original = parse(RICH_DECISION);
    const schema = toFlowSchema(original);
    const evidence = extractEvidence(original);

    const reconstructed = toMarkdown({
      schema,
      lifecycle: original.meta.lifecycle,
      evidence,
      outcome: original.markers.outcome,
      created: original.meta.created,
      updated: original.meta.updated,
    });

    expect(reconstructed.meta).toEqual(original.meta);
    expect(reconstructed.markers.purpose).toBe(original.markers.purpose);
    expect(reconstructed.markers.options).toEqual(original.markers.options);
    expect(reconstructed.markers.evidence).toEqual(original.markers.evidence);
    expect(reconstructed.markers.outcome).toBe(original.markers.outcome);
    expect(reconstructed.markers.phase).toBe("evaluate");
    expect(reconstructed.markers.weight).toBe("core");
    expect(reconstructed.markers.dependsOn).toEqual([
      { gateId: "scope-mode", kind: "constrains" },
    ]);
  });

  it("toFlowSchema → toMarkdown → parse → toFlowSchema 라운드트립 (의미 보존)", () => {
    const original = parse(RICH_DECISION);
    const schema = toFlowSchema(original);
    const evidence = extractEvidence(original);

    const text = toMarkdownText({
      schema,
      lifecycle: original.meta.lifecycle,
      evidence,
      outcome: original.markers.outcome,
      created: original.meta.created,
      updated: original.meta.updated,
    });

    const reparsed = parse(text);
    const schema2 = toFlowSchema(reparsed);

    expect(schema2.id).toBe(schema.id);
    expect(schema2.gates[0].phase).toBe(schema.gates[0].phase);
    expect(schema2.gates[0].weight).toBe(schema.gates[0].weight);
    expect(schema2.gates[0].branches).toEqual(schema.gates[0].branches);
    expect(schema2.gates[0].affects).toEqual(schema.gates[0].affects);
    expect(schema2.gates[0].requiredEvidence).toEqual(
      schema.gates[0].requiredEvidence,
    );
    expect(schema2.outcomes).toEqual(schema.outcomes);
  });

  it("phase/weight default → 마커 생략", () => {
    const text = toMarkdownText({
      schema: {
        id: "x",
        name: "Decision: x",
        description: "단순 질문",
        version: "1",
        gates: [
          {
            id: "decide",
            name: "결정",
            phase: "decide",
            weight: "tactical",
            branches: [],
          },
        ],
        unit: {
          topic: "x",
          objective: "단순 질문",
          successCriteria: [],
        },
      },
      lifecycle: "draft",
    });
    expect(text).not.toMatch(/\^phase:/);
    expect(text).not.toMatch(/\^weight:/);
    expect(text).toContain("^purpose");
  });

  it("lifecycle != approved → outcome 생략", () => {
    const text = toMarkdownText({
      schema: {
        id: "x",
        name: "Decision: x",
        description: "질문",
        version: "1",
        gates: [
          {
            id: "decide",
            name: "결정",
            phase: "decide",
            weight: "tactical",
            branches: [],
          },
        ],
        unit: { topic: "x", objective: "질문", successCriteria: [] },
      },
      lifecycle: "review",
      outcome: "이건 안 들어감",
    });
    expect(text).not.toContain("^outcome");
    expect(text).not.toContain("이건 안 들어감");
  });

  it("schema gates 0개 → throw", () => {
    expect(() =>
      toMarkdown({
        schema: {
          id: "x",
          name: "Empty",
          description: "",
          version: "1",
          gates: [],
        },
        lifecycle: "draft",
      }),
    ).toThrow(/gate가 0/);
  });

  it("multi-gate schema → ^gate:<id> 섹션 N개 생성 + 라운드트립", () => {
    const MULTI = `---
id: multi
subject: "tax:test:multi"
lifecycle: review
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

전체 질문 ^purpose

^gate:risk ^phase:evaluate ^weight:core

낮음 ^option:low

높음 ^option:high

데이터 ^evidence:data weight=0.5

^gate:scope ^depends_on:risk:constrains

확장 ^option:expand

축소 ^option:shrink

선례 ^evidence:precedent weight=0.7
`;
    const original = parse(MULTI);
    const schema = toFlowSchema(original);
    const evidence = extractEvidence(original);
    expect(schema.gates).toHaveLength(2);

    const text = toMarkdownText({
      schema,
      lifecycle: original.meta.lifecycle,
      evidence,
      outcome: original.markers.outcome,
      created: original.meta.created,
      updated: original.meta.updated,
    });
    expect(text).toContain("^gate:risk");
    expect(text).toContain("^gate:scope");
    expect(text).toContain("^phase:evaluate");
    expect(text).toContain("^weight:core");
    expect(text).toContain("^depends_on:risk:constrains");

    // 라운드트립 — 두 gate 구조 보존
    const reparsed = parse(text);
    const schema2 = toFlowSchema(reparsed);
    expect(schema2.gates).toHaveLength(2);
    expect(schema2.gates[0].id).toBe("risk");
    expect(schema2.gates[0].phase).toBe("evaluate");
    expect(schema2.gates[0].weight).toBe("core");
    expect(schema2.gates[1].id).toBe("scope");
    expect(schema2.gates[1].affects).toEqual([{ gateId: "risk", kind: "constrains" }]);
    expect(schema2.gates[0].branches?.map((b) => b.id)).toEqual(["low", "high"]);
    expect(schema2.gates[1].branches?.map((b) => b.id)).toEqual(["expand", "shrink"]);
  });
});
