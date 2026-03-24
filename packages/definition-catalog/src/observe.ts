/**
 * 관찰 레이어 — 좌표 인코딩/디코딩
 *
 * DefinitionEntry의 메타데이터(scope, aspect, depth, lifecycle)를
 * 1D 정수 주소로 인코딩하고, 역으로 디코딩한다.
 *
 * WeightedIndex를 사용하며, lazy init으로 성능을 관리한다.
 *
 * ┌─────────────────┐    ┌──────────────┐    ┌──────────────┐
 * │ DefinitionEntry │───▶│   encode()   │───▶│  1D 정수 주소  │
 * │ (scope, aspect, │    │              │    │  + 직렬화     │
 * │  depth, lifecycle)│   └──────────────┘    └──────────────┘
 * └─────────────────┘           ▲
 *                               │
 *                        ┌──────┴──────┐
 *                        │   decode()  │
 *                        └─────────────┘
 */

import { WeightedIndex } from "weighted-index";
import { DEF_SCOPE, DEF_ASPECT, DEF_DEPTH, LINK_TYPE } from "./vocabulary.js";
import type { DefScope, DefAspect, DefDepth, LinkType } from "./types.js";

// ─── 좌표 인덱스 (lazy init) ─────────────────────────────

let _documentIdx: WeightedIndex | undefined;
let _linkIdx: WeightedIndex | undefined;

/**
 * def_document prefix의 WeightedIndex.
 *
 * lifecycle은 좌표에 포함하지 않는다 — 변하는 상태이므로 주소를 불변으로 유지.
 * 좌표 = scope × aspect × depth (불변 정체성)
 * lifecycle = 메타데이터 필드로만 관리
 */
function documentIndex(): WeightedIndex {
  return (_documentIdx ??= new WeightedIndex(
    [DEF_SCOPE.capacity, DEF_ASPECT.capacity, DEF_DEPTH.capacity],
    ["def_scope", "def_aspect", "def_depth"],
  ));
}

/** def_link prefix의 WeightedIndex */
function linkIndex(): WeightedIndex {
  return (_linkIdx ??= new WeightedIndex(
    [DEF_SCOPE.capacity, DEF_ASPECT.capacity, LINK_TYPE.capacity],
    ["def_scope", "def_aspect", "link_type"],
  ));
}

// ─── 인코딩 유틸 ─────────────────────────────────────────

/** entries 배열에서 1-based 인덱스 조회 */
function indexOf(entries: readonly string[], value: string): number {
  const idx = entries.indexOf(value);
  if (idx === -1) throw new Error(`"${value}" not found in entries`);
  return idx + 1; // WeightedIndex는 1-based
}

// ─── def_document 인코딩/디코딩 ──────────────────────────

/** def_document 인코딩 입력 (불변 정체성만 — lifecycle 제외) */
export interface DocumentCoordinate {
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
}

/** 디코딩 결과 */
export interface DecodedDocument {
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly depth: DefDepth;
}

/**
 * 문서 메타데이터를 1D 정수 주소로 인코딩한다.
 *
 * scope × aspect × depth → 정수 (불변)
 * lifecycle은 좌표에 포함하지 않는다.
 */
export function encodeDocument(coord: DocumentCoordinate): number {
  return documentIndex().encode([
    indexOf(DEF_SCOPE.entries, coord.scope),
    indexOf(DEF_ASPECT.entries, coord.aspect),
    indexOf(DEF_DEPTH.entries, coord.depth),
  ]);
}

/**
 * 1D 정수 주소를 문서 메타데이터로 디코딩한다.
 *
 * 정수 → scope × aspect × depth
 */
export function decodeDocument(address: number): DecodedDocument {
  const coords = documentIndex().decode(address);
  return {
    scope: DEF_SCOPE.entries[coords[0] - 1] as DefScope,
    aspect: DEF_ASPECT.entries[coords[1] - 1] as DefAspect,
    depth: DEF_DEPTH.entries[coords[2] - 1] as DefDepth,
  };
}

/**
 * 문서 좌표를 직렬화한다.
 * 형식: "def_document:v1:<address>"
 */
export function serializeDocumentAddress(address: number): string {
  return `def_document:v1:${address}`;
}

/**
 * 직렬화된 문서 좌표를 파싱한다.
 * @returns address 정수, 또는 null (파싱 실패 시)
 */
export function parseDocumentAddress(serialized: string): number | null {
  const match = serialized.match(/^def_document:v1:(\d+)$/);
  return match ? Number(match[1]) : null;
}

// ─── def_link 인코딩/디코딩 ──────────────────────────────

/** def_link 인코딩 입력 */
export interface LinkCoordinate {
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly linkType: LinkType;
}

/** def_link 디코딩 결과 */
export interface DecodedLink {
  readonly scope: DefScope;
  readonly aspect: DefAspect;
  readonly linkType: LinkType;
}

/**
 * 관계를 1D 정수 주소로 인코딩한다.
 *
 * scope × aspect × link_type → 정수
 */
export function encodeLink(coord: LinkCoordinate): number {
  return linkIndex().encode([
    indexOf(DEF_SCOPE.entries, coord.scope),
    indexOf(DEF_ASPECT.entries, coord.aspect),
    indexOf(LINK_TYPE.entries, coord.linkType),
  ]);
}

/**
 * 1D 정수 주소를 관계 메타데이터로 디코딩한다.
 */
export function decodeLink(address: number): DecodedLink {
  const coords = linkIndex().decode(address);
  return {
    scope: DEF_SCOPE.entries[coords[0] - 1] as DefScope,
    aspect: DEF_ASPECT.entries[coords[1] - 1] as DefAspect,
    linkType: LINK_TYPE.entries[coords[2] - 1] as LinkType,
  };
}

// ─── 주소 공간 정보 ──────────────────────────────────────

/** def_document prefix의 총 주소 공간 크기 */
export function documentTotalSpace(): number {
  return documentIndex().size;
}

/** def_link prefix의 총 주소 공간 크기 */
export function linkTotalSpace(): number {
  return linkIndex().size;
}
