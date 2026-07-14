import type { TaxonomyRegistry } from '../registry/index.js';
import type { Diagnostic } from '../schema/diagnostic.js';

/**
 * checkContentHashDrift — caller가 이전 codegen 결과의 contentHash와
 * 현재 결과의 contentHash를 비교. 다르면 warning emit.
 * 같으면 undefined 반환.
 */
export function checkContentHashDrift(
  previous: string,
  current: string,
  ref?: string,
): Diagnostic | undefined {
  if (previous === current) return undefined;
  return {
    severity: 'warning',
    code: 'codegen-content-hash-mismatch',
    message: `codegen contentHash drift: 이전=${previous} → 현재=${current}`,
    ref,
    meta: { previous, current },
  };
}

/**
 * validateRegistryVersions — registry 내 모든 taxonomy의 imports 검사.
 * 각 import의 요청 version과 등록된 실제 version 비교, 불일치 시 version-drift warning.
 */
export function validateRegistryVersions(registry: TaxonomyRegistry): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const slug of registry.list()) {
    const ir = registry.get(slug);
    if (!ir) continue;
    for (const [i, imp] of ir.imports.entries()) {
      if (imp.version === undefined) continue;
      const target = registry.get(imp.taxonomy);
      if (!target) continue; // ref-unresolved-import는 validateRefs에서 처리
      if (target.version !== imp.version) {
        out.push({
          severity: 'warning',
          code: 'version-drift',
          message: `${slug}/imports[${i}]: ${imp.taxonomy}@v${imp.version} 요청, registry는 v${target.version}`,
          ref: `${slug}#/imports/${i}`,
          meta: {
            taxonomy: imp.taxonomy,
            requested: imp.version,
            available: target.version,
            consumer: slug,
            index: i,
          },
        });
      }
    }
  }
  return out;
}
