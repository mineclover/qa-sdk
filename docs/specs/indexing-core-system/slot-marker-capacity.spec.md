---
def:
  id: slot-marker-capacity
  address: def_document:v2:273560
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: []
  links:
    - target: slot-marker-patterns
      type: constrains
---
# 슬롯 마커의 용량 영향

## 목적 ^purpose

슬롯 마커가 용량(capacity)에 미치는 영향. headroom 계산과 reserved slot 규칙.

## 구성 ^overview

- **shape 증가**: 마커는 각 차원의 shape을 증가시켜 전체 주소 공간이 기하급수적으로 커진다
- **capacity planner 반영**: 용량 계획 시 마커 수를 current에 반드시 합산해야 한다
- **마커 수 선택**: 1개(최소, null만), 2개(표준, 대부분 운영), 3개(확장, 파싱 실패 구분)
- **오버헤드 규모**: 마커 2개 기준 주소 공간 +110% — 차원 수가 많을수록 비용 급증

---

## 1. 마커는 shape을 증가시킨다

마커는 shape을 증가시키므로 전체 주소 공간이 커진다.

| 구성 | shape | 주소 수 | 오버헤드 |
|------|-------|---------|----------|
| 마커 없음 | [10, 8, 5] | 400 | 기준 |
| `"_"`만 | [11, 9, 6] | 594 | +48.5% |
| `"_"` + `"~"` | [12, 10, 7] | 840 | +110% |

차원 수가 많을수록 오버헤드가 기하급수적으로 커진다.

---

## 2. capacity planner에서 마커 수 포함

capacity planner에서 마커 수를 반드시 포함해야 한다:

```ts
planCapacity({
  dims: [
    { name: "role",     current: 5 + 2, growth: 3 },  // 마커 2개 포함
    { name: "action",   current: 8 + 2, growth: 2 },
    { name: "resource", current: 3 + 2, growth: 10 },
  ],
  left: [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: "uuid",
});
```

---

## 3. 마커 수 선택 가이드

| 마커 수 | 구성 | 적합한 상황 |
|---------|------|-------------|
| 1 (`"_"`) | 최소 | null/해당없음만 표현하면 되는 경우 |
| 2 (`"_"` + `"~"`) | 표준 | 대부분의 운영 환경 |
| 3 (`"_"` + `"~"` + `"?"`) | 확장 | 외부 입력 파싱 실패를 구분해야 하는 도메인 |

## 참조

- [slot-marker-concept](slot-marker-concept.spec.md) — 마커 개념과 설계 원칙
- [slot-marker-patterns](slot-marker-patterns.spec.md) — 실제 사용 패턴
