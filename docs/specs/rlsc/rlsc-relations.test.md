---
def:
  id: rlsc-relations-test
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-relations
      type: refines
  source: packages/rlsc/src/relations.test.ts
---

## 목적 ^purpose

8종 공간 관계 탐지의 기하 경계 조건과 우선순위 규칙을 검증한다. DOM 없이 순수 좌표 계산만 테스트.

소스: `packages/rlsc/src/relations.test.ts`

## contains

| 시나리오 | 기대 결과 |
|----------|----------|
| A(200×200)가 B(100×100)를 완전 포함 + depth A < B | contains 1건, source=A, target=B |
| contains 판정 시 | overlaps, adjacent-x 미생성 |
| A와 B의 depth 동일 | contains 0건 |

## stacked

| 시나리오 | 기대 결과 |
|----------|----------|
| 겹침 비율 > 0.8, z-index 다름 | stacked 1건, source = z 낮은 노드 |
| 겹침 비율 정확히 0.8 (x 오프셋 20px) | stacked 0건 (> 0.8 조건) |
| 같은 z-index | stacked 0건 |

## overlaps

| 시나리오 | 기대 결과 |
|----------|----------|
| 겹침 비율 0.2 (x 오프셋 80px) | overlaps 1건 |
| 겹침 비율 정확히 0.1 (x 오프셋 90px) | overlaps 0건 (> 0.1 조건) |
| 완전 분리 (gap 100px) | overlaps 0건 |

## adjacent-x

| 시나리오 | 기대 결과 |
|----------|----------|
| x 간격 16px + y 겹침 있음 | adjacent-x 1건 |
| x 간격 17px | adjacent-x 0건 |
| x 간격 16px + y 겹침 없음 (y 오프셋 200px) | adjacent-x 0건 |

## adjacent-y

| 시나리오 | 기대 결과 |
|----------|----------|
| y 간격 16px + x 겹침 있음 | adjacent-y 1건 |
| y 간격 17px | adjacent-y 0건 |

## aligned-x

| 시나리오 | 기대 결과 |
|----------|----------|
| left 차이 4px (허용 임계값 내) | aligned-x 1건 |
| left 차이 5px | aligned-x 0건 |

## flow

| 시나리오 | 기대 결과 |
|----------|----------|
| 같은 부모 아래 형제 3개 | flow 2건 (c1→c2, c2→c3) |
| 형제 중 c2가 `visible: false` | flow 1건 (c1→c3), c2 건너뜀 |
