---
def:
  id: permission-encoding-rule
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-encoding
      type: refines
    - target: cq-policy-resolver
      type: refines
---

# Permission Encoding — 소비 규칙

## 목적 ^purpose

Permission Engine과 PolicyRule을 소비할 때 확인해야 하는 포맷 규칙, 인코딩 선택 기준, resolve 순서를 정의한다.

---

## 1. Role Resolution

- 클라이언트는 role을 직접 확인하지 않음 — 서버가 role → flat permission mask로 resolve

## 2. Resource 포맷

- 소문자, `/` 구분
- leading/trailing slash 금지
- depth ≤ 4
- `:param` 허용
- permission code: `{service-ref}.{type}.{resource}.{action}`

## 3. 인코딩 선택

| 용도 | 인코딩 |
|------|--------|
| DB + 범위 | WeightedIndex |
| 인메모리 필터 | BitIndex |
| 양쪽 | IndexBridge |

## 4. Deny 레이어

- grant와 대칭 — `denyRoles`(role 단위 제거), `denyFeatures`(feature 단위 제거)
- resolution: parents OR 합산 + ownFeatures → denyRoles resolved + denyFeatures 차감 → final
- deny는 해당 role의 resolved에만 영향, 부모/자식에 전파 안 됨

## 5. PolicyRule 인터페이스

### 공개 vs 내부

| 구분 | 타입 | 특성 |
|------|------|------|
| **공개 API** | `PolicyRule<T> { match: MatchSpec, value: T }` | entity name + 명시적 와일드카드(`"*"`) |
| **내부 전용** | `PatternRule<T> { pattern: CoordConstraint[] }` | position 기반 |

### 규칙
- 모든 dim 명시 필수. dim 누락 → ValidationError (암묵적 와일드카드 금지)
- `resolvePolicy(codec, entities, rules, strategy)` — 공개 함수
- `resolvePatternPolicy(coord, rules, shape, strategy)` — 내부 함수
