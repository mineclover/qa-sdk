# 좌표 행렬 — taxonomy 흐름의 수학적 표현

## 목적

fold/algebra의 해석 결과를 정수 좌표 벡터로 인코딩하여, taxonomy 간 흐름을 행렬 연산으로 표현 가능하게 만든다. qa-sdk가 prefix 차원을 정수 좌표로 압축하는 원리를 taxonomy 레벨에 적용한다.

## 좌표 벡터 인코딩

각 taxonomy algebra는 해석 결과를 정수 좌표 벡터로 산출한다.

```
fold("이벤트 수집", definition) → [5, 21, 1]     scope, aspect, depth 정수 인코딩
fold("이벤트 수집", structural) → [2, 3]          boundary, facet 정수 인코딩
fold("이벤트 수집", df)        → [3, 7]          layer, unit 정수 인코딩
```

## 결합 벡터 = 행렬의 행

모든 taxonomy 좌표를 결합하면 문서의 전체 위치가 된다.

```
             definition    structural    df
             s  a  d       b  f          l  u
문서A       [ 5, 21, 1,    2, 3,         3, 7 ]
문서B       [ 5, 21, 2,    2, 3,         3, 8 ]
문서C       [ 3, 10, 1,    4, 1,         1, 2 ]
```

## 행렬 위의 연산

| 연산 | 의미 | 수학적 표현 |
|------|------|-----------|
| 문서의 위치 | 다차원 좌표 공간의 한 점 | 결합 벡터 |
| taxonomy 간 흐름 | 한 taxonomy 좌표에서 다른 taxonomy 좌표로의 매핑 | 변환 행렬 T |
| taxonomy 합성 | 여러 taxonomy 해석의 결합 | 행렬 곱 (product algebra 대응) |
| 관련 문서 탐색 | 좌표 공간에서의 근접성 | 벡터 거리/유사도 |

### taxonomy 간 변환

```
df→definition 매핑:
  def_coord = T_df→def × df_coord

decision-flow의 판단 좌표에서 definition의 분류 좌표를 파생.
기존 decision-definition-bridge의 suggestScopeFromArtifact()가 이 변환의 구체적 구현.
```

## 기존 시스템과의 연결

| 기존 개념 | 행렬 표현 대응 |
|----------|--------------|
| weighted-index 차원 압축 | 동일 원리 — 정수 인코딩으로 차원 좌표 표현 |
| prefix address (scope×aspect×depth×seq) | definition taxonomy 부분 벡터 |
| decision-definition bridge | df→def 변환 행렬의 구체적 구현 |
| product algebra | 행렬의 열 블록 결합 |

## 목표

taxonomy algebra가 좌표를 생산하고, 좌표들이 행렬 위에 배치되어, taxonomy 간 흐름이 수학적 연산으로 추적·검증·합성 가능해지는 것.

## 미해결 질문

1. 변환 행렬의 완전성 — 모든 taxonomy 쌍에 변환 행렬이 필요한가, 직접 연결되는 쌍만인가
2. 희소 벡터 처리 — 문서가 일부 taxonomy에만 참여할 때 나머지 좌표를 어떻게 표현하는가
3. 좌표 차원 수 — taxonomy별 축 수가 다른데 결합 벡터의 차원을 어떻게 관리하는가
4. 근접성 정의 — 어떤 거리 함수가 "관련 문서"를 의미있게 측정하는가
