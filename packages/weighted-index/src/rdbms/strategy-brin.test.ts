// @def.boundary weighted-index-system
// @def.doc weighted-index-system#rdbms-equivalence-strategy-brin

/**
 * 전략 #4 — BRIN (PostgreSQL 전용, 메모)
 *
 * composite PK가 lex order로 정렬되어 있고, address 공간이 연속·조밀하면
 * BRIN(Block Range Index)이 GB급 테이블을 수 KB 인덱스로 처리할 수 있다.
 *
 *   CREATE INDEX coords_brin ON coords USING BRIN (role_id, action_id, resource_id)
 *     WITH (pages_per_range = 16);
 *
 * weighted-index의 range algebra가 BRIN metadata 구조와 동일:
 *   - BRIN: 페이지 범위별 (min, max) 저장 → WHERE clause로 페이지 프루닝
 *   - weighted-index: calcAddressRanges → [lo, hi] 범위 반환
 *
 * SQLite에는 대응 개념이 없으므로 본 테스트는 스킵.
 * PG 통합 테스트 환경에서 검증할 것.
 */

import { describe, it } from 'vitest';

describe.skip('#4 BRIN — PostgreSQL 전용 (메모)', () => {
  it('placeholder — PG 통합 환경에서 검증', () => {});
});
