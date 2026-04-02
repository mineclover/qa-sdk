/**
 * 경로 합산 인코딩/디코딩 — 이벤트 분기의 명시적 주소 체계
 *
 * 전곱(product): WeightedIndex 단일 인스턴스, 모든 축 직교
 * 합산(sum): PathSegment[] 연접, 분기 토폴로지 명시
 *
 * 합산은 전곱의 상위 집합 — 전곱은 세그먼트 1개인 합산
 */

import type { PathSegment, EventTransition, BranchRoute, PrefixDef, Catalog } from "./catalog.types.js";

// ── 세그먼트 생성 ────────────────────────────────────

/** PathSegment 생성 헬퍼 — size와 offset 자동 계산 */
export function createSegment(
  segmentId: string,
  consumes: readonly string[],
  shape: readonly number[],
  addressOffset: number,
  options?: {
    children?: readonly PathSegment[];
    transition?: { eventKey: string; prefixId?: string };
  },
): PathSegment {
  if (consumes.length !== shape.length) {
    throw new Error(`consumes(${consumes.length})과 shape(${shape.length}) 길이 불일치`);
  }
  if (shape.some(s => s <= 0)) {
    throw new Error("shape의 모든 값은 1 이상이어야 함");
  }

  const size = shape.reduce((a, b) => a * b, 1);

  return {
    segmentId,
    consumes,
    shape,
    addressOffset,
    size,
    ...(options?.children ? { children: options.children } : {}),
    ...(options?.transition ? { transition: options.transition } : {}),
  };
}

/** 세그먼트 배열의 offset을 자동 연접 */
export function chainSegments(segments: Omit<PathSegment, "addressOffset" | "size">[]): PathSegment[] {
  let offset = 0;
  return segments.map(seg => {
    const size = seg.shape.reduce((a, b) => a * b, 1);
    const result: PathSegment = {
      ...seg,
      addressOffset: offset,
      size,
    };
    offset += size;
    return result;
  });
}

// ── 인코딩 ───────────────────────────────────────────

/** 세그먼트 내 좌표 → 전역 주소 */
export function encodeBySegment(
  segments: readonly PathSegment[],
  segmentId: string,
  coord: readonly number[],
): number {
  const seg = findSegment(segments, segmentId);
  if (!seg) throw new Error(`세그먼트 "${segmentId}" 없음`);

  if (coord.length !== seg.shape.length) {
    throw new Error(`좌표 길이(${coord.length})와 shape(${seg.shape.length}) 불일치`);
  }

  // WeightedIndex 인코딩 (mixed-radix)
  let address = 0;
  let stride = 1;
  for (let i = seg.shape.length - 1; i >= 0; i--) {
    if (coord[i] < 0 || coord[i] >= seg.shape[i]) {
      throw new Error(`좌표[${i}]=${coord[i]}가 범위 [0, ${seg.shape[i] - 1}] 초과`);
    }
    address += coord[i] * stride;
    stride *= seg.shape[i];
  }

  return seg.addressOffset + address;
}

// ── 디코딩 ───────────────────────────────────────────

/** 디코딩 결과 */
export interface DecodedPath {
  /** 매칭된 세그먼트 */
  segment: PathSegment;
  /** 세그먼트 내 좌표 */
  coord: number[];
  /** dim 라벨 → 좌표 값 매핑 */
  values: Record<string, number>;
  /** 해석된 전이 대상 — route 매칭 > segment transition > undefined */
  transition?: EventTransition;
}

/** 전역 주소 → 세그먼트 + 좌표 */
export function decodeBySegment(
  segments: readonly PathSegment[],
  globalAddress: number,
): DecodedPath {
  const seg = findSegmentByAddress(segments, globalAddress);
  if (!seg) {
    throw new Error(`주소 ${globalAddress}가 어떤 세그먼트에도 속하지 않음 (totalSize: ${totalSize(segments)})`);
  }

  const localAddress = globalAddress - seg.addressOffset;

  // WeightedIndex 디코딩 (mixed-radix)
  const coord: number[] = new Array(seg.shape.length);
  let remaining = localAddress;
  for (let i = seg.shape.length - 1; i >= 0; i--) {
    coord[i] = remaining % seg.shape[i];
    remaining = Math.floor(remaining / seg.shape[i]);
  }

  const values: Record<string, number> = {};
  for (let i = 0; i < seg.consumes.length; i++) {
    values[seg.consumes[i]] = coord[i];
  }

  // 전이 해석: route 매칭 > segment transition > undefined
  const transition = resolveTransition(seg, values);

  return {
    segment: seg,
    coord,
    values,
    ...(transition ? { transition } : {}),
  };
}

