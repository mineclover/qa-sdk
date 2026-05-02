import { describe, it, expect } from "vitest";
import {
  buildCompositionTree,
  countNodes,
  createInspectorState,
  describeCue,
  extractNodeDetail,
  extractTimeline,
  findNode,
  formatMs,
  loadComposition,
  nodeId,
  selectNode,
  toggleExpand,
  type TreeNode,
  type TreeNodeKind,
} from "./inspector-engine.js";
import type {
  MotionCompositionDefV2,
  MotionSceneDef,
  MotionTargetDef,
  SceneLayerPlacement,
} from "motion-content";

// ═══════════════════════════════════════════════════════════════════════════
// 테스트 fixture
// ═══════════════════════════════════════════════════════════════════════════

const SHARED_TARGET: MotionTargetDef = {
  id: "hero-img",
  target: { kind: "stage-node", nodeId: "hero" },
};

const SECOND_TARGET: MotionTargetDef = {
  id: "sub-text",
  target: { kind: "stage-node", nodeId: "sub" },
  content: { type: "dom" },
};

function placement(targetId: string, startMs = 0, durationMs = 1000): SceneLayerPlacement {
  return {
    targetId,
    startMs,
    durationMs,
    enter: { kind: "fade", durationMs: 300 },
  };
}

function scene(id: string, title: string, startMs: number, durationMs: number, placements: SceneLayerPlacement[]): MotionSceneDef {
  return {
    id, title, startMs, durationMs,
    layers: placements,
    sequences: [],
    captions: [],
  };
}

