---
def:
  tier: exempt
  id: ms-concept-spacetime-uid
  type: spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-concepts
      type: traces_to
    - target: ms-concept-branch-path
      type: traces_to
sources:
  - packages/core/src/meta-semantic/spacetime-uid.ts
  - packages/core/src/meta-semantic/spacetime-uid.test.ts
  - packages/core/src/pipe/pipe-path.ts
  - packages/core/src/pipe/pipe-path.test.ts
---

# Spacetime UID

## 목적 ^purpose

분기 경로 주소에 시간 축(tx_seq)을 결합한 시공간 식별자를 정의한다.
데이터 패싯의 "저장" 역할을 실현하는 메커니즘이며,
좌표를 적절히 나누면서 일관성을 유지하는 규칙이 곧 UID 부여 체계다.

---

## 구성

```
Spacetime UID = (함수, 경로 주소, 실행 순번)
                  what      where       when
```

- **함수 (what):** 어떤 검증 단위인가
- **경로 주소 (where):** 검증 단위 내 어떤 분기 조합인가
- **실행 순번 (when):** 그 경로가 몇 번째 실행되었는가

## 불변성

기존 주소는 영원히 바뀌지 않는다. 새 실행은 새 tx_seq, 새 분기는 새 segment.
이것이 데이터 데이터 패싯 중 **저장**의 핵심 — 고유 식별자 부여 체계.

## 데이터 계보 추적

변형(A→f(A)→B)이 발생하면 결과 B는 새 생산+저장(새 UID)이다.
A의 UID와 B의 UID가 체인으로 연결되어 계보가 추적된다.

```
데이터 A: intent:v1:1:0:41  (processOrder, normal×card, 41번째)
  ↓ 변형 (할인 계산)
데이터 B: intent:v1:2:3:1   (calcDiscount, express×percent, 1번째)
  계보: A.uid → B.uid (변형 관계)
```

이동은 모듈 관계에 내재되어 별도 추적 불필요.
변형만 UID 체인으로 추적하면 데이터 계보가 완성된다.
