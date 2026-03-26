---
def:
  id: gate-state-model
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security, tier-infra]
  links:
    - target: gate-constraint
      type: depends_on
---
# Gate 4-State 모델

## 목적 ^purpose

주소 공간의 4가지 상태(active, inactive, open, reserved)와 전이 규칙을 정의한다.
encode/decode 허용 여부가 상태에 의해 결정된다.

## 구성 ^overview

4-state: active(허용/허용), inactive(차단/허용), open(허용/차단), reserved(차단/차단).
전이: active↔inactive(flag/release), active↔open(entry 추가/제거), inactive∩open→reserved.

## 상태 정의 ^state-def

| 상태 | encode | decode | 의미 |
|------|--------|--------|------|
| active | 허용 | 허용 | 정상 사용 가능 |
| inactive | 차단 | 허용 | 비활성화됨, 기존 데이터 읽기만 가능 |
| open | 허용 | 차단 | 아직 decode 매핑 미완성, encode는 가능 |
| reserved | 차단 | 차단 | capacity headroom 슬롯, 미래 사용 예약 |

## 전이 규칙 ^state-def

```
active ↔ inactive    (flag/release 이벤트)
active ↔ open        (entry 추가/제거)
inactive ∩ open → reserved  (자동 승격)
```

## Composite AND 규칙

composite index에서 어느 dim이라도 차단이면 composite도 차단:

```
dim_a: active, dim_b: inactive → composite: inactive
dim_a: inactive, dim_b: open  → composite: reserved
```
