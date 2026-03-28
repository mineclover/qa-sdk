---
def:
  id: tag-management-spec
  address: def_document:v2:343183
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [cross-scope]
---
# 태그 관리 설계

## 목적 ^purpose

Axis 값을 대상(서비스, prefix, 문서, DKG 노드)에 다중 부여(1:N)하는 태깅 패턴의 저장, 조회, 전파, 충돌 규칙을 정의한다.

## 원칙 ^overview

overview: 총 5개 설계 결정.
- 저장: 대상이 사는 곳에 함께 저장 (별도 store 아님)
- 조회: 역검색 API는 소비자가 구현
- 전파: 축별로 전파 규칙이 다름 (concern만 전파, tier/structural/category는 불전파)
- 제거: 직접 태그만 제거, 전파된 것은 다음 계산에서 자동 소멸
- 충돌: 축별 카디널리티 규칙 (단일/다중)

## 태깅 대상과 저장소 ^targets

| 대상 | 저장소 | 태그 필드 | 예시 |
|------|--------|---------|------|
| Service | registry ConfigStore (JSON) | `attributes.concerns[]`, `attributes.tierTag`, `attributes.structural[]` | auth → concerns: [security] |
| Application | registry ConfigStore (JSON) | `criticality` | member-app → critical |
| Prefix | DEMO_CATALOG | `meta.category` | cart_event → "event" |
| Document | frontmatter | `def.tags[]` | df-system → [decision, entry-point] |
| DKG Node | DkgSqliteStore | `subjects[]` (ObservationNode) | ["cart_event", "skew"] |

별도 태그 store를 만들지 않는다. 대상의 저장소에 태그 필드가 있으면 충분.
이유: 태그는 대상의 속성이지 독립 엔티티가 아님.

## 축별 카디널리티 규칙 ^cardinality

| 축 (태그 종류) | 카디널리티 | 예시 | 충돌 처리 |
|--------------|----------|------|---------|
| concerns (ConcernTag) | **다중** | [security, observability] | 공존 가능 |
| tierTag (TierTag) | **단일** | tier-frontend | 동시 불가 — 후자가 대체 |
| structural (StructuralTag) | **다중** | [entry-point, cross-scope] | 공존 가능 |
| category (PrefixMeta) | **단일** | "event" | 동시 불가 |
| criticality | **단일** | "critical" | 동시 불가 — 후자가 대체 |
| def.tags | **다중** | [decision, testing] | 공존 가능 |

규칙: **같은 축에서 값이 의미적으로 배타적이면 단일, 공존 가능하면 다중.**

## 전파 규칙 ^propagation

| 축 | 전파 여부 | 방향 | 구현 |
|---|:--------:|------|------|
| ConcernTag | ✅ 전파 | depends_on 링크를 따라 하위로 | `definition-catalog` ConcernDef.propagate() |
| TierTag | ❌ 불전파 | 서비스 고유 속성 | — |
| StructuralTag | ❌ 불전파 | 구조적 특성은 개별 | — |
| category | ❌ 불전파 | prefix 고유 | — |
| criticality | ⚠️ 상향 전파 | Application → 소속 서비스의 최고값 | Application.criticality ≥ max(services.criticality) |

### ConcernTag 전파 모델 (definition-catalog)

```
auth (security 직접 부여)
  ↓ depends_on
  permission-engine (security 상속)
    ↓ depends_on
    rbac-spec (security 상속)
```

- `EffectiveConcerns.direct`: 직접 부여된 concern
- `EffectiveConcerns.inherited`: link를 타고 상속된 concern (출처 추적 가능)
- `EffectiveConcerns.all`: direct ∪ inherited

### 제거 시 동작

- 직접 태그 제거: 즉시 반영
- 전파된 태그: 다음 전파 계산 시 자동 소멸 (출처가 없어졌으므로)
- 소스를 유지한 채 상속만 끊기: link 제거로 처리

## 역검색 API ^reverse-lookup

현재 구현 + 필요한 확장:

| 소비자 | 현재 | 필요 |
|--------|------|------|
| registry | GET /api/services (전체) → 클라이언트 필터 | GET /api/services?concern=security |
| def-catalog | def audit (전체 품질) | def audit --tag security → 태그별 필터 |
| DKG | graph.findNodes(kind, predicate) | 있음 — predicate로 subjects 필터 가능 |
| CLI | service list --json → jq 필터 | service list --concern security |

## 태그 SSOT ^ssot

| 태그 종류 | SSOT | 위치 |
|----------|------|------|
| ConcernTag (7종) | definition-catalog | `taxonomy.ts` CONCERN_TAGS |
| TierTag (4종) | definition-catalog | `taxonomy.ts` TIER_TAGS |
| StructuralTag (4종) | definition-catalog | `taxonomy.ts` STRUCTURAL_TAGS |
| PrefixMeta.category (6종) | @qa-sdk/core | `catalog.types.ts` PrefixMeta |
| criticality (4종) | registry-service | `services.ts` ServiceAttributes |

registry-service의 `ServiceConcernTag/ServiceTierTag/ServiceStructuralTag`는
definition-catalog의 KNOWN_TAGS와 **동일 값**을 사용하되, 패키지 의존 없이 자체 타입으로 정의.
값 동기화는 수동 (태그 추가 시 양쪽 갱신).
