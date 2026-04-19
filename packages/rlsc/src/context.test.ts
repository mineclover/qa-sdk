// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import { generateDesignContext } from "./context.js";
import type { RLSCDocument, RLSCNode, TextOccupancy } from "./types.js";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

function makeNode(id = "div#root"): RLSCNode {
  return {
    id,
    tag: "div",
    classes: [],
    rect: { x: 0, y: 0, width: 1920, height: 1080 },
    zIndex: 0,
    depth: 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children: [],
  };
}

function makeDoc(): RLSCDocument {
  return {
    version: "1.0",
    viewport: { width: 1920, height: 1080 },
    url: "https://test.example",
    timestamp: "2026-01-01T00:00:00Z",
    root: makeNode(),
    grid: { cellSize: 16, cols: 0, rows: 0, cells: [] },
    layers: [
      { zIndex: 0, role: "background", nodeIds: ["div#root"], totalArea: 2073600 },
    ],
    relations: [],
  };
}

// ─── 토큰 예산 ────────────────────────────────────────────────────────

describe("토큰 예산 (maxTokens)", () => {
  it("maxTokens 극소값 → structure에 truncated 포함", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { maxTokens: 10 });
    // maxTokens: 10 → structure용 토큰 4 → maxChars 16
    // 마크업이 16자 초과하면 truncated
    expect(ctx.structure).toContain("(truncated)");
  });

  it("maxTokens 충분히 크면 truncated 없음", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { maxTokens: 10000 });
    expect(ctx.structure).not.toContain("(truncated)");
  });
});

// ─── accessibility-audit 템플릿 ───────────────────────────────────────

describe("accessibility-audit purpose", () => {
  it("prompt에 {layers} 리터럴 없음 (버그 수정 검증)", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { purpose: "accessibility-audit" });
    expect(ctx.prompt).not.toContain("{layers}");
  });

  it("prompt에 레이어 정보 포함 (layersToText 결과 교체됨)", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { purpose: "accessibility-audit" });
    // layersToText 결과가 비어있지 않으면 prompt에 포함되어야 함
    // layers: [{role: "background"}] → 텍스트에 background 포함
    expect(ctx.prompt).toContain("background");
  });
});

// ─── sections 필터링 ──────────────────────────────────────────────────

describe("sections 옵션", () => {
  it("sections: ['tree'] → matrix 빈 문자열", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { sections: ["tree"] });
    expect(ctx.matrix).toBe("");
  });

  it("sections: ['grid'] → structure 빈 문자열", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { sections: ["grid"] });
    expect(ctx.structure).toBe("");
  });
});

// ─── 기본 반환값 ──────────────────────────────────────────────────────

describe("generateDesignContext 기본 반환", () => {
  it("summary에 url 포함", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc);
    expect(ctx.summary).toContain("https://test.example");
  });

  it("summary에 viewport 크기 포함", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc);
    expect(ctx.summary).toContain("1920");
    expect(ctx.summary).toContain("1080");
  });

  it("purpose 기본값 layout-analysis", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc);
    expect(ctx.purpose).toBe("layout-analysis");
  });
});

// ─── 텍스트 점유 섹션 ────────────────────────────────────────────────

function makeTextOcc(nodeId: string, overflows: boolean): TextOccupancy {
  return {
    nodeId,
    renderedRect: { x: 10, y: 10, width: 160, height: 40 },
    fillX: 0.8,
    fillY: 0.4,
    lineCount: 2,
    naturalWidth: 180,
    margins: { top: 0, right: 40, bottom: 60, left: 0 },
    boundaryContact: { top: true, right: false, bottom: false, left: true },
    overflows,
  };
}

describe("텍스트 점유 섹션 (sections: text)", () => {
  it("sections에 text 포함 + textOccupancies 제공 시 prompt에 텍스트 분석 포함", () => {
    const doc = makeDoc();
    const occs = [makeTextOcc("p1", false), makeTextOcc("p2", true)];
    const ctx = generateDesignContext(doc, {
      sections: ["text"],
      textOccupancies: occs,
    });
    expect(ctx.prompt).toContain("텍스트 점유");
    expect(ctx.prompt).toContain("p2");
    expect(ctx.prompt).toContain("오버플로우");
  });

  it("textOccupancies 미제공 시 텍스트 섹션 비어있음", () => {
    const doc = makeDoc();
    const ctx = generateDesignContext(doc, { sections: ["text"] });
    expect(ctx.prompt).not.toContain("텍스트 점유");
  });
});
