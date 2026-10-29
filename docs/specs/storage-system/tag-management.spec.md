---
def:
  tier: component
  id: tag-management-spec
  address: def_document:v2:343183
  scope: data
  aspect: system_data
  depth: specification
  svc: ingest-server
  lifecycle: approved
  layer: domain
  tags: [cross-scope, entry-point]
  links:
    - target: storage-system
      type: refines
sources:
  - packages/definition-catalog/src/taxonomy.ts
  - packages/definition-catalog/src/types.ts
  - packages/core/src/catalog/catalog.types.ts
  - packages/registry-service/src/modules/services/service.types.ts
  - packages/dkg/src/dkg.types.ts
  - packages/dkg-store/src/dkg-sqlite-store.ts
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
| tierTag (ServiceTierTag) | **단일** | tier-frontend | 동시 불가 — 후자가 대체 |
| structural (StructuralTag) | **다중** | [entry-point, cross-scope] | 공존 가능 |
| category (PrefixMeta) | **단일** | "event" | 동시 불가 |
| criticality | **단일** | "critical" | 동시 불가 — 후자가 대체 |
| def.tags | **다중** | [decision, testing] | 공존 가능 |

규칙: **같은 축에서 값이 의미적으로 배타적이면 단일, 공존 가능하면 다중.**

## 전파 규칙 ^propagation

| 축 | 전파 여부 | 방향 | 구현 |
|---|:--------:|------|------|
| ConcernTag | ✅ 전파 | depends_on 링크를 따라 하위로 | `definition-catalog` ConcernDef.propagate() |
| ServiceTierTag | ❌ 불전파 | 서비스 고유 속성 | — |
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
| ServiceTierTag (4종) | registry-service | `service.types.ts` ServiceTierTag |
| StructuralTag (5종) | definition-catalog | `taxonomy.ts` STRUCTURAL_TAGS |
| PrefixMeta.category (6종) | @qa-sdk/core | `catalog.types.ts` PrefixMeta |
| criticality (4종) | registry-service | `services.ts` ServiceAttributes |

registry-service의 `ServiceConcernTag/ServiceTierTag/ServiceStructuralTag`는
definition-catalog와 주요 의미를 맞추되, 패키지 의존 없이 자체 타입으로 정의한다.
현재 `ServiceConcernTag`는 definition-catalog concern 값을 동일하게 유지하고, `ServiceTierTag`는 registry-service의 서비스 속성이며, `ServiceStructuralTag`는 registry 서비스 속성에 필요한 subset/extension(`shared`)을 포함한다.
값 동기화는 수동 (태그 추가 시 양쪽 갱신).

## 문서 태그 taxonomy ^document-tags

문서의 `def.tags[]`는 두 층으로 읽는다.

### 1. SSOT 태그 (코드로 정의된 KnownTag)

이 값들은 `definition-catalog/src/types.ts`와 `taxonomy.ts`에 정의돼 있고, 새 값을 추가하면 코드와 문서를 함께 갱신해야 한다.

| 분류 | 태그 | 의미 |
|------|------|------|
| StructuralTag | `entry-point` | 이 주제의 시작 문서 |
| StructuralTag | `cross-scope` | 여러 scope를 가로지르는 통합 문서 |
| StructuralTag | `coordinate-cluster` | 좌표/축 묶음의 구조 단위 |
| StructuralTag | `decision` | 의사결정 기록/판단 문맥이 핵심인 문서 |
| StructuralTag | `generated` | codegen 등 자동 생성 문서 |
| ConcernTag | `security` | 인증/인가/암호화/감사 |
| ConcernTag | `performance` | 지연/처리량/최적화 |
| ConcernTag | `accessibility` | a11y, WCAG, 스크린리더 |
| ConcernTag | `observability` | 로그, 메트릭, 트레이싱 |
| ConcernTag | `testing` | 테스트 전략, 품질 게이트, 검증 |
| ConcernTag | `migration` | 스키마 변경, 데이터 이전, 호환성 |
| ConcernTag | `deprecation` | 폐기, 대체 계획, 이전 가이드 |

### 2. 운영 관례 태그 (프로젝트 로컬 탐색용)

이 값들은 코드 SSOT는 아니지만, 문서 탐색과 묶음 조회를 위해 일관되게 쓴다.

| 관례 | 예시 | 용도 |
|------|------|------|
| 실행/운영 성격 | `runtime`, `persistence`, `contract`, `versioning` | 런타임 경로, 저장소, 공개 계약, 버전 이슈를 빠르게 찾기 |
| 제품/영역 이름 | `frontend`, `registry`, `motion` | 특정 도메인/제품군 문서 묶기 |
| 품질 하네스 | `quality-bundle`, `quality-gate`, `gate-kind:build` | quality 문서군을 별도 필터로 탐색 |
| work domain | `work-domain:productivity` | gate/contract 문서를 사용자 스토리 분류와 연결 |

운영 관례 태그는 검색 편의를 위한 보조 신호다. 좌표 축이나 KnownTag를 대체하지 않는다.

## 문서 태그 선택 규칙 ^document-tag-rules

문서에 태그를 붙일 때는 다음 순서를 권장한다.

1. StructuralTag가 필요한지 먼저 본다.
2. 횡단 관심사가 명확하면 ConcernTag를 1~2개 붙인다.
3. 그래도 탐색성이 부족할 때만 운영 관례 태그를 추가한다.

권장 수량은 보통 2~5개다. 너무 많은 태그는 검색 신호를 흐리게 만든다.

예시:

- quality gate 문서: `testing`, `quality-gate`, `gate-kind:unit-test`
- 공개 API 계약 문서: `entry-point`, `contract`
- 로컬 SQLite 상태 저장 문서: `observability`, `persistence`, `data`
- 통합 설계 문서: `cross-scope`, `decision`
