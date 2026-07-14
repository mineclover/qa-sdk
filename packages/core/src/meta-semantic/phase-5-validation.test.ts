// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import { compareIntentWithExecution } from './ir-alignment.js';

describe('Phase 5: Empirical Validation (Shadow Refactoring)', () => {
  it('실제 definition-service-sync 문서와 추출된 코드 IR을 대조한다', async () => {
    // 1. 의도(Intent) 평면 로드 (Mocked based on docs/specs/definition-catalog/definition-service-sync.spec.md)
    const intentEntry: any = {
      id: 'definition-service-sync',
      intent_hierarchy: 'core',
      projection_plane: 'intent',
    };

    expect(intentEntry.id).toBe('definition-service-sync');
    expect(intentEntry.intent_hierarchy).toBe('core');

    // 2. 구현(Execution) 평면 모드 (실제 마커 추출 사실 기반 구성)
    const executionUnits: any[] = [
      {
        id: 'SyncService.run',
        meta: {
          defDocRef: 'definition-service-sync',
          projectionPlane: 'execution',
          intentHierarchy: 'core', // 코드 @facet.hierarchy core 에서 파생
        },
      },
      {
        id: 'logger.info',
        meta: {
          defDocRef: 'definition-service-sync',
          projectionPlane: 'execution',
          intentHierarchy: 'auxiliary', // 코드 @facet.hierarchy auxiliary 에서 파생
        },
      },
    ];

    // 3. 드리프트 분석 (Alignment)
    const result = compareIntentWithExecution(intentEntry, executionUnits);

    // 📊 검증
    expect(result.score).toBe(100); // core가 정확히 매칭되므로 100점 (auxiliary는 무시됨)
    expect(result.summary.matchedUnits).toBe(2);
    expect(result.issues).toHaveLength(0);

    console.log(`✅ Alignment Score: ${result.score}/100`);
    console.log(`✅ Matched Units: ${result.summary.matchedUnits}`);
  });
});
