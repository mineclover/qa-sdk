/**
 * RefEntries 동기화 — capacity 변경 후 refEntries를 최신 shape에 맞게 재생성.
 *
 * refEntries의 values는 참조 prefix의 주소 목록이다.
 * 참조 prefix의 shape이 바뀌면 같은 좌표 조합이 다른 주소를 생성하므로
 * refEntries도 재생성해야 한다.
 *
 * CLI의 핵심 목적: capacity 변경 → 최신 값으로 동기화.
 */

import type { DemoCatalog, PrefixDef, PrefixVersionDef } from "demo-snapshot";
import { encodePrefixByValue, decodePrefix } from "demo-snapshot";

export interface RefEntrySyncResult {
  readonly prefix: string;
  readonly version: string;
  readonly dimLabel: string;
  readonly refPrefix: string;
  readonly refVersion: string;
  readonly oldValues: readonly number[];
  readonly newValues: readonly number[];
  readonly changed: boolean;
  /** 변경된 주소 매핑 (old → new) */
  readonly mapping: readonly { old: number; new: number; meaning: Record<string, string | number> }[];
}

/**
 * DEMO_CATALOG의 모든 prefix_ref refEntries를 현재 shape에 맞게 재계산한다.
 *
 * 각 refEntry의 old address를 decode(old shape) → re-encode(current shape)하여
 * 최신 주소로 변환한다.
 */
export function syncRefEntries(
  catalog: DemoCatalog,
): RefEntrySyncResult[] {
  const results: RefEntrySyncResult[] = [];

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    for (const vdef of prefix.versions) {
      if (!vdef.refEntries) continue;

      for (const [dimLabel, refEntry] of Object.entries(vdef.refEntries)) {
        const dimRef = prefix.dims[dimLabel];
        if (dimRef.kind !== "prefix_ref") continue;

        const refPrefixId = dimRef.prefixId;
        const refVersion = refEntry.refVersion;

        // 각 old address를 decode → re-encode
        const mapping: { old: number; new: number; meaning: Record<string, string | number> }[] = [];
        const newValues: number[] = [];

        for (const oldAddr of refEntry.values) {
          try {
            // old address를 decode (현재 shape 기준 — shape이 바뀌었으면 다른 좌표)
            const decoded = decodePrefix(catalog, refPrefixId, refVersion, oldAddr);
            const meaning: Record<string, string | number> = {};
            for (const [label, dim] of Object.entries(decoded)) {
              meaning[label] = dim.value;
            }

            // 같은 의미값으로 re-encode (현재 shape 기준)
            const newAddr = encodePrefixByValue(catalog, refPrefixId, refVersion, meaning);

            mapping.push({ old: oldAddr, new: newAddr, meaning });
            newValues.push(newAddr);
          } catch {
            // decode 실패 시 (old address가 현재 shape에서 유효하지 않으면)
            // old 값 유지
            newValues.push(oldAddr);
            mapping.push({ old: oldAddr, new: oldAddr, meaning: {} });
          }
        }

        const changed = newValues.some((v, i) => v !== refEntry.values[i]);

        results.push({
          prefix: prefixId,
          version: vdef.version,
          dimLabel,
          refPrefix: refPrefixId,
          refVersion,
          oldValues: [...refEntry.values],
          newValues,
          changed,
          mapping,
        });
      }
    }
  }

  return results;
}

/**
 * syncRefEntries 결과를 콘솔에 출력한다.
 */
export function printSyncReport(results: readonly RefEntrySyncResult[]): void {
  const changed = results.filter(r => r.changed);

  if (changed.length === 0) {
    console.log("  ✅ 모든 refEntries가 최신 shape과 일치합니다.");
    return;
  }

  console.log(`  ⚠ ${changed.length}개 refEntries 동기화 필요:\n`);

  for (const r of changed) {
    console.log(`  ${r.prefix}:${r.version}.${r.dimLabel} → ${r.refPrefix}:${r.refVersion}`);
    console.log(`    old: [${r.oldValues.join(", ")}]`);
    console.log(`    new: [${r.newValues.join(", ")}]`);
    for (const m of r.mapping) {
      if (m.old !== m.new) {
        const meaning = Object.entries(m.meaning).map(([k, v]) => `${k}=${v}`).join(", ");
        console.log(`    ${m.old} → ${m.new}  (${meaning})`);
      }
    }
    console.log();
  }
}