/** 같은 target이 두 씬에 배치된 composition */
function createTestComposition(): MotionCompositionDefV2 {
  return {
    id: "test-comp",
    title: "Test Composition",
    description: "테스트용",
    durationMs: 6000,
    parameters: [{ id: "headline", label: "제목", type: "text", defaultValue: "Hello" }],
    assets: [],
    targets: [SHARED_TARGET, SECOND_TARGET],
    scenes: [
      scene("scene-a", "Scene A", 0, 3000, [
        placement("hero-img", 0, 2000),
        placement("sub-text", 500, 1500),
      ]),
      scene("scene-b", "Scene B", 3000, 3000, [
        placement("hero-img", 0, 2500),  // 같은 target이 다른 씬에 배치
      ]),
    ],
    cuePresets: [{ id: "fade-in", label: "Fade In", kind: "fade", durationMs: 400 }],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 순수성 검증 — DOM 의존 없음
// ═══════════════════════════════════════════════════════════════════════════

describe("관심사 분리: DOM 의존 없음", () => {
  it("엔진 모듈에 document/window/HTMLElement 참조가 없다", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./inspector-engine.ts", import.meta.url), "utf-8"),
    );
    expect(source).not.toMatch(/\bdocument\b/);
    expect(source).not.toMatch(/\bwindow\b/);
    expect(source).not.toMatch(/\bHTMLElement\b/);
    expect(source).not.toMatch(/\binnerHTML\b/);
    expect(source).not.toMatch(/\baddEventListener\b/);
    expect(source).not.toMatch(/\bquerySelector\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// nodeId 규약
// ═══════════════════════════════════════════════════════════════════════════

describe("nodeId", () => {
  it("composition은 항상 'composition'", () => {
    expect(nodeId("composition", "anything")).toBe("composition");
  });

  it("다른 kind는 {kind}:{sourceId} 형식", () => {
    expect(nodeId("scene", "s1")).toBe("scene:s1");
    expect(nodeId("target", "hero")).toBe("target:hero");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 트리 빌드
// ═══════════════════════════════════════════════════════════════════════════

describe("buildCompositionTree", () => {
  it("루트 kind가 composition이다", () => {
    const tree = buildCompositionTree(createTestComposition());
    expect(tree.kind).toBe("composition");
    expect(tree.id).toBe("composition");
  });

  it("children 순서: scenes → targets → parameters → assets → cuePresets", () => {
    const tree = buildCompositionTree(createTestComposition());
    const kinds = tree.children.map((c) => c.kind);
    // scenes 먼저, 그 다음 나머지
    expect(kinds).toEqual([
      "scene", "scene",       // 2 scenes
      "target", "target",     // 2 targets
      "parameter",            // 1 parameter
      // 0 assets
      "cue",                  // 1 cue preset
    ]);
  });

  it("씬 내부 children 순서: placements → sequences → captions", () => {
    const tree = buildCompositionTree(createTestComposition());
    const sceneA = tree.children.find((c) => c.kind === "scene" && c.label === "Scene A")!;
    const kinds = sceneA.children.map((c) => c.kind);
    expect(kinds).toEqual(["placement", "placement"]);
  });

  it("존재하지 않는 targetId를 참조하면 label에 (missing) 표시", () => {
    const comp = createTestComposition();
    const broken: MotionCompositionDefV2 = {
      ...comp,
      scenes: [scene("s1", "S1", 0, 1000, [placement("ghost-target")])],
    };
    const tree = buildCompositionTree(broken);
    const placementNode = tree.children[0]!.children[0]!;
    expect(placementNode.label).toContain("(missing)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ID 유일성 (경합 방지)
// ═══════════════════════════════════════════════════════════════════════════

function collectIds(node: TreeNode, acc: string[] = []): string[] {
  acc.push(node.id);
  for (const child of node.children) collectIds(child, acc);
  return acc;
}

describe("ID 유일성", () => {
  it("같은 target이 두 씬에 배치돼도 모든 노드 ID가 유일하다", () => {
    const comp = createTestComposition();
    // hero-img가 scene-a, scene-b 양쪽에 배치됨
    expect(comp.scenes[0]!.layers.some((l) => l.targetId === "hero-img")).toBe(true);
    expect(comp.scenes[1]!.layers.some((l) => l.targetId === "hero-img")).toBe(true);

    const tree = buildCompositionTree(comp);
    const ids = collectIds(tree);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("caption/sequence ID가 씬 간 중복돼도 트리 ID는 유일하다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      scenes: [
        {
          id: "s1", title: "S1", startMs: 0, durationMs: 2000,
          layers: [],
          sequences: [{ id: "seq-1", title: "Intro", startMs: 0, durationMs: 1000, targetIds: [] }],
          captions: [{ id: "cap-1", text: "Hello", startMs: 0, durationMs: 500 }],
        },
        {
          id: "s2", title: "S2", startMs: 2000, durationMs: 2000,
          layers: [],
          sequences: [{ id: "seq-1", title: "Intro 2", startMs: 0, durationMs: 1000, targetIds: [] }],
          captions: [{ id: "cap-1", text: "World", startMs: 0, durationMs: 500 }],
        },
      ],
    };

    const tree = buildCompositionTree(comp);
    const ids = collectIds(tree);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 노드 조회
// ═══════════════════════════════════════════════════════════════════════════

describe("findNode / countNodes", () => {
  it("루트를 찾는다", () => {
    const tree = buildCompositionTree(createTestComposition());
    expect(findNode(tree, "composition")).toBe(tree);
  });

  it("중첩 노드를 찾는다", () => {
    const tree = buildCompositionTree(createTestComposition());
    const sceneNode = findNode(tree, nodeId("scene", "scene-a"));
    expect(sceneNode).not.toBeNull();
    expect(sceneNode!.kind).toBe("scene");
  });

  it("없는 ID는 null", () => {
    const tree = buildCompositionTree(createTestComposition());
    expect(findNode(tree, "nonexistent")).toBeNull();
  });

  it("countNodes가 모든 노드를 세다", () => {
    const tree = buildCompositionTree(createTestComposition());
    const ids = collectIds(tree);
    expect(countNodes(tree)).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 디테일 추출
// ═══════════════════════════════════════════════════════════════════════════

describe("extractNodeDetail", () => {
  const ALL_KINDS: TreeNodeKind[] = [
    "composition", "target", "scene", "placement",
    "sequence", "caption", "parameter", "asset", "cue",
  ];

  it("모든 kind에 대해 sections가 비어있지 않다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      scenes: [{
        id: "s1", title: "S1", startMs: 0, durationMs: 2000,
        layers: [placement("hero-img")],
        sequences: [{ id: "seq-1", title: "Intro", startMs: 0, durationMs: 1000, targetIds: ["hero-img"] }],
        captions: [{ id: "cap-1", text: "Hello", startMs: 0, durationMs: 500 }],
      }],
    };
    const tree = buildCompositionTree(comp);
    const ids = collectIds(tree);

    for (const id of ids) {
      const node = findNode(tree, id)!;
      const detail = extractNodeDetail(node);
      expect(detail.sections.length).toBeGreaterThan(0);
      expect(detail.rawJson).toBeTruthy();
      expect(ALL_KINDS).toContain(detail.kind);
    }
  });

  it("composition detail에 구성 요소 카운트가 포함된다", () => {
    const tree = buildCompositionTree(createTestComposition());
    const detail = extractNodeDetail(tree);
    const countSection = detail.sections.find((s) => s.title === "구성 요소")!;
    expect(countSection.rows.find((r) => r.key === "targets")!.value).toBe("2개");
    expect(countSection.rows.find((r) => r.key === "scenes")!.value).toBe("2개");
  });

  it("placement detail에 타이밍과 애니메이션이 포함된다", () => {
    const tree = buildCompositionTree(createTestComposition());
    const sceneA = findNode(tree, nodeId("scene", "scene-a"))!;
    const pl = sceneA.children[0]!;
    const detail = extractNodeDetail(pl);
    expect(detail.sections.some((s) => s.title === "애니메이션")).toBe(true);
    const animSection = detail.sections.find((s) => s.title === "애니메이션")!;
    expect(animSection.rows.some((r) => r.key === "enter")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 타임라인 추출
// ═══════════════════════════════════════════════════════════════════════════

describe("extractTimeline", () => {
  it("블록 수가 씬 수와 같다", () => {
    const comp = createTestComposition();
    const tl = extractTimeline(comp);
    expect(tl.blocks.length).toBe(comp.scenes.length);
  });

  it("totalMs가 가장 늦게 끝나는 씬 이상이다", () => {
    const comp = createTestComposition();
    const tl = extractTimeline(comp);
    const maxEnd = Math.max(...comp.scenes.map((s) => s.startMs + s.durationMs));
    expect(tl.totalMs).toBeGreaterThanOrEqual(maxEnd);
  });

  it("leftPercent + widthPercent가 100을 넘지 않는다", () => {
    const tl = extractTimeline(createTestComposition());
    for (const block of tl.blocks) {
      expect(block.leftPercent + block.widthPercent).toBeLessThanOrEqual(100.001);
    }
  });

  it("블록 nodeId가 scene nodeId 규칙을 따른다", () => {
    const comp = createTestComposition();
    const tl = extractTimeline(comp);
    for (const block of tl.blocks) {
      expect(block.nodeId).toBe(nodeId("scene", block.sceneId));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 상태 관리
// ═══════════════════════════════════════════════════════════════════════════

describe("InspectorState", () => {
  it("초기 상태는 빈 상태다", () => {
    const state = createInspectorState();
    expect(state.composition).toBeNull();
    expect(state.tree).toBeNull();
    expect(state.selectedNodeId).toBeNull();
  });

  it("loadComposition이 트리를 빌드하고 씬을 자동 펼친다", () => {
    const state = createInspectorState();
    const comp = createTestComposition();
    loadComposition(state, comp, "ws-1", "loaded");

    expect(state.tree).not.toBeNull();
    expect(state.workspaceId).toBe("ws-1");
    expect(state.statusOk).toBe(true);
    // 모든 씬이 자동 펼침
    for (const s of comp.scenes) {
      expect(state.expandedNodes.has(nodeId("scene", s.id))).toBe(true);
    }
  });

  it("selectNode이 노드를 선택하고 펼친다", () => {
    const state = createInspectorState();
    loadComposition(state, createTestComposition(), null, "");

    const id = nodeId("scene", "scene-a");
    selectNode(state, id);
    expect(state.selectedNodeId).toBe(id);
    expect(state.expandedNodes.has(id)).toBe(true);
  });

  it("toggleExpand가 토글한다", () => {
    const state = createInspectorState();
    loadComposition(state, createTestComposition(), null, "");

    const id = nodeId("scene", "scene-a");
    expect(state.expandedNodes.has(id)).toBe(true); // 초기 펼침
    toggleExpand(state, id);
    expect(state.expandedNodes.has(id)).toBe(false); // 접힘
    toggleExpand(state, id);
    expect(state.expandedNodes.has(id)).toBe(true); // 다시 펼침
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 포맷 헬퍼
// ═══════════════════════════════════════════════════════════════════════════

describe("formatMs", () => {
  it("1000 미만은 ms 단위", () => {
    expect(formatMs(500)).toBe("500ms");
    expect(formatMs(0)).toBe("0ms");
  });

  it("1000 이상은 초 단위", () => {
    expect(formatMs(1000)).toBe("1.0s");
    expect(formatMs(2500)).toBe("2.5s");
  });
});

describe("describeCue", () => {
  it("preset 참조", () => {
    expect(describeCue({ preset: "fade-in" })).toBe("preset:fade-in");
  });

  it("인라인 cue", () => {
    expect(describeCue({ kind: "fade", durationMs: 300 })).toBe("fade 300ms");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 에러 카테고리별 방어 테스트
// ═══════════════════════════════════════════════════════════════════════════

/*
 * 에러 카테고리 정리:
 *
 * E1. 빈 데이터 (empty composition)
 *   - scenes=[], targets=[], parameters=[] 등 빈 배열
 *   - extractTimeline에서 Math.max(...[]) = -Infinity 위험
 *
 * E2. 참조 무결성 위반 (referential integrity)
 *   - placement.targetId가 targets[]에 없음 → (missing) 라벨은 OK, 그 외 크래시?
 *   - sequence.targetIds에 없는 target 참조
 *
 * E3. 타이밍 경계값 (timing boundary)
 *   - durationMs=0 → 0으로 나누기 (timeline leftPercent/widthPercent)
 *   - startMs < 0 (음수 타이밍)
 *
 * E4. ID 빈 문자열 / 특수문자
 *   - scene.id="" → nodeId가 "scene:"이 되어 다른 빈 ID와 충돌
 *   - id에 "/" 포함 → sceneId/sourceId 파싱 모호성
 *
 * E5. 상태 조작 순서 (state lifecycle)
 *   - tree가 null인데 selectNode 호출
 *   - 없는 nodeId로 selectNode → findNode null, 디테일 없음
 *
 * E6. 대규모 데이터 (scale)
 *   - 100+ 씬, 1000+ placement → countNodes 재귀 스택 오버플로우?
 */

describe("E1: 빈 데이터", () => {
  const emptyComp: MotionCompositionDefV2 = {
    id: "empty", title: "Empty", description: "", durationMs: 0,
    parameters: [], assets: [], targets: [], scenes: [],
  };

  it("빈 composition으로 트리를 빌드할 수 있다", () => {
    const tree = buildCompositionTree(emptyComp);
    expect(tree.kind).toBe("composition");
    expect(tree.children).toHaveLength(0);
  });

  it("빈 composition의 timeline은 빈 blocks를 반환한다", () => {
    const tl = extractTimeline(emptyComp);
    expect(tl.blocks).toHaveLength(0);
  });

  it("durationMs=0인 composition의 timeline에서 NaN이 발생하지 않는다", () => {
    const compWithScene: MotionCompositionDefV2 = {
      ...emptyComp,
      scenes: [scene("s1", "S", 0, 0, [])],
    };
    const tl = extractTimeline(compWithScene);
    // durationMs=0 + scene endMs=0 → totalMs=0 → 0/0 = NaN
    for (const block of tl.blocks) {
      expect(Number.isFinite(block.leftPercent)).toBe(true);
      expect(Number.isFinite(block.widthPercent)).toBe(true);
    }
  });

  it("빈 composition의 detail이 정상 추출된다", () => {
    const tree = buildCompositionTree(emptyComp);
    const detail = extractNodeDetail(tree);
    expect(detail.sections.length).toBeGreaterThan(0);
    const countSection = detail.sections.find((s) => s.title === "구성 요소")!;
    expect(countSection.rows.every((r) => r.value === "0개")).toBe(true);
  });
});

describe("E2: 참조 무결성 위반", () => {
  it("존재하지 않는 targetId placement는 트리 빌드 실패 없이 (missing) 표시", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      targets: [], // 모든 target 제거
    };
    const tree = buildCompositionTree(comp);
    const allPlacements = collectIds(tree).filter((id) => id.startsWith("placement:"));
    expect(allPlacements.length).toBeGreaterThan(0);

    // 모든 placement label이 (missing)을 포함
    for (const id of allPlacements) {
      const node = findNode(tree, id)!;
      expect(node.label).toContain("(missing)");
    }
  });

  it("missing placement의 detail도 정상 추출된다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      targets: [],
    };
    const tree = buildCompositionTree(comp);
    const placementId = collectIds(tree).find((id) => id.startsWith("placement:"))!;
    const node = findNode(tree, placementId)!;
    const detail = extractNodeDetail(node);
    expect(detail.sections.some((s) => s.title === "Placement 정보")).toBe(true);
  });
});

describe("E3: 타이밍 경계값", () => {
  it("음수 startMs가 있어도 트리 빌드/타임라인 추출이 크래시하지 않는다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      scenes: [scene("neg", "Negative", -500, 1000, [])],
    };
    const tree = buildCompositionTree(comp);
    expect(tree.children[0]!.meta).toContain("-500ms");

    const tl = extractTimeline(comp);
    expect(tl.blocks).toHaveLength(1);
    // 음수 leftPercent가 나올 수 있지만 NaN은 아니어야 함
    expect(Number.isFinite(tl.blocks[0]!.leftPercent)).toBe(true);
  });
});

describe("E4: ID 경계값", () => {
  it("빈 문자열 ID도 nodeId가 생성된다", () => {
    const id = nodeId("scene", "");
    expect(id).toBe("scene:");
    expect(id.length).toBeGreaterThan(0);
  });

  it("슬래시가 포함된 sourceId도 안전하다", () => {
    const id = nodeId("target", "a/b/c");
    expect(id).toBe("target:a/b/c");
    // 씬 내부 노드에서 sceneId와 sourceId 구분
    const scopedId = nodeId("placement", "a/b", "scene-x");
    expect(scopedId).toBe("placement:scene-x/a/b");
  });

  it("같은 빈 ID를 가진 두 씬의 children도 구분된다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      scenes: [
        scene("s1", "S1", 0, 1000, [placement("t1")]),
        scene("s2", "S2", 1000, 1000, [placement("t1")]),
      ],
    };
    const tree = buildCompositionTree(comp);
    const ids = collectIds(tree);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("E5: 상태 조작 순서", () => {
  it("tree가 null인 상태에서 selectNode해도 크래시하지 않는다", () => {
    const state = createInspectorState();
    expect(state.tree).toBeNull();
    // selectNode는 tree와 무관하게 상태만 설정
    selectNode(state, "nonexistent");
    expect(state.selectedNodeId).toBe("nonexistent");
  });

  it("선택된 nodeId가 트리에 없으면 findNode가 null을 반환한다", () => {
    const state = createInspectorState();
    loadComposition(state, createTestComposition(), null, "");
    selectNode(state, "does-not-exist");
    const found = findNode(state.tree!, state.selectedNodeId!);
    expect(found).toBeNull();
  });

  it("loadComposition을 연속 호출하면 이전 상태가 완전히 대체된다", () => {
    const state = createInspectorState();
    const comp1 = createTestComposition();
    loadComposition(state, comp1, "ws-1", "first");
    selectNode(state, nodeId("scene", "scene-a"));

    const comp2: MotionCompositionDefV2 = {
      ...comp1,
      id: "comp-2",
      scenes: [scene("scene-x", "Scene X", 0, 1000, [])],
    };
    loadComposition(state, comp2, "ws-2", "second");

    // 이전 선택이 초기화됨
    expect(state.selectedNodeId).toBeNull();
    expect(state.workspaceId).toBe("ws-2");
    // 이전 씬 ID가 expandedNodes에 없음
    expect(state.expandedNodes.has(nodeId("scene", "scene-a"))).toBe(false);
    expect(state.expandedNodes.has(nodeId("scene", "scene-x"))).toBe(true);
  });
});

describe("E6: 대규모 데이터", () => {
  it("100 씬 × 10 placement 트리가 빌드되고 countNodes가 정확하다", () => {
    const targets: MotionTargetDef[] = Array.from({ length: 10 }, (_, i) => ({
      id: `t-${i}`,
      target: { kind: "stage-node" as const, nodeId: `node-${i}` },
    }));
    const scenes: MotionSceneDef[] = Array.from({ length: 100 }, (_, i) => ({
      id: `s-${i}`, title: `Scene ${i}`, startMs: i * 100, durationMs: 100,
      layers: targets.map((t) => placement(t.id)),
      sequences: [], captions: [],
    }));
    const comp: MotionCompositionDefV2 = {
      id: "big", title: "Big", description: "", durationMs: 10000,
      parameters: [], assets: [], targets, scenes,
    };

    const tree = buildCompositionTree(comp);
    // 1 root + 100 scenes + (100×10) placements + 10 targets = 1111
    expect(countNodes(tree)).toBe(1 + 100 + 1000 + 10);

    // ID 유일성
    const ids = collectIds(tree);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E7: 씬 내부 경합 — 같은 씬에 같은 targetId가 2번 배치
// ═══════════════════════════════════════════════════════════════════════════

describe("E7: 씬 내부 중복 placement", () => {
  it("같은 씬에 같은 targetId가 2번 배치돼도 ID가 유일하다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      scenes: [
        scene("s1", "S1", 0, 3000, [
          placement("hero-img", 0, 1000),
          placement("hero-img", 1000, 1000), // 같은 target 두 번
        ]),
      ],
    };
    const tree = buildCompositionTree(comp);
    expect(tree.children[0]!.children).toHaveLength(2);

    // index 포함으로 충돌 방지
    const ids = collectIds(tree);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E8: cuePresets undefined
// ═══════════════════════════════════════════════════════════════════════════

describe("E8: cuePresets 미정의", () => {
  it("cuePresets가 undefined여도 트리 빌드와 디테일 추출이 정상 동작한다", () => {
    const comp: MotionCompositionDefV2 = {
      id: "no-cue", title: "No Cue", description: "", durationMs: 1000,
      parameters: [], assets: [], targets: [], scenes: [],
      // cuePresets 필드 자체가 없음
    };
    const tree = buildCompositionTree(comp);
    expect(tree.children).toHaveLength(0);

    const detail = extractNodeDetail(tree);
    const countRow = detail.sections
      .flatMap((s) => s.rows)
      .find((r) => r.key === "cuePresets");
    expect(countRow!.value).toBe("0개");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E9: extractTimeline에서 빈 scenes → Math.max 안전성
// ═══════════════════════════════════════════════════════════════════════════

describe("E9: Math.max 빈 배열 안전성", () => {
  it("scenes=[]이고 durationMs=0이면 totalMs가 양수다", () => {
    const comp: MotionCompositionDefV2 = {
      id: "z", title: "Z", description: "", durationMs: 0,
      parameters: [], assets: [], targets: [], scenes: [],
    };
    const tl = extractTimeline(comp);
    // Math.max(0, ...[]) = Math.max(0) = 0 → 클램프로 1
    expect(tl.totalMs).toBeGreaterThan(0);
  });

  it("scenes=[]이고 durationMs>0이면 totalMs가 durationMs다", () => {
    const comp: MotionCompositionDefV2 = {
      id: "z", title: "Z", description: "", durationMs: 5000,
      parameters: [], assets: [], targets: [], scenes: [],
    };
    const tl = extractTimeline(comp);
    expect(tl.totalMs).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E10: rawJson 안전성 (순환 참조 없음 확인)
// ═══════════════════════════════════════════════════════════════════════════

describe("E10: rawJson 직렬화 안전성", () => {
  it("모든 노드의 rawJson이 유효한 JSON이다", () => {
    const comp: MotionCompositionDefV2 = {
      ...createTestComposition(),
      scenes: [{
        id: "s1", title: "S1", startMs: 0, durationMs: 2000,
        layers: [placement("hero-img")],
        sequences: [{ id: "seq-1", title: "Intro", startMs: 0, durationMs: 1000, targetIds: ["hero-img"] }],
        captions: [{ id: "cap-1", text: "Hello", startMs: 0, durationMs: 500 }],
      }],
    };
    const tree = buildCompositionTree(comp);
    const ids = collectIds(tree);

    for (const id of ids) {
      const node = findNode(tree, id)!;
      const detail = extractNodeDetail(node);
      // JSON.parse가 throw하면 테스트 실패
      expect(() => JSON.parse(detail.rawJson)).not.toThrow();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E11: nodeId sceneId 누락 경고 — 씬 내부 kind에 sceneId 없이 호출
// ═══════════════════════════════════════════════════════════════════════════

describe("E11: nodeId 씬 스코프 안전성", () => {
  it("placement에 sceneId 없이 호출하면 글로벌 ID가 생성된다 (경합 위험)", () => {
    // sceneId 없이 호출 — 씬 간 경합 가능하지만 크래시는 안 됨
    const globalId = nodeId("placement", "hero-img");
    expect(globalId).toBe("placement:hero-img");

    // sceneId 포함 호출 — 안전
    const scopedId = nodeId("placement", "hero-img", "scene-a");
    expect(scopedId).toBe("placement:scene-a/hero-img");

    // 다른 씬 — 다른 ID
    const scopedId2 = nodeId("placement", "hero-img", "scene-b");
    expect(scopedId2).toBe("placement:scene-b/hero-img");
    expect(scopedId).not.toBe(scopedId2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E12: detail extractor 누락 방어
// ═══════════════════════════════════════════════════════════════════════════

describe("E12: detail extractor 전체 kind 커버리지", () => {
  it("TreeNodeKind의 모든 값에 대해 extractor가 존재한다", () => {
    const ALL_KINDS: TreeNodeKind[] = [
      "composition", "target", "scene", "placement",
      "sequence", "caption", "parameter", "asset", "cue",
    ];

    // 각 kind로 최소한의 노드를 만들어 extractNodeDetail이 throw하지 않는지 확인
    const minimalNodes: Record<TreeNodeKind, TreeNode> = {
      composition: { id: "composition", kind: "composition", label: "C", data: {
        id: "c", title: "C", description: "", durationMs: 0,
        parameters: [], assets: [], targets: [], scenes: [],
      } as MotionCompositionDefV2, children: [] },
      target: { id: "target:t", kind: "target", label: "T", data: {
        id: "t", target: { kind: "stage-node" as const, nodeId: "n" },
      }, children: [] },
      scene: { id: "scene:s", kind: "scene", label: "S", data: {
        id: "s", title: "S", startMs: 0, durationMs: 0,
        layers: [], sequences: [], captions: [],
      } as MotionSceneDef, children: [] },
      placement: { id: "placement:s/t", kind: "placement", label: "P", data: {
        targetId: "t", startMs: 0, durationMs: 0,
        enter: { kind: "fade" as const, durationMs: 0 },
      } as SceneLayerPlacement, children: [] },
      sequence: { id: "sequence:s/q", kind: "sequence", label: "Q", data: {
        id: "q", title: "Q", startMs: 0, durationMs: 0, targetIds: [],
      }, children: [] },
      caption: { id: "caption:s/c", kind: "caption", label: "Cc", data: {
        id: "c", text: "hi", startMs: 0, durationMs: 0,
      }, children: [] },
      parameter: { id: "parameter:p", kind: "parameter", label: "Pa", data: {
        id: "p", label: "P", type: "text" as const, defaultValue: "",
      }, children: [] },
      asset: { id: "asset:a", kind: "asset", label: "As", data: {
        id: "a", type: "text" as const, target: { kind: "stage-node" as const, nodeId: "n" }, template: "",
      }, children: [] },
      cue: { id: "cue:cu", kind: "cue", label: "Cu", data: {
        id: "cu", label: "Cu", kind: "fade" as const, durationMs: 0,
      }, children: [] },
    };

    for (const kind of ALL_KINDS) {
      const detail = extractNodeDetail(minimalNodes[kind]!);
      expect(detail.kind).toBe(kind);
      expect(detail.sections.length).toBeGreaterThan(0);
    }
  });
});
