import type {
  RLSCDocument,
  RLSCNode,
  LayoutRect,
  TextOccupancy,
  TextRegionDensity,
} from "./types.js";
import { flattenTree } from "./tree-utils.js";
import { extractRegions } from "./grid.js";
import {
  prepare,
  layout,
  prepareWithSegments,
  layoutWithLines,
} from "@chenglou/pretext";
import type { PreparedText } from "@chenglou/pretext";

/** pretext PreparedText를 nodeId로 매핑 */
export type TextPreparedMap = Map<string, PreparedText>;

/** 경계 접촉 판정 기본 임계값 (px) */
const DEFAULT_CONTACT_THRESHOLD = 4;

/**
 * 줄별 최대 너비와 줄 수를 산출한다.
 * prepareWithSegments + layoutWithLines를 사용하여 각 줄의 width를 측정한다.
 */
function measureLineStats(
  prepared: PreparedText,
  maxWidth: number,
  lineHeight: number,
): { lineCount: number; maxLineWidth: number } {
  // prepareWithSegments가 필요하지만 prepare 결과만 있으므로
  // layout 결과의 lineCount와 함께 maxWidth를 근사한다.
  // layoutWithLines가 가능한 경우 정확한 줄별 너비를 얻는다.
  try {
    const withSegments = prepared as Parameters<typeof layoutWithLines>[0];
    const result = layoutWithLines(withSegments, maxWidth, lineHeight);
    let maxLineW = 0;
    for (const line of result.lines) {
      if (line.width > maxLineW) maxLineW = line.width;
    }
    return { lineCount: result.lineCount, maxLineWidth: maxLineW };
  } catch {
    // fallback: layout만으로 lineCount 획득, maxLineWidth는 maxWidth로 근사
    const result = layout(prepared, maxWidth, lineHeight);
    return { lineCount: result.lineCount, maxLineWidth: maxWidth };
  }
}

/**
 * 텍스트의 자연 너비(줄바꿈 없이 한 줄에 렌더링한 너비)를 측정한다.
 * 매우 큰 maxWidth로 layout하여 한 줄일 때의 너비를 반환한다.
 */
function measureNaturalWidth(
  prepared: PreparedText,
  lineHeight: number,
): number {
  try {
    const withSegments = prepared as Parameters<typeof layoutWithLines>[0];
    const result = layoutWithLines(withSegments, 1e7, lineHeight);
    if (result.lines.length > 0) {
      return result.lines[0].width;
    }
  } catch {
    // fallback 불가 — 0 반환
  }
  return 0;
}

// ─── prepareTextMap ────────────────────────────────────────────────

/**
 * RLSCDocument의 텍스트 노드에 대해 pretext prepare()를 수행하여
 * PreparedText Map을 반환한다. 브라우저 환경(Canvas API) 필요.
 */
export function prepareTextMap(doc: RLSCDocument): TextPreparedMap {
  const map: TextPreparedMap = new Map();
  const nodes = flattenTree(doc.root);

  for (const node of nodes) {
    if (!node.textContent || !node.fontInfo) continue;
    const prepared = prepare(node.textContent, node.fontInfo.fontString);
    map.set(node.id, prepared);
  }

  return map;
}

// ─── analyzeTextOccupancy ──────────────────────────────────────────

export interface TextOccupancyOptions {
  /** 경계 접촉 판정 임계값 (px). 기본 4 */
  readonly contactThreshold?: number;
}

/**
 * 각 텍스트 노드의 시각적 공간 점유를 분석한다.
 * pretext의 layout()으로 실제 텍스트 렌더 크기를 산출하고,
 * 컨테이너 content-box 대비 점유율·경계 접촉·오버플로우를 계산한다.
 */
