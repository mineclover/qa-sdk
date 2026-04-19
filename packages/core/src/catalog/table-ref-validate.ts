// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * table_ref colocation 정합성 검증
 *
 * prefix dims의 { kind: "table_ref", table } ↔ tables의 referencedBy 양방향 일치 검증
 */

import type { Catalog } from "./catalog.types.js";

export interface TableRefIssue {
  readonly severity: "error" | "warning";
  readonly message: string;
}

/**
 * 카탈로그의 table_ref 정합성을 검증한다.
 *
 * 1. prefix dim에서 table_ref로 참조하는 table이 catalog.tables에 존재하는지
 * 2. catalog.tables의 referencedBy가 실제 prefix dim의 table_ref와 일치하는지 (양방향)
 */
export function validateTableRefs(catalog: Catalog): TableRefIssue[] {
  const issues: TableRefIssue[] = [];
  const tables = catalog.tables ?? {};

  // 1단계: prefix dims에서 table_ref 수집
  // key: "table:prefixId.dimLabel" → 실제 참조 관계
  const actualRefs = new Set<string>();

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    for (const [dimLabel, dim] of Object.entries(prefix.dims)) {
      if (dim.kind !== "table_ref") continue;

      // table이 catalog.tables에 존재하는지
      if (!tables[dim.table]) {
        issues.push({
          severity: "warning",
          message: `prefix "${prefixId}".dims["${dimLabel}"] → table_ref "${dim.table}" 이 catalog.tables에 없음`,
        });
      }

      actualRefs.add(`${dim.table}:${prefixId}.${dimLabel}`);
    }
  }

  // 2단계: tables의 referencedBy 수집 → 실제 참조와 교차 검증
  const declaredRefs = new Set<string>();

  for (const [tableName, schema] of Object.entries(tables)) {
    if (!schema.referencedBy) continue;

    for (const ref of schema.referencedBy) {
      const key = `${tableName}:${ref.prefixId}.${ref.dimLabel}`;
      declaredRefs.add(key);

      // referencedBy에 선언했지만 실제 prefix dim에 table_ref 없음
      if (!actualRefs.has(key)) {
        issues.push({
          severity: "warning",
          message: `table "${tableName}".referencedBy에 "${ref.prefixId}.${ref.dimLabel}" 선언됨 — 실제 prefix dim에 table_ref 없음`,
        });
      }
    }
  }

  // 3단계: 실제 참조가 있지만 referencedBy에 미선언
  for (const key of actualRefs) {
    if (!declaredRefs.has(key)) {
      const [table, ref] = key.split(":");
      issues.push({
        severity: "warning",
        message: `prefix ${ref} → table_ref "${table}" — table의 referencedBy에 미선언 (colocation 누락)`,
      });
    }
  }

  return issues;
}
