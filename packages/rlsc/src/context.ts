import type {
  RLSCDocument,
  RLSCNode,
  ContextOptions,
  DesignContext,
  ContextPurpose,
  LayoutRect,
} from "./types.js";
import { encodeToMarkup } from "./encoder.js";
import { gridToText } from "./grid.js";
import { layersToText } from "./layers.js";
import { relationsToText } from "./relations.js";
import { flattenTree } from "./collector.js";

// ─── Context Engineering ────────────────────────────────────────────

const DEFAULT_CONTEXT_OPTIONS: Required<ContextOptions> = {
  purpose: "layout-analysis",
  focus: undefined as unknown as string,
  sections: ["tree", "grid", "layers", "relations"],
  maxTokens: 4000,
};

/**
 * R.L.S.C. 문서를 LLM이 이해할 수 있는 디자인 컨텍스트로 변환한다.
 *
 * - 자연어 요약 생성
 * - 목적별 프롬프트 템플릿 적용
 * - 토큰 예산 내에서 정보 우선순위 결정
 */
export function generateDesignContext(
  doc: RLSCDocument,
  options?: Partial<ContextOptions>,
): DesignContext {
  const opts = { ...DEFAULT_CONTEXT_OPTIONS, ...options };
  const allNodes = flattenTree(doc.root);

  // 자연어 요약 생성
  const summary = generateSummary(doc, allNodes);

  // 트리 마크업 (트리 섹션만)
  const structure = opts.sections.includes("tree")
    ? truncateToTokenBudget(encodeToMarkup(doc), opts.maxTokens * 0.4)
    : "";

  // 그리드
  const matrix = opts.sections.includes("grid")
    ? gridToText(doc.grid)
    : "";

  // 관계
  const relations = opts.sections.includes("relations")
    ? relationsToText(doc.relations)
    : "";

  // 포커스 상세
  const focusDetail = opts.focus
    ? generateFocusDetail(doc, allNodes, opts.focus)
    : undefined;

  // 프롬프트 조합
  const prompt = buildPrompt(opts.purpose, {
    summary,
    structure,
    matrix,
    relations,
    focusDetail,
  });

  return {
    purpose: opts.purpose,
    summary,
    structure,
    matrix,
    relations,
    focusDetail,
    prompt,
  };
}

// ─── 요약 생성 ──────────────────────────────────────────────────────

function generateSummary(
  doc: RLSCDocument,
  allNodes: readonly RLSCNode[],
): string {
  const visibleNodes = allNodes.filter((n) => n.visible);
  const totalArea = doc.viewport.width * doc.viewport.height;

  // 주요 영역 (면적 기준 상위 5개)
  const topNodes = [...visibleNodes]
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)
    .slice(0, 5);

  // 역할 분포
  const roleCounts = new Map<string, number>();
  for (const node of visibleNodes) {
    const role = node.role ?? "none";
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }

  // 레이어 수
  const layerCount = doc.layers.length;

  const lines: string[] = [
    `페이지: ${doc.url}`,
    `뷰포트: ${doc.viewport.width}×${doc.viewport.height}`,
    `가시 요소: ${visibleNodes.length}개`,
    `레이어: ${layerCount}개 (z-index 기준)`,
    ``,
    `주요 영역:`,
  ];

  for (const node of topNodes) {
    const areaPercent = (
      ((node.rect.width * node.rect.height) / totalArea) *
      100
    ).toFixed(1);
    const role = node.role ? ` (${node.role})` : "";
    lines.push(
      `  - ${node.id}${role}: ${node.rect.width}×${node.rect.height} (${areaPercent}%)`,
    );
  }

  lines.push(
    ``,
    `역할 분포: ${[...roleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([r, c]) => `${r}(${c})`)
      .join(", ")}`,
  );

  return lines.join("\n");
}

// ─── 포커스 상세 ────────────────────────────────────────────────────

function generateFocusDetail(
  doc: RLSCDocument,
  allNodes: readonly RLSCNode[],
  focus: string | LayoutRect,
): string {
  if (typeof focus === "string") {
    // 노드 ID로 검색
    const node = allNodes.find((n) => n.id === focus);
    if (!node) return `포커스 노드 '${focus}'를 찾을 수 없음`;
    return formatNodeDetail(node, allNodes, doc);
  } else {
    // rect 영역 내 노드
    const inRect = allNodes.filter((n) => rectIntersects(n.rect, focus));
    return [
      `포커스 영역: @(${focus.x},${focus.y}) ${focus.width}×${focus.height}`,
      `영역 내 요소: ${inRect.length}개`,
      ...inRect.slice(0, 10).map(
        (n) =>
          `  - ${n.id} @(${n.rect.x},${n.rect.y}) ${n.rect.width}×${n.rect.height} z:${n.zIndex}`,
      ),
    ].join("\n");
  }
}