export function analyzeTextOccupancy(
  doc: RLSCDocument,
  preparedMap: TextPreparedMap,
  options?: TextOccupancyOptions,
): TextOccupancy[] {
  const threshold = options?.contactThreshold ?? DEFAULT_CONTACT_THRESHOLD;
  const nodes = flattenTree(doc.root);
  const results: TextOccupancy[] = [];

  for (const node of nodes) {
    const prepared = preparedMap.get(node.id);
    if (!prepared || !node.fontInfo) continue;

    const { padding, textAlign, lineHeight } = node.fontInfo;
    const { rect } = node;

    // content-box 크기
    const contentWidth = rect.width - padding.left - padding.right;
    const contentHeight = rect.height - padding.top - padding.bottom;

    // 빈 content-box: 스킵
    if (contentWidth <= 0 || contentHeight <= 0) continue;

    // pretext 측정
    const layoutResult = layout(prepared, contentWidth, lineHeight);
    const stats = measureLineStats(prepared, contentWidth, lineHeight);
    const naturalW = measureNaturalWidth(prepared, lineHeight);

    const textHeight = layoutResult.height;
    const maxLineWidth = stats.maxLineWidth;

    // text-align → textX (content-box 내 상대 좌표)
    let textX: number;
    switch (textAlign) {
      case "center":
        textX = (contentWidth - maxLineWidth) / 2;
        break;
      case "right":
        textX = contentWidth - maxLineWidth;
        break;
      case "justify":
      case "left":
      default:
        textX = 0;
        break;
    }

    // 여백 계산 (content-box 기준)
    const marginTop = 0; // 텍스트는 content-box 상단에서 시작
    const marginBottom = contentHeight - textHeight;
    const marginLeft = textX;
    const marginRight = contentWidth - maxLineWidth - textX;

    // 뷰포트 좌표 기준 텍스트 렌더링 rect
    const renderedRect: LayoutRect = {
      x: rect.x + padding.left + textX,
      y: rect.y + padding.top,
      width: maxLineWidth,
      height: textHeight,
    };

    // 오버플로우 판정
    const overflows = textHeight > contentHeight || maxLineWidth > contentWidth;

    results.push({
      nodeId: node.id,
      renderedRect,
      fillX: Math.min(1, maxLineWidth / contentWidth),
      fillY: Math.min(1, textHeight / contentHeight),
      lineCount: layoutResult.lineCount,
      naturalWidth: naturalW,
      margins: {
        top: Math.max(0, marginTop),
        right: Math.max(0, marginRight),
        bottom: Math.max(0, marginBottom),
        left: Math.max(0, marginLeft),
      },
      boundaryContact: {
        top: marginTop < threshold,
        right: marginRight < threshold,
        bottom: marginBottom < threshold,
        left: marginLeft < threshold,
      },
      overflows,
    });
  }

  return results;
}

// ─── aggregateTextRegions ──────────────────────────────────────────

/**
 * 그리드 영역(region)별로 TextOccupancy를 집계하여 텍스트 밀도를 계산한다.
 */
export function aggregateTextRegions(
  doc: RLSCDocument,
  occupancies: readonly TextOccupancy[],
): TextRegionDensity[] {
  const regions = extractRegions(doc.grid);
  const occMap = new Map(occupancies.map((o) => [o.nodeId, o]));
  const results: TextRegionDensity[] = [];

  for (const region of regions) {
    const regionWidth =
      (region.colEnd - region.colStart + 1) * doc.grid.cellSize;
    const regionHeight =
      (region.rowEnd - region.rowStart + 1) * doc.grid.cellSize;
    const regionArea = regionWidth * regionHeight;
    if (regionArea <= 0) continue;

    // 이 영역의 dominant nodeId에 해당하는 occupancy 찾기
    const occ = occMap.get(region.nodeId);
    if (!occ) {
      results.push({
        regionId: region.nodeId,
        textArea: 0,
        regionArea,
        density: 0,
        avgFillX: 0,
        avgFillY: 0,
        contactCount: 0,
      });
      continue;
    }

    const textArea = occ.renderedRect.width * occ.renderedRect.height;
    const hasContact =
      occ.boundaryContact.top ||
      occ.boundaryContact.right ||
      occ.boundaryContact.bottom ||
      occ.boundaryContact.left;

    results.push({
      regionId: region.nodeId,
      textArea,
      regionArea,
      density: Math.min(1, textArea / regionArea),
      avgFillX: occ.fillX,
      avgFillY: occ.fillY,
      contactCount: hasContact ? 1 : 0,
    });
  }

  return results;
}