// ── 조회 ─────────────────────────────────────────────

/** 전체 주소 공간 크기 */
export function totalSize(segments: readonly PathSegment[]): number {
  if (segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return last.addressOffset + last.size;
}

/** 전이 정보 — segment 전체 전이 또는 route별 값 분기 */
export interface TransitionEntry {
  segmentId: string;
  eventKey: string;
  prefixId?: string;
  /** route 조건 (값 분기일 때) */
  condition?: { axis: string; eq?: number; in?: readonly number[] };
}

/** 세그먼트 목록에서 전이 대상 이벤트 수집 (segment + route 모두) */
export function collectTransitions(segments: readonly PathSegment[]): TransitionEntry[] {
  const result: TransitionEntry[] = [];

  function walk(segs: readonly PathSegment[]): void {
    for (const seg of segs) {
      // route별 전이 (값 단위)
      if (seg.routes) {
        for (const route of seg.routes) {
          result.push({
            segmentId: seg.segmentId,
            ...route.transition,
            condition: { axis: route.when.axis, eq: route.when.eq, in: route.when.in },
          });
        }
      }
      // segment 전체 전이
      if (seg.transition) {
        result.push({ segmentId: seg.segmentId, ...seg.transition });
      }
      if (seg.children) walk(seg.children);
    }
  }

  walk(segments);
  return result;
}

/** 전곱 PrefixDef를 단일 세그먼트로 변환 */
export function productToSegment(
  dims: Record<string, { entries: readonly string[] }>,
  labels: readonly string[],
): PathSegment {
  const shape = labels.map(label => {
    const dim = dims[label];
    if (!dim) throw new Error(`dim "${label}" 없음`);
    return dim.entries.length;
  });

  return createSegment("product", labels, shape, 0);
}

// ── 검증 ─────────────────────────────────────────────

/** 세그먼트 배열 검증 */
export function validateSegments(segments: readonly PathSegment[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  function walk(segs: readonly PathSegment[], parentOffset: number): void {
    let expectedOffset = parentOffset;
    for (const seg of segs) {
      // 유일성
      if (ids.has(seg.segmentId)) {
        errors.push(`중복 segmentId: "${seg.segmentId}"`);
      }
      ids.add(seg.segmentId);

      // offset 연속성
      if (seg.addressOffset !== expectedOffset) {
        errors.push(`"${seg.segmentId}" offset ${seg.addressOffset} ≠ 기대값 ${expectedOffset}`);
      }

      // size 정합성
      const expectedSize = seg.shape.reduce((a, b) => a * b, 1);
      if (seg.size !== expectedSize) {
        errors.push(`"${seg.segmentId}" size ${seg.size} ≠ shape 곱 ${expectedSize}`);
      }

      // dims/shape 길이
      if (seg.consumes.length !== seg.shape.length) {
        errors.push(`"${seg.segmentId}" dims(${seg.consumes.length}) ≠ shape(${seg.shape.length})`);
      }

      expectedOffset += seg.size;

      if (seg.children) {
        walk(seg.children, seg.addressOffset);
      }
    }
  }

  walk(segments, 0);
  return errors;
}

/**
 * prefix 카탈로그 컨텍스트에서 세그먼트 검증.
 * - consumes가 prefix.dims의 부분집합인지
 * - route 축이 consumes에 포함되는지
 * - shape가 실제 axis entries/capacity와 일치하는지 (catalog 제공 시)
 */
export function validatePrefixSegments(
  prefix: PrefixDef,
  segments: readonly PathSegment[],
  catalog?: Catalog,
  version?: string,
): string[] {
  const errors = validateSegments(segments);
  const dimLabels = new Set(Object.keys(prefix.dims));

  // version별 axis capacity 맵 구축 (catalog 제공 시)
  const capacityMap = new Map<string, number>();
  if (catalog && version) {
    const vdef = prefix.versions.find(v => v.version === version);
    if (vdef) {
      for (const label of Object.keys(prefix.dims)) {
        const dim = prefix.dims[label];
        if (dim.kind === "axis") {
          const axisVer = vdef.axisVersions[label];
          const axis = catalog.axes[dim.axisId];
          if (axis && axisVer) {
            const snap = axis.versions[axisVer];
            if (snap) {
              capacityMap.set(label, snap.capacity ?? snap.entries.length);
            }
          }
        }
      }
    }
  }

  function walkPrefix(segs: readonly PathSegment[]): void {
    for (const seg of segs) {
      // consumes가 prefix dims의 부분집합인지
      for (let i = 0; i < seg.consumes.length; i++) {
        const label = seg.consumes[i];
        if (!dimLabels.has(label)) {
          errors.push(`"${seg.segmentId}" consumes "${label}" — prefix "${prefix.id}"에 없는 dim`);
          continue;
        }

        // shape ↔ axis capacity 정합성 (catalog 제공 시)
        if (capacityMap.size > 0) {
          const expectedCap = capacityMap.get(label);
          if (expectedCap !== undefined && seg.shape[i] !== expectedCap) {
            errors.push(
              `"${seg.segmentId}" shape[${i}]=${seg.shape[i]} ≠ axis "${label}" capacity ${expectedCap}`,
            );
          }
        }
      }

      // route 축이 consumes에 포함되는지
      if (seg.routes) {
        const consumesSet = new Set(seg.consumes);
        for (const route of seg.routes) {
          if (!consumesSet.has(route.when.axis)) {
            errors.push(`"${seg.segmentId}" route axis "${route.when.axis}" — consumes에 없음`);
          }
          // route value가 shape 범위 내인지
          if (route.when.eq !== undefined) {
            const idx = seg.consumes.indexOf(route.when.axis);
            if (idx >= 0 && route.when.eq >= seg.shape[idx]) {
              errors.push(
                `"${seg.segmentId}" route ${route.when.axis}=${route.when.eq} ≥ shape ${seg.shape[idx]}`,
              );
            }
          }
        }
      }

      if (seg.children) walkPrefix(seg.children);
    }
  }

  walkPrefix(segments);
  return errors;
}

/**
 * manifest publish 시 sum prefix의 segment 정합성 검증.
 * manifest가 참조하는 prefix 중 addressModel:"sum"인 것에 대해
 * segments가 유효한지 카탈로그 기준으로 검증한다.
 */
export function validateManifestSegments(
  catalog: Catalog,
  manifestPrefixes: Record<string, string>,
): string[] {
  const errors: string[] = [];

  for (const [prefixId, version] of Object.entries(manifestPrefixes)) {
    const prefix = catalog.prefixes[prefixId];
    if (!prefix || prefix.addressModel !== "sum") continue;

    const vdef = prefix.versions.find(v => v.version === version);
    if (!vdef) {
      errors.push(`prefix "${prefixId}:${version}" — 버전 미존재`);
      continue;
    }

    if (!vdef.segments || vdef.segments.length === 0) {
      errors.push(`prefix "${prefixId}:${version}" — addressModel:sum이지만 segments 없음`);
      continue;
    }

    const segErrors = validatePrefixSegments(prefix, vdef.segments, catalog, version);
    for (const e of segErrors) {
      errors.push(`prefix "${prefixId}:${version}" — ${e}`);
    }
  }

  return errors;
}

// ── 내부 헬퍼 ────────────────────────────────────────

function findSegment(segments: readonly PathSegment[], segmentId: string): PathSegment | undefined {
  for (const seg of segments) {
    if (seg.segmentId === segmentId) return seg;
    if (seg.children) {
      const found = findSegment(seg.children, segmentId);
      if (found) return found;
    }
  }
  return undefined;
}

/** 축 값에 따라 전이 대상 해석: route 우선, 없으면 segment transition */
function resolveTransition(
  seg: PathSegment,
  values: Record<string, number>,
): EventTransition | undefined {
  // route 매칭 (값 단위 분기)
  if (seg.routes) {
    for (const route of seg.routes) {
      if (matchRoute(route, values)) return route.transition;
    }
  }
  // segment 전체 전이 (폴백)
  return seg.transition;
}

function matchRoute(route: BranchRoute, values: Record<string, number>): boolean {
  const val = values[route.when.axis];
  if (val === undefined) return false;
  if (route.when.eq !== undefined) return val === route.when.eq;
  if (route.when.in !== undefined) return route.when.in.includes(val);
  return false;
}

function findSegmentByAddress(segments: readonly PathSegment[], address: number): PathSegment | undefined {
  for (const seg of segments) {
    if (address >= seg.addressOffset && address < seg.addressOffset + seg.size) {
      // 하위 세그먼트가 있으면 더 정확한 매칭 시도
      if (seg.children) {
        const child = findSegmentByAddress(seg.children, address);
        if (child) return child;
      }
      return seg;
    }
  }
  return undefined;
}
