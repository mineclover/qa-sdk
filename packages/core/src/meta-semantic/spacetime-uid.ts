/**
 * Spacetime UID — 분기 경로 기반 시공간 주소 체계.
 *
 * 함수(function) × 경로(path) × 실행 순번(txSeq)을 단일 주소로 인코딩.
 * 전곱이 아닌 경로 합산 전략으로 도달 가능한 경우의 수만 수집한다.
 *
 * 스펙: docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-spacetime-uid.spec.md
 */

// ── 타입 ──────────────────────────────────────────────

/** 분기점 — 코드의 분기 결정 지점 */
export interface PathBranchPoint {
  readonly id: string;
  /** 분기 가능한 값의 수 */
  readonly branchCount: number;
}

/** 경로별 WeightedIndex 세그먼트 */
export interface IntentPathSegment {
  readonly pathId: string;
  readonly branchChain: readonly PathBranchPoint[];
  /** 각 분기점의 분기 수 (shape) */
  readonly shape: readonly number[];
  /** 전체 주소 공간에서의 시작 오프셋 */
  readonly addressOffset: number;
  /** 이 세그먼트의 주소 크기 (shape의 곱) */
  readonly size: number;
}

/** 시공간 UID 구성 요소 */
export interface SpacetimeUID {
  readonly functionIndex: number;
  readonly pathAddress: number;
  readonly txSeq: number;
}

/** decode 결과 */
export interface DecodedPath {
  readonly segment: IntentPathSegment;
  readonly coord: readonly number[];
}

// ── 세그먼트 빌더 ─────────────────────────────────────

/** 분기 체인 배열에서 세그먼트 목록 구성 (오프셋 자동 계산) */
export function buildSegments(
  paths: readonly { pathId: string; branchChain: readonly PathBranchPoint[] }[],
): IntentPathSegment[] {
  let offset = 0;
  return paths.map(p => {
    const shape = p.branchChain.map(bp => bp.branchCount);
    const size = shape.reduce((a, b) => a * b, 1);
    const segment: IntentPathSegment = {
      pathId: p.pathId,
      branchChain: p.branchChain,
      shape,
      addressOffset: offset,
      size,
    };
    offset += size;
    return segment;
  });
}

/** 전체 세그먼트의 주소 공간 크기 */
export function totalAddressSpace(segments: readonly IntentPathSegment[]): number {
  if (segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return last.addressOffset + last.size;
}

// ── 인코딩 ────────────────────────────────────────────

/** 세그먼트 내 좌표 → 전역 주소 (0-based coords) */
export function encodePathAddress(segment: IntentPathSegment, coord: readonly number[]): number {
  if (coord.length !== segment.shape.length) {
    throw new Error(`coord 차원(${coord.length}) ≠ shape 차원(${segment.shape.length})`);
  }
  let local = 0;
  let stride = 1;
  for (let i = segment.shape.length - 1; i >= 0; i--) {
    local += coord[i] * stride;
    stride *= segment.shape[i];
  }
  return segment.addressOffset + local;
}

/** 전역 주소 → 세그먼트 + 좌표 */
export function decodePathAddress(segments: readonly IntentPathSegment[], globalAddr: number): DecodedPath {
  for (const seg of segments) {
    if (globalAddr < seg.addressOffset + seg.size) {
      const local = globalAddr - seg.addressOffset;
      const coord: number[] = new Array(seg.shape.length);
      let remainder = local;
      for (let i = seg.shape.length - 1; i >= 0; i--) {
        coord[i] = remainder % seg.shape[i];
        remainder = Math.floor(remainder / seg.shape[i]);
      }
      return { segment: seg, coord };
    }
  }
  throw new Error(`주소 범위 초과: ${globalAddr} ≥ ${totalAddressSpace(segments)}`);
}

// ── 시공간 UID ────────────────────────────────────────

const PREFIX = "intent";
const VERSION = "v1";

/** 시공간 UID 생성 */
export function createSpacetimeUID(functionIndex: number, pathAddress: number, txSeq: number): string {
  return `${PREFIX}:${VERSION}:${functionIndex}:${pathAddress}:${txSeq}`;
}

/** 시공간 UID 파싱 */
export function parseSpacetimeUID(uid: string): SpacetimeUID {
  const parts = uid.split(":");
  if (parts.length !== 5 || parts[0] !== PREFIX || parts[1] !== VERSION) {
    throw new Error(`유효하지 않은 Spacetime UID: ${uid}`);
  }
  return {
    functionIndex: parseInt(parts[2], 10),
    pathAddress: parseInt(parts[3], 10),
    txSeq: parseInt(parts[4], 10),
  };
}

// ── 쿼리 패턴 ─────────────────────────────────────────

/** 특정 경로의 모든 실행을 조회하기 위한 범위 */
export function pathAddressRange(segment: IntentPathSegment): { start: number; end: number } {
  return { start: segment.addressOffset, end: segment.addressOffset + segment.size - 1 };
}

/** 특정 분기값이 포함된 모든 경로 주소 수집 */
export function addressesForBranch(
  segments: readonly IntentPathSegment[],
  branchId: string,
  branchValue: number,
): number[] {
  const addresses: number[] = [];
  for (const seg of segments) {
    const dimIdx = seg.branchChain.findIndex(bp => bp.id === branchId);
    if (dimIdx < 0) continue;

    // 이 세그먼트에서 해당 분기값이 고정된 모든 좌표를 열거
    const totalCoords = seg.size;
    for (let local = 0; local < totalCoords; local++) {
      // dimIdx 위치의 좌표를 역산
      let remainder = local;
      const coords: number[] = new Array(seg.shape.length);
      for (let i = seg.shape.length - 1; i >= 0; i--) {
        coords[i] = remainder % seg.shape[i];
        remainder = Math.floor(remainder / seg.shape[i]);
      }
      if (coords[dimIdx] === branchValue) {
        addresses.push(seg.addressOffset + local);
      }
    }
  }
  return addresses;
}
