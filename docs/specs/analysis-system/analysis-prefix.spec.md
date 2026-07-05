---
def:
  tier: component
  id: analysis-prefix
  type: spec
  address: def_document:v2:342148
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: dkg
  tags: [observability]
  links:
    - target: system-concepts
      type: depends_on
    - target: dkg-system-root
      type: traces_to
  sources:
    - packages/dkg/src/dkg.types.ts
    - packages/dkg/src/dsl-bundle.ts
    - packages/dkg/src/catalog-derive.ts
    - packages/dkg/src/graph-registry.ts
    - packages/dkg/src/skills/flow-trace.ts
    - packages/dkg/src/dkg.test.ts
    - packages/dkg/src/skills/flow-trace.test.ts
    - packages/ingest-server/src/routes/insights.ts
    - packages/ingest-server/src/stores/drizzle-insights-store.ts
    - packages/ingest-server/src/ports/insights-store.port.ts
    - packages/ingest-server/src/insights-store.e2e.test.ts
    - packages/core/src/catalog/runtime.ts
    - packages/core/src/catalog/runtime-boundary.test.ts
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

서비스가 실제로 사용하는 prefix를 추적한다. 현재 API는 trace의 `serviceName`과 실제 수집된 `address_context`를 기준으로 서비스별 활성 prefix와 빈도를 집계한다.

```typescript
// 응답 형식
[{
  service: "shop-web",
  activePrefixes: ["page_view", "tracking", "cart_event"],
  prefixCounts: { page_view: 45, tracking: 30, cart_event: 12 },
  totalEvents: 87
}]
```

**정의와 실제 사용의 gap**은 이 집계 결과를 registry/DKG의 선언 정보와 결합할 때 관측 피드백의 기반이 된다:
- 선언했지만 미사용 prefix → 미구현 또는 불필요
- 미선언이지만 사용 중인 prefix → 소유 prefix 정의 갱신 필요

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
- `packages/ingest-server/src/stores/drizzle-insights-store.ts` — `getPrefixUsage()`, `getServicePrefixes()`, `getCorrelations()`
- `packages/ingest-server/src/ports/insights-store.port.ts` — prefix insight 응답 계약
- `packages/ingest-server/src/insights-store.e2e.test.ts` — insights 라우트/스토어 E2E 검증
- `packages/dkg/src/dkg.types.ts` — `PrefixNode`, `DomainNode`, `DslBundleNode`
- `packages/dkg/src/dsl-bundle.ts` — DSL Bundle 정의와 coverage/skew 분석
- `packages/dkg/src/catalog-derive.ts` — catalog prefix → DKG prefix 노드/엣지 파생
- `packages/dkg/src/skills/flow-trace.ts` — IntentLink/DSL invariant 검증
- `packages/dkg/src/dkg.test.ts` — prefix/domain/consumer cascade 검증
- `packages/dkg/src/skills/flow-trace.test.ts` — DSL bundle invariant 검증
- `packages/core/src/catalog/runtime.ts` — `getPrefixProfile`, `encodePrefixByValue`
- `packages/core/src/catalog/runtime-boundary.test.ts` — prefix closed-space boundary 검증

## 검증 명령 ^validation

```bash
pnpm --filter dkg exec vitest run src/dkg.test.ts src/skills/flow-trace.test.ts
pnpm --filter @qa-sdk/ingest-server exec vitest run src/insights-store.e2e.test.ts
pnpm --filter @qa-sdk/core exec vitest run src/catalog/runtime-boundary.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
