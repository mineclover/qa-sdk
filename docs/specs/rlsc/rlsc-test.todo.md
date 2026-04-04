---
def:
  id: rlsc-test
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  level: module
  layer: domain
  svc: rlsc
  tags: [structural]
  links:
    - target: rlsc
      type: refines
    - target: rlsc-encoder-test
      type: contains
    - target: rlsc-relations-test
      type: contains
    - target: rlsc-grid-test
      type: contains
    - target: rlsc-query-test
      type: contains
    - target: rlsc-context-test
      type: contains
---

# R.L.S.C.™ — 테스트 시나리오

vitest 설정 완료. Phase 2 테스트 구현 완료. 시나리오는 각 모듈 `.test.md`로 승격됨.

승격 대상: `rlsc-encoder.test.md`, `rlsc-relations.test.md`, `rlsc-grid.test.md`, `rlsc-query.test.md`, `rlsc-context.test.md`

## encoder — 라운드트립

- [x] `encodeToMarkup(mockDoc)` → `parseMarkup(markup)` 왕복 시 root.id, viewport 일치
- [x] 텍스트 내 큰따옴표(`"`) 이스케이프 → 파싱 후 복원
- [x] address 필드 있는 노드 직렬화 → `addr:` 파싱 후 복원
- [x] relations 없는 문서 → Relations 섹션 생략 검증

## relations — 기하 경계

순수 기하 함수, DOM 없이 테스트 가능.

| 케이스 | 기대 관계 |
|--------|----------|
| A가 B를 완전 포함 (depth A < B) | contains |
| 겹침 비율 0.10 (경계) | overlaps 포함 |
| 겹침 비율 0.09 | overlaps 제외 |
| 겹침 비율 0.80, z 다름 | stacked |
| x 간격 16px, y 겹침 있음 | adjacent-x 포함 |
| x 간격 17px | adjacent-x 제외 |
| left 정렬 차이 4px | aligned-x 포함 |
| 형제 노드 3개 | flow 2건 |

- [x] contains 우선순위 — contains 판정 시 overlaps/adjacent skip

## grid — 셀 분석

- [x] cellSize=16 기본값, cols = ceil(viewport.width/16)
- [x] dominant = 교차 면적 최대 노드
- [x] coverage ∈ [0, 1] (Math.min clamping)
- [x] 빈 셀 nodeIds=[], zStack=[], coverage=0

## query — 조건/diff

- [x] `queryNodes({ role: 'banner' })` — role 정확 일치
- [x] `queryNodes({ minArea: 1000, maxArea: 5000 })` — 범위 필터
- [x] `queryNodes({ zRange: { min: 10 } })` — z-index 하한
- [x] `queryNodes({ textContains: 'hello' })` — 대소문자 무관
- [x] `diffDocuments` — added: after에만 있는 id
- [x] `diffDocuments` — removed: before에만 있는 id
- [x] `diffDocuments` — moved: 같은 id, 위치만 변경
- [x] `diffDocuments` — resized: 같은 id, 크기 변경
- [x] `diffDocuments` — reordered: 같은 id, zIndex 변경

## context — 토큰 예산

- [x] `maxTokens: 10` → structure에 `... (truncated)` 포함
- [x] `purpose: 'accessibility-audit'` → 렌더된 prompt에 `{layers}` 리터럴 없음 (버그 수정 후)

## 대응 테스트 파일

- `packages/rlsc/src/encoder.test.ts` ✓
- `packages/rlsc/src/relations.test.ts` ✓
- `packages/rlsc/src/grid.test.ts` ✓
- `packages/rlsc/src/query.test.ts` ✓
- `packages/rlsc/src/context.test.ts` ✓
