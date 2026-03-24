import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "@qa-sdk/spec-core/analysis";

import {
  getFlowSchemaProfile,
  listFlowSchemas,
  renderFlowSchemaDiagramMermaid,
} from "./dkg.js";

function createGraph() {
  return bootstrapDkg({
    catalog: DEMO_CATALOG,
    config: DEMO_DKG_CONFIG,
  });
}

describe("dkg flow-schema helpers", () => {
  it("등록된 FlowSchemaNode 목록을 요약한다", () => {
    const entries = listFlowSchemas(createGraph(), DEMO_DKG_CONFIG);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "coordinate-design",
          version: "v1",
        }),
        expect.objectContaining({
          id: "sprint-pipeline",
        }),
      ]),
    );
  });

  it("개별 FlowSchema 프로파일에 gates, core gates, 관련 prefix/axis를 포함한다", () => {
    const profile = getFlowSchemaProfile(createGraph(), "coordinate-design", DEMO_DKG_CONFIG);

    expect(profile).not.toBeNull();
    expect(profile?.coreGateIds).toEqual(
      expect.arrayContaining(["axis-definition", "prefix-design", "merge-split"]),
    );
    expect(profile?.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "axis-definition",
          phase: "decide",
          weight: "core",
          branchCount: 4,
        }),
        expect.objectContaining({
          id: "service-binding",
          phase: "plan",
          weight: "tactical",
        }),
      ]),
    );
    expect(profile?.directPrefixIds).toEqual(
      expect.arrayContaining(["decision_event", "decision_path", "model_apply"]),
    );
    expect(profile?.directAxisIds).toEqual(
      expect.arrayContaining(["cognitive_phase", "flow_type"]),
    );
  });

  it("Mermaid 다이어그램에 gate 인과 그래프를 렌더링한다", () => {
    const mermaid = renderFlowSchemaDiagramMermaid(
      createGraph(),
      "coordinate-design",
      DEMO_DKG_CONFIG,
    );

    expect(mermaid).toContain("flowchart LR");
    expect(mermaid).toContain('axis_definition["axis-definition<br/>축 정의 (5Q Checklist)<br/>decide / core<br/>branches: 4"]');
    expect(mermaid).toContain("axis_definition -->|constrains| prefix_design");
    expect(mermaid).toContain("merge_split -->|invalidates| prefix_design");
  });
});
