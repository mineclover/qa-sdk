---
def:
  id: analysis-prefix
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability, tier-system]
  links:
    - target: system-concepts
      type: depends_on
---
# Prefix — 의미의 재사용 단위

## 목적 ^purpose

분석 시스템에서 prefix가 어떻게 분류되고, DSL Bundle/IntentLink/Domain 3개 조직 레이어 위에서 그룹핑되는지를 정의한다.

## 구성 ^overview

prefix는 차원 교차(dim cross-product)의 원자 단위이자 의사결정의 결과 단위이다. 분석 시스템은 prefix를 3개 조직 레이어로 그룹핑하여 다양한 관점의 인사이트를 제공한다.

### prefix DKG 노드

```typescript
interface PrefixNode {
  kind: "prefix";
  id: string;                // 예: "page_view", "cart_event"
  name: string;
  dimLabels: string[];       // 이 prefix의 dim 목록
  category?: "entity" | "event" | "relation" | "state" | "policy" | "observation";
  lifecycle?: "draft" | "active" | "deprecated" | "archived";
}
```

### 3개 조직 레이어

#### 1. Domain — 비즈니스 영역 그룹핑

```typescript
interface DomainNode {
  kind: "domain";
  id: string;        // 예: "checkout-domain", "infra-domain"
  name: string;
  prefixes: string[];  // 이 도메인에 속한 prefix 목록
}
```

도메인은 비즈니스 관점의 분류이다. 크로스커팅 prefix 7종은 도메인에 걸쳐 분류된다:
- infra-domain: `version_state`, `metric_aggregate`
- observation-domain: `validation_event`, `resource_lifecycle`
- tracking-domain: `tag_lifecycle`
- dev-domain: `test_coverage`, `cli_tracking`

#### 2. DSL Bundle — 사용 시나리오 묶음

```typescript
interface DslBundleNode {
  kind: "dsl-bundle";
  id: string;                    // 예: "dsl-checkout", "dsl-observation"
  memberPrefixes: string[];      // 이 번들에 포함되는 prefix
  serviceBindingPrefix: string;  // 서비스 바인딩 prefix (보통 "service")
  invariants?: string[];         // 불변조건 (위반 감지에 사용)
}
```

DSL Bundle은 "이 prefix들을 이 서비스 컨텍스트에서 이렇게 조합해서 쓴다"의 선언이다.

#### 3. IntentLink — 공출현 조건

prefix들이 함께 관측되어야 하는 조건. 상세는 `analysis-intent-link.spec.md` 참조.

### prefix 사용 분석 API

#### 빈도 분석 — `GET /v1/insights/prefixes`

address_context에서 prefix별 사용 빈도를 집계한다. 최대 500개 레코드를 샘플링하여 각 prefix의 출현 횟수를 반환한다.

```typescript
// 응답 형식
[{ prefix: "page_view", count: 120 }, { prefix: "tracking", count: 95 }, ...]
```

#### 서비스별 prefix 활성도 — `GET /v1/insights/service-prefixes`

서비스가 실제로 사용하는 prefix를 추적한다. registry의 `ownedPrefixes` 정의와 실제 수집된 address_context를 매칭한다.

```typescript
// 응답 형식
[{
  service: "shop-web",
  activePrefixes: ["page_view", "tracking", "cart_event"],
  prefixCounts: { page_view: 45, tracking: 30, cart_event: 12 },
  totalEvents: 87
}]
```

**정의와 실제 사용의 gap**이 관측 피드백의 기반이 된다:
- 선언했지만 미사용 prefix → 미구현 또는 불필요
- 미선언이지만 사용 중인 prefix → ownedPrefixes 갱신 필요

### prefix 프로파일 (getPrefixProfile)

`getPrefixProfile(catalog, prefixId, version?)` → 각 dim의 capacity/headroom/stride 정보:

```typescript
interface DimCapacityInfo {
  entries: number;    // 현재 entry 수
  capacity: number;   // 전체 capacity
  headroom: number;   // 남은 여유
  stride: number;     // 인코딩 stride
}
```

- `headroom ≤ 1` → warning
- `headroom = 0` → critical
- `prefix_ref`에 refEntries 없으면 `undefined` (CON-006: 미완성 상태)

### 이벤트 카테고리 매핑

event_key를 8개 범용 카테고리로 자동 분류한다:

| 카테고리 | 패턴 예시 |
|----------|----------|
| navigation | `page.*`, `screen.*`, `route.*` |
| interaction | `click`, `tap`, `scroll` |
| form | `form.*`, `input.*` |
| session | `auth.*`, `login`, `logout` |
| network | `api.*`, `http.*`, `endpoint.*` |
| outcome | `cart.*`, `checkout.*`, `order.*` |
| quality | `permission.*`, `error.*`, `metric.*` |
| execution | `deploy.*`, `build.*`, `test.*` |

## 관련 소스

- `packages/ingest-server/src/routes/insights.ts` — prefix/service-prefixes API
- `packages/spec-core/src/dkg/dkg.types.ts` — PrefixNode, DomainNode, DslBundleNode
- `packages/spec-core/src/dkg/dsl-bundle.ts` — DSL Bundle 정의
- `packages/core/src/catalog/runtime.ts` — `getPrefixProfile`, `encodePrefixByValue`
