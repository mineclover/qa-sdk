---
def:
  id: axis-boundary-criteria
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  svc: spec-core
  tags: [entry-point]
  links:
    - target: axis-boundary-spec
      type: refines
---

# Axis 경계 판단 기준

## 목적 ^purpose

무엇이 axis이고 무엇이 아닌지 판단하는 기준, 분류표, 재설계 판단선을 분리해 좌표 모델의 핵심 경계를 정리한다.

## 구성 ^overview

- `5Q Checklist`: 축 후보가 axis인지 판단하는 5가지 질문을 정의한다.
- `분류표`: candidate 속성이 axis/data/상태값 중 어디에 속하는지 분류하는 기준선을 기술한다.
- `capacity 규칙`: 새 축의 entry 수와 capacity 산정 기준을 명시한다.
- `재설계 판단선`: axis 추가 대신 prefix 재조정이 적합한 경우를 정리한다.

## 5Q Checklist

축 후보가 axis로 적합한지 5가지 질문으로 판단한다:

| # | 질문 | 기준 |
|---|------|------|
| Q1 | **유한한가?** | entry 수가 유한하고 열거 가능한가 |
| Q2 | **의사결정에 영향을 주는가?** | 이 값에 따라 시스템 행동이 달라지는가 |
| Q3 | **공유되는가?** | 여러 prefix가 이 축을 참조하는가 |
| Q4 | **안정적인가?** | entry 추가/삭제가 드물고, 변경 시 영향 범위가 제한적인가 |
| Q5 | **capacity가 적절한가?** | nextPowerOf2(entries * 2) 이상을 확보할 수 있는가 |

5개 모두 "예"면 axis로 확정한다. Q1 또는 Q2가 "아니오"면 axis가 아니다.

## 분류표

| 특성 | axis | data (payload) | 상태값 (state) |
|------|------|----------------|----------------|
| 유한성 | O (열거 가능) | X (자유 형식) | O (enum) |
| 주소화 | O (정수 인코딩) | X | X |
| 변경 빈도 | 낮음 | 높음 | 중간 |
| 다른 prefix 공유 | 가능 | 불가 | 불가 |
| 예시 | action, role, env | user_name, email | is_active, status |

핵심 구분: axis는 **주소 공간의 차원**이고, data는 **이벤트의 payload**이고, 상태값은 **런타임의 조건**이다.

## capacity 규칙

```
capacity = nextPowerOf2(entries.length * 2)  // 최소값
```

- headroom(capacity - entries) ≤ 1이면 warning, 0이면 critical.
- capacity가 부족하면 새 version으로 축을 확장해야 한다.
- `getPrefixProfile(catalog, prefixId, version)`로 축별 capacity/headroom/stride를 프로파일링한다.
- totalSpace > 2^53이면 safePrecision=false 표기 (CON-007). BigInt 경로 사용.

## 재설계 판단선

axis 추가보다 prefix 재조정이 적합한 경우:

1. **새 축이 기존 축과 1:1 대응**: 이미 있는 축의 entry를 확장하는 것이 낫다.
2. **새 축의 entry가 2개 이하**: boolean이면 payload 플래그로 충분하다.
3. **새 축이 단일 prefix에서만 사용**: 공유되지 않으면 axis보다 prefix_ref가 적합하다.
4. **entry 변경이 잦음**: capacity를 자주 초과하면 안정적이지 않다 → data/payload로 이동.
5. **crosscutting prefix 후보 검토**: 7종 크로스커팅 prefix(version_state, metric_aggregate 등)에 해당하는지 확인한다.
