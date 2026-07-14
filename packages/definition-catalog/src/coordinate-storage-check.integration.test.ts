// @def.boundary definition-catalog-spec
// @def.doc coordinate-storage

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanCoordinateStorage } from './coordinate-storage-check.js';

describe('coordinate-storage 자동 검출 — packages/ 통합 스캔', () => {
  const REPO_ROOT = resolve(__dirname, '../../..');

  it('packages/ 전체에 위반이 없거나, 모든 위반은 명시적 exempt 또는 backlog에 등록되어 있다', () => {
    const violations = scanCoordinateStorage({ repoRoot: REPO_ROOT });

    // 위반이 있다면 콘솔에 상세 출력 (CI에서 진단 도움)
    if (violations.length > 0) {
      console.log('[coord-storage 위반]');
      for (const v of violations) {
        console.log(`  ${v.filePath}:${v.lineNumber} (${v.tableName}) — ${v.kind}: ${v.message}`);
      }
    }

    // 본 테스트는 §4 plan 완료 후 통과해야 한다.
    // §4 plan 미완료 시: key_observations + key_observation_prefixes 위반 발생 → 본 테스트는 정상 fail.
    expect(violations).toEqual([]);
  });
});
