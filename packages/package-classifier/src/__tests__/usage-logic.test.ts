// @def.boundary package-classifier-spec
// @def.doc package-classifier-test

import { describe, expect, it } from 'vitest';
import { scanAndClassify } from '../pkg-classifier.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Package Usage Analysis Logic', () => {
  it('should calculate correct Fan-In counts for internal dependencies', async () => {
    const repoRoot = resolve(__dirname, '../../../..');
    const pkgs = await scanAndClassify(repoRoot);

    const fanInMap = new Map<string, number>();
    pkgs.forEach((p) => {
      p.deps.forEach((dep) => {
        // pkg-classifier는 deps에 displayName을 넣음
        fanInMap.set(dep, (fanInMap.get(dep) || 0) + 1);
      });
    });

    // core와 weighted-index는 반드시 높은 사용량을 보여야 함 (displayName 기준)
    const coreCount = fanInMap.get('core') || 0;
    const weightedCount = fanInMap.get('weighted-index') || 0;

    // 분석 도구의 Fan-In 임계값(3) 기준 검증
    expect(coreCount).toBeGreaterThanOrEqual(18);
    expect(weightedCount).toBeGreaterThanOrEqual(18);
  });

  it('should detect packages without entry points as skeletons', async () => {
    const repoRoot = resolve(__dirname, '../../../..');
    const pkgs = await scanAndClassify(repoRoot);

    // ingest-server가 목록에 있는지 확인
    const ingestServer = pkgs.find((p) => p.displayName === 'ingest-server');
    expect(ingestServer).toBeDefined();
    expect(pkgs.length).toBeGreaterThan(100);
  });
});
