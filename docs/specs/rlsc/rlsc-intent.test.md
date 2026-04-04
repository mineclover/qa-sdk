---
def:
  id: rlsc-intent-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-intent
      type: refines
---

## 목적 ^purpose

`checkConformance`의 위반 탐지·score 계산과 `recognizeLayout`의 패턴 인식을 검증한다.
실제 RLSCDocument를 구성하여 full pipeline(측정→분류→비교)을 통합 테스트한다.
viewport 1000×1000 (정사각형)으로 황금비 미인식 상태를 확보한다.

소스: `packages/rlsc/src/intent.test.ts`

## checkConformance — 기본

| 시나리오 | 기대 결과 |
|----------|----------|
| 빈 선언 `{}` | `score=1.0`, `violations=[]` |
| 결과 구조 | `declared`, `recognized`, `metrics`, `violations`, `score` 모두 포함 |

## checkConformance — flowDirection

adjacent-x 관계 3개 → `detectDominantFlow` → "horizontal" → `flowDirection: "left-to-right"` 인식

| 시나리오 | 기대 결과 |
|----------|----------|
| 선언 `"left-to-right"`, 인식 `"left-to-right"` | `violations=[]` |
| 선언 `"top-to-bottom"`, 인식 `"left-to-right"` | rule=`flowDirection`, severity=`warning`, declared=`"top-to-bottom"` |

## checkConformance — gridPattern

| 시나리오 | 기대 결과 |
|----------|----------|
| 노드 1개 → 그리드 미인식, 선언 `"3x3"` | rule=`gridPattern`, severity=`error` |

## checkConformance — score 계산

| 시나리오 | 기대 결과 |
|----------|----------|
| 2개 선언, 1개 위반 | `score=0.5` (`(2-1)/2`) |
| - `flowDirection:"left-to-right"` + adjacent-x → 일치 | 위반 없음 |
| - `goldenRatio:true` + viewport 1000×1000 → 미인식 | 위반 1건 |

## recognizeLayout

| 시나리오 | 기대 결과 |
|----------|----------|
| 임의 RLSCDocument | LayoutPattern 객체 반환 |
| adjacent-x 관계 3개 포함 | `flowDirection: "left-to-right"` |
