/**
 * SemanticRefEntries — 의미값 기반 refEntries 정의 + 파생.
 *
 * refEntries의 원본은 의미(문자열 조합)이고, 정수 주소는 파생이다.
 * capacity가 바뀌면 이 함수를 재실행하여 정수를 재생성한다.
 *
 * 이것이 DSL DB에서 "문자열이 원본, 정수는 파생"의 핵심 구현.
 */

import type { Catalog } from "@qa-sdk/core";
import { encodePrefixByValue, decodePrefix } from "@qa-sdk/core";

// ═══════════════════════════════════════════════════════════════
//  타입
// ═══════════════════════════════════════════════════════════════

/** 의미값 기반 refEntry 정의 — 정수가 아닌 문자열 조합 */
export interface SemanticRefEntry {
  /** 참조 prefix의 차원별 의미값 */
  readonly values: Record<string, string | number>;
  /** 설명 (선택) */
  readonly label?: string;
}

/** prefix version의 의미 기반 refEntries 전체 정의 */
export interface SemanticRefEntries {
  readonly prefixId: string;
  readonly version: string;
  readonly dimLabel: string;
  readonly refPrefix: string;
  readonly refVersion: string;
  readonly entries: readonly SemanticRefEntry[];
}

/** 파생 결과 */
export interface DerivedRefEntries {
  readonly source: SemanticRefEntries;
  readonly values: readonly number[];
  readonly details: readonly {
    readonly meaning: Record<string, string | number>;
    readonly address: number;
    readonly label?: string;
  }[];
}

/** 검증 결과 */
export interface RefValidationResult {
  readonly prefixId: string;
  readonly version: string;
  readonly dimLabel: string;
  readonly valid: boolean;
  readonly currentValues: readonly number[];
  readonly derivedValues: readonly number[];
  readonly mismatches: readonly {
    readonly index: number;
    readonly current: number;
    readonly derived: number;
    readonly meaning: Record<string, string | number>;
  }[];
}

// ═══════════════════════════════════════════════════════════════
//  파생
// ═══════════════════════════════════════════════════════════════

/**
 * 의미값에서 정수 주소를 파생한다.
 *
 * 각 entry의 values를 encodePrefixByValue로 인코딩하여
 * 현재 shape 기준의 정수 배열을 반환한다.
 */
export function deriveRefEntries(
  catalog: Catalog,
  semantic: SemanticRefEntries,
): DerivedRefEntries {
  const details: DerivedRefEntries["details"][number][] = [];
  const values: number[] = [];

  for (const entry of semantic.entries) {
    const address = encodePrefixByValue(
      catalog,
      semantic.refPrefix,
      semantic.refVersion,
      entry.values,
    );
    values.push(address);
    details.push({
      meaning: entry.values,
      address,
      label: entry.label,
    });
  }

  return { source: semantic, values, details };
}

/**
 * 현재 DEMO_CATALOG의 refEntries가 semantic 정의와 일치하는지 검증한다.
 */
export function validateRefEntries(
  catalog: Catalog,
  semantic: SemanticRefEntries,
): RefValidationResult {
  const derived = deriveRefEntries(catalog, semantic);

  const prefix = catalog.prefixes[semantic.prefixId];
  const vdef = prefix?.versions.find(v => v.version === semantic.version);
  const currentValues = vdef?.refEntries?.[semantic.dimLabel]?.values ?? [];

  const mismatches: RefValidationResult["mismatches"][number][] = [];

  for (let i = 0; i < Math.max(currentValues.length, derived.values.length); i++) {
    const current = currentValues[i];
    const derivedVal = derived.values[i];
    if (current !== derivedVal) {
      mismatches.push({
        index: i,
        current: current ?? -1,
        derived: derivedVal ?? -1,
        meaning: derived.details[i]?.meaning ?? {},
      });
    }
  }

  return {
    prefixId: semantic.prefixId,
    version: semantic.version,
    dimLabel: semantic.dimLabel,
    valid: mismatches.length === 0,
    currentValues: [...currentValues],
    derivedValues: [...derived.values],
    mismatches,
  };
}

// ═══════════════════════════════════════════════════════════════
//  역파생: 정수 → 의미값 복원 (version 필요)
// ═══════════════════════════════════════════════════════════════

/**
 * 기존 refEntries의 정수 주소에서 의미값을 복원한다.
 * version 정보가 있으면 항상 가능하다 (sealed version은 영원히 보존).
 */
export function recoverSemanticFromAddresses(
  catalog: Catalog,
  refPrefix: string,
  refVersion: string,
  addresses: readonly number[],
): SemanticRefEntry[] {
  return addresses.map(addr => {
    const decoded = decodePrefix(catalog, refPrefix, refVersion, addr);
    const values: Record<string, string | number> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      values[label] = dim.value;
    }
    return { values };
  });
}

/**
 * 특정 의미값이 어떤 version에 존재하는지 찾는다.
 *
 * CLI: "이 문자열이 있던 버전을 찾아줘"
 */
export function findVersionForEntry(
  catalog: Catalog,
  axisId: string,
  entryValue: string,
): string[] {
  const axis = (catalog.axes as Record<string, { versions: Record<string, { entries: readonly string[] }> }>)[axisId];
  if (!axis) return [];

  const found: string[] = [];
  for (const [version, snap] of Object.entries(axis.versions)) {
    if (snap.entries.includes(entryValue)) {
      found.push(version);
    }
  }
  return found;
}

/**
 * prefix의 refEntries에서 특정 service 조합의 주소를 찾는다.
 *
 * CLI: "이 조합의 주소가 뭐야?"
 */
export function findRefAddress(
  catalog: Catalog,
  prefixId: string,
  version: string,
  dimLabel: string,
  meaning: Record<string, string | number>,
): { address: number; index: number } | null {
  const prefix = catalog.prefixes[prefixId];
  const vdef = prefix?.versions.find(v => v.version === version);
  const refEntries = vdef?.refEntries?.[dimLabel];
  if (!refEntries) return null;

  const dimRef = prefix.dims[dimLabel];
  if (dimRef.kind !== "prefix_ref") return null;

  const targetAddr = encodePrefixByValue(catalog, dimRef.prefixId, refEntries.refVersion, meaning);

  const index = refEntries.values.indexOf(targetAddr);
  if (index === -1) return null;

  return { address: targetAddr, index };
}