function formatNodeDetail(
  node: RLSCNode,
  allNodes: readonly RLSCNode[],
  doc: RLSCDocument,
): string {
  const childCount = flattenTree(node).length - 1;
  const area = node.rect.width * node.rect.height;
  const viewportArea = doc.viewport.width * doc.viewport.height;

  const lines = [
    `포커스: ${node.id}`,
    `태그: <${node.tag}>`,
    `위치: @(${node.rect.x},${node.rect.y}) ${node.rect.width}×${node.rect.height}`,
    `z-index: ${node.zIndex}`,
    `역할: ${node.role ?? "없음"}`,
    `면적: ${area}px² (뷰포트의 ${((area / viewportArea) * 100).toFixed(1)}%)`,
    `하위 요소: ${childCount}개`,
    `display: ${node.display}`,
    `position: ${node.position}`,
  ];

  if (node.textContent) {
    lines.push(`텍스트: "${node.textContent}"`);
  }

  if (node.address) {
    lines.push(`좌표 주소: ${node.address}`);
  }

  return lines.join("\n");
}

// ─── 프롬프트 빌더 ─────────────────────────────────────────────────

const PROMPT_TEMPLATES: Record<ContextPurpose, string> = {
  "layout-analysis": `# 레이아웃 분석

아래는 웹 페이지의 R.L.S.C. (Relative Layout Structured Content) 분석 결과입니다.

## 요약
{summary}

## 구조 (R.L.S.C. 마크업)
\`\`\`
{structure}
\`\`\`

## 그리드 (공간 점유 행렬)
\`\`\`
{matrix}
\`\`\`

## 관계
\`\`\`
{relations}
\`\`\`
{focusSection}

이 레이아웃의 구조적 특성, 계층 관계, 공간 활용을 분석해주세요.`,

  "component-search": `# 컴포넌트 검색

R.L.S.C. 분석된 페이지에서 특정 컴포넌트를 찾아야 합니다.

## 페이지 구조
{summary}

## R.L.S.C. 트리
\`\`\`
{structure}
\`\`\`

## 그리드
\`\`\`
{matrix}
\`\`\`
{focusSection}

위 구조에서 요청된 컴포넌트의 위치, 크기, 역할을 식별해주세요.`,

  "design-generation": `# 디자인 생성

기존 R.L.S.C. 구조를 기반으로 새로운 디자인을 생성합니다.

## 현재 구조
{summary}

## R.L.S.C. 마크업
\`\`\`
{structure}
\`\`\`

## 공간 관계
\`\`\`
{relations}
\`\`\`
{focusSection}

현재 레이아웃 패턴을 유지하면서 요청된 변경사항을 R.L.S.C. 마크업으로 생성해주세요.`,

  "design-diff": `# 디자인 변경 비교

두 시점의 R.L.S.C. 분석을 비교합니다.

{summary}

## 현재 구조
\`\`\`
{structure}
\`\`\`
{focusSection}

변경된 요소, 이동된 위치, 크기 변화를 분석해주세요.`,

  "accessibility-audit": `# 접근성 감사

R.L.S.C. 분석을 기반으로 접근성 문제를 검사합니다.

## 구조
{summary}

## 트리 (역할 포함)
\`\`\`
{structure}
\`\`\`

## 레이어 스택
\`\`\`
{layers}
\`\`\`

## 관계
\`\`\`
{relations}
\`\`\`

ARIA 역할 누락, 키보드 접근성, 시각적 계층 문제를 분석해주세요.`,
};

function buildPrompt(
  purpose: ContextPurpose,
  data: {
    summary: string;
    structure: string;
    matrix: string;
    relations: string;
    focusDetail?: string;
  },
): string {
  let template = PROMPT_TEMPLATES[purpose];

  template = template.replace("{summary}", data.summary);
  template = template.replace("{structure}", data.structure);
  template = template.replace("{matrix}", data.matrix);
  template = template.replace("{relations}", data.relations);

  const focusSection = data.focusDetail
    ? `\n## 포커스 영역\n${data.focusDetail}\n`
    : "";
  template = template.replace("{focusSection}", focusSection);

  return template;
}

// ─── 유틸리티 ───────────────────────────────────────────────────────

function truncateToTokenBudget(text: string, maxTokens: number): string {
  // 대략 1 토큰 ≈ 4자
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... (truncated)";
}

function rectIntersects(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
