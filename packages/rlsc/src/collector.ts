import type {
  RLSCNode,
  RLSCDocument,
  CollectorOptions,
  LayoutRect,
  TextFontInfo,
} from "./types.js";
import { flattenTree } from "./tree-utils.js";
import { analyzeGrid } from "./grid.js";
import { detectRelations } from "./relations.js";
import { classifyLayers } from "./layers.js";
import { prepareTextMap } from "./text-occupancy.js";
import type { TextPreparedMap } from "./text-occupancy.js";

// ─── 기본 설정 ──────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<CollectorOptions> = {
  minSize: 4,
  maxDepth: 20,
  includeHidden: false,
  maxTextLength: 80,
  addressAttribute: "data-qa-address",
  collectFontInfo: true,
};

// 수집 제외 태그
const SKIP_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "link",
  "meta",
  "head",
  "br",
  "wbr",
]);

// ─── 유틸리티 ───────────────────────────────────────────────────────

let nodeCounter = 0;

function generateId(el: Element): string {
  if (el.id) return `${el.tagName.toLowerCase()}#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = el.classList.length > 0 ? `.${el.classList[0]}` : "";
  return `${tag}${cls}__${++nodeCounter}`;
}

function getRect(el: Element): LayoutRect {
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
}

function getDirectText(el: Element, maxLen: number): string | undefined {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent?.trim() ?? "";
    }
  }
  text = text.trim();
  if (!text) return undefined;
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

/** truncation 없는 전체 직접 텍스트 반환 (pretext prepare 입력용) */
function getFullText(el: Element): string | undefined {
  let text = "";
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent?.trim() ?? "";
    }
  }
  text = text.trim();
  return text || undefined;
}

function getSemanticAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of el.attributes) {
    if (
      attr.name.startsWith("data-") ||
      attr.name.startsWith("aria-") ||
      attr.name === "href" ||
      attr.name === "src" ||
      attr.name === "alt" ||
      attr.name === "type" ||
      attr.name === "name"
    ) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

function isVisible(
  el: Element,
  rect: LayoutRect,
  style: CSSStyleDeclaration,
  viewport: { width: number; height: number },
): boolean {
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (rect.width <= 0 || rect.height <= 0) return false;
  // 뷰포트 밖 체크
  if (
    rect.x + rect.width < 0 ||
    rect.y + rect.height < 0 ||
    rect.x > viewport.width ||
    rect.y > viewport.height
  ) {
    return false;
  }
  return true;
}

/** CSS computed style에서 Canvas font shorthand + 레이아웃 정보를 추출한다 */
function extractFontInfo(
  style: CSSStyleDeclaration,
): TextFontInfo {
  const weight = style.fontWeight;
  const size = style.fontSize; // "16px" 형태
  const family = style.fontFamily;
  const fontString = `${weight} ${size} ${family}`;

  // line-height: "normal" → fontSize × 1.2, "20px" → 20, "1.5" → fontSize × 1.5
  const rawLH = style.lineHeight;
  const fontSize = parseFloat(size);
  let lineHeight: number;
  if (rawLH === "normal") {
    lineHeight = fontSize * 1.2;
  } else if (rawLH.endsWith("px")) {
    lineHeight = parseFloat(rawLH);
  } else {
    // 단위 없는 숫자 (배율)
    lineHeight = fontSize * parseFloat(rawLH);
  }

  return {
    fontString,
    lineHeight: Math.round(lineHeight * 100) / 100,
    textAlign: style.textAlign,
    padding: {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0,
    },
  };
}

// ─── 수집기 ─────────────────────────────────────────────────────────

function collectNode(
  el: Element,
  depth: number,
  opts: Required<CollectorOptions>,
  viewport: { width: number; height: number },
): RLSCNode | null {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return null;
  if (depth > opts.maxDepth) return null;

  const rect = getRect(el);
  const style = getComputedStyle(el);

  // 최소 크기 필터
  if (rect.width < opts.minSize && rect.height < opts.minSize) return null;

  const vis = isVisible(el, rect, style, viewport);
  if (!vis && !opts.includeHidden) return null;

  // 자식 수집
  const children: RLSCNode[] = [];
  for (const child of el.children) {
    const node = collectNode(child, depth + 1, opts, viewport);
    if (node) children.push(node);
  }

  const zIndex = parseInt(style.zIndex, 10);

  return {
    id: generateId(el),
    tag,
    classes: Array.from(el.classList),
    role: el.getAttribute("role") ?? inferRole(el) ?? undefined,
    rect,
    zIndex: isNaN(zIndex) ? 0 : zIndex,
    depth,
    display: style.display,
    position: style.position,
    overflow: style.overflow,
    visible: vis,
    textContent: getDirectText(el, opts.maxTextLength),
    fontInfo:
      opts.collectFontInfo !== false && getFullText(el)
        ? extractFontInfo(style)
        : undefined,
    address: el.getAttribute(opts.addressAttribute) ?? undefined,
    attributes: getSemanticAttributes(el),
    children,
  };
}

/** 시맨틱 태그에서 role 추론 */
function inferRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const roleMap: Record<string, string> = {
    header: "banner",
    footer: "contentinfo",
    main: "main",
    nav: "navigation",
    aside: "complementary",
    section: "region",
    article: "article",
    form: "form",
    button: "button",
    a: "link",
    img: "img",
    input: "textbox",
    select: "combobox",
    textarea: "textbox",
    ul: "list",
    ol: "list",
    li: "listitem",
    table: "table",
    dialog: "dialog",
  };
  return roleMap[tag] ?? null;
}

// ─── 공개 API ───────────────────────────────────────────────────────

/**
 * DOM 트리를 순회하여 R.L.S.C. 문서를 생성한다.
 *
 * 브라우저 환경에서만 동작한다 (DOM API 필요).
 */
export function collectLayout(
  root?: Element,
  options?: CollectorOptions,
): RLSCDocument {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("collectLayout은 브라우저 환경에서만 실행 가능합니다");
  }
  nodeCounter = 0;
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const targetRoot = root ?? document.body;
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  const rootNode = collectNode(targetRoot, 0, opts, viewport);
  if (!rootNode) {
    throw new Error("루트 요소에서 수집할 수 있는 노드가 없습니다");
  }

  // 트리를 평면화하여 분석
  const flatNodes = flattenTree(rootNode);

  return {
    version: "1.0",
    viewport,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    root: rootNode,
    grid: analyzeGrid(rootNode, viewport),
    layers: classifyLayers(flatNodes),
    relations: detectRelations(flatNodes),
  };
}

/**
 * collectLayout()과 동일하되, 텍스트 노드에 대해 pretext prepare()를 수행하여
 * PreparedText Map을 함께 반환한다.
 *
 * TextPreparedMap은 analyzeTextOccupancy()에 전달한다.
 */
export function collectLayoutWithText(
  root?: Element,
  options?: CollectorOptions,
): { doc: RLSCDocument; textPrepared: TextPreparedMap } {
  const doc = collectLayout(root, options);
  const textPrepared = prepareTextMap(doc);
  return { doc, textPrepared };
}

// flattenTree는 tree-utils.ts로 이동 (순환 의존 해소)
