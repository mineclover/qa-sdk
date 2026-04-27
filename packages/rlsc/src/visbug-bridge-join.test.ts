// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * FU-4 smoke: visbug-bridge EditLogEntry → rlsc RLSCNode join
 *
 * collector.ts generateId 규칙:
 *   el.id 존재 → `${tag}#${id}`
 *   없음       → `${tag}${cls}__${counter}`
 *
 * collector.ts 는 DOM API(window/document)가 필요하여 jsdom 없이 직접 호출 불가.
 * 기존 테스트(monitor.test.ts 등)와 동일하게 RLSCDocument를 직접 합성하여 검증.
 */

import { describe, it, expect } from "vitest";
import { queryNodes, findById } from "./query.js";
import type { RLSCDocument, RLSCNode } from "./types.js";
import type { EditLogEntry } from "visbug-bridge";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  tag: string,
  overrides: Partial<RLSCNode> = {},
): RLSCNode {
  return {
    id,
    tag,
    classes: [],
    rect: { x: 0, y: 0, width: 200, height: 40 },
    zIndex: 0,
    depth: overrides.depth ?? 0,
    display: "block",
    position: "static",
    overflow: "visible",
    visible: true,
    attributes: {},
    children: [],
    ...overrides,
  };
}

/**
 * 테스트용 RLSCDocument 합성.
 * collector.ts의 id 생성 규칙(`tag#id`)을 그대로 반영한다.
 *
 * DOM 구조:
 *   main#root
 *     header#head
 *     article#body
 *       p#target
 */
function makeDoc(): RLSCDocument {
  const pTarget = makeNode("p#target", "p", {
    depth: 3,
    rect: { x: 0, y: 60, width: 800, height: 40 },
    textContent: "hello",
  });

  const article = makeNode("article#body", "article", {
    depth: 2,
    rect: { x: 0, y: 60, width: 800, height: 540 },
    children: [pTarget],
  });

  const header = makeNode("header#head", "header", {
    depth: 1,
    rect: { x: 0, y: 0, width: 800, height: 60 },
    role: "banner",
  });

  const root = makeNode("main#root", "main", {
    depth: 0,
    rect: { x: 0, y: 0, width: 800, height: 600 },
    role: "main",
    children: [header, article],
  });

  return {
    version: "1.0",
    viewport: { width: 1024, height: 768 },
    url: "http://localhost",
    timestamp: "2026-04-27T00:00:00.000Z",
    root,
    grid: { cellSize: 16, cols: 64, rows: 48, cells: [] },
    layers: [],
    relations: [],
  };
}

/** 가상의 EditLogEntry를 합성한다 (실제 visbug 없이 타입 계약 검증). */
function fakeEntry(
  elementId: string,
  tag: string,
  overrides: Partial<EditLogEntry> = {},
): EditLogEntry {
  const selector = `#${elementId}`;
  return {
    id: "fake-1",
    ts: Date.now(),
    feature: "padding",
    args: [],
    target: {
      selector,
      nodePath: tag,
      weakRef: null,
    },
    beforeCSS: { "padding-top": "0px" },
    afterCSS: { "padding-top": "8px" },
    source: "feature",
    correlationId: "cid-1",
    ...overrides,
  };
}

/**
 * downstream 측정 도구가 채택할 join 헬퍼 패턴.
 *
 * 전략:
 *   1. selector가 `#id` 형식이면 → rlsc node id가 `*#id`로 끝나는 노드 탐색
 *   2. 일치 노드가 1건이면 join 성공
 */
function joinEntryToNode(
  entry: EditLogEntry,
  doc: RLSCDocument,
): RLSCNode | null {
  const sel = entry.target.selector;
  if (sel.startsWith("#")) {
    const domId = sel.slice(1);
    // collector.ts generateId: el.id 있으면 `${tag}#${id}`
    const matches = queryNodes(doc, {}).filter((n) =>
      n.id.endsWith(`#${domId}`),
    );
    if (matches.length === 1) return matches[0];
  }
  return null;
}

// ─── 테스트 ──────────────────────────────────────────────────────────

describe("visbug-bridge EditLogEntry → rlsc RLSCNode join (smoke)", () => {
  it("id 기반 selector로 대응하는 RLSCNode를 찾는다", () => {
    const doc = makeDoc();
    const entry = fakeEntry("target", "p");

    // collector.ts generateId 규칙: `${tag}#${id}` = "p#target"
    const expectedId = "p#target";
    const matched = queryNodes(doc, {}).filter((n) => n.id === expectedId);

    expect(matched.length).toBe(1);
    expect(matched[0].tag).toBe("p");
    expect(matched[0].rect.width).toBeGreaterThan(0);
  });

  it("joinEntryToNode 헬퍼가 entry.target.selector로 노드를 join한다", () => {
    const doc = makeDoc();
    const entry = fakeEntry("target", "p");

    const node = joinEntryToNode(entry, doc);

    expect(node).not.toBeNull();
    expect(node?.tag).toBe("p");
    expect(node?.id).toBe("p#target");
    // visbug entry의 편집 전후 CSS가 함께 있어 인텐트+좌표 결합 가능
    expect(entry.beforeCSS["padding-top"]).toBe("0px");
    expect(entry.afterCSS["padding-top"]).toBe("8px");
  });

  it("id가 없는 selector는 join을 null로 반환한다", () => {
    const doc = makeDoc();
    const entry = fakeEntry("target", "p", {
      target: {
        selector: "p", // id 없는 tag selector
        nodePath: "p",
        weakRef: null,
      },
    });

    const node = joinEntryToNode(entry, doc);
    expect(node).toBeNull();
  });

  it("findById를 통해 정확한 rlsc node id로 직접 조회한다", () => {
    const doc = makeDoc();
    const node = findById(doc, "p#target");

    expect(node).toBeDefined();
    expect(node?.tag).toBe("p");
    expect(node?.textContent).toBe("hello");
  });

  it("EditLogEntry 타입이 rlsc 소비 계층에서 import 가능하다 (타입 계약 smoke)", () => {
    // 타입 import가 성공하면 이 테스트는 통과 (컴파일 타임 검증)
    const entry: EditLogEntry = fakeEntry("head", "header");
    expect(entry.source).toBe("feature");
    expect(entry.target.selector).toBe("#head");
  });
});
