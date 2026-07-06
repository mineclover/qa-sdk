---
def:
  tier: system
  id: dual-coordinate-system
  address: def_document:v2:342175
  scope: data
  aspect: coordinate_model_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [cross-scope, entry-point]
  links:
    - target: definition-system-philosophy
      type: refines
    - target: definition-catalog-spec
      type: depends_on
    - target: definition-addressing
      type: depends_on
    - target: df-ingest-emission
      type: traces_to
sources:
  - docs/specs/definition-catalog/definition-taxonomy/definition-addressing.spec.md
  - docs/specs/definition-catalog/definition-taxonomy.spec.md
  - packages/definition-catalog/src/bridge.ts
  - packages/definition-catalog/src/address-assign.ts
  - packages/definition-data-source/src/sync-local-db.ts
  - packages/definition-data-source/src/sync-local-db.test.ts
  - packages/decision-flow/src/ingest-adapter.ts
  - docs/specs/decision-flow/df-interface-group/df-ingest-emission.spec.md
---
# 이중 좌표 시스템 — Prefix(이벤트) × Scope(문서)

## 목적 ^purpose

이 시스템은 두 개의 좌표 공간을 운영한다. **prefix 좌표**는 이벤트 데이터의 위치를, **scope 좌표**는 소프트웨어 정의 문서의 위치를 인코딩한다. 두 좌표는 동일한 원리(축 정의, WeightedIndex 인코딩, 5Q 검증)로 동작하며, prefix 문서(`data/prefix_schema`)가 두 좌표 공간의 교차점이다.

## 구조적 대응 ^overview

### Prefix 좌표 (이벤트 주소 공간)

이벤트가 발생한 **물리적 위치**를 정수 하나로 압축한다.

```
AxisDef (축 정의)
  env: [dev, staging, prod]          capacity: 8
  region: [asia, us, eu]             capacity: 8
  svc_name: [web, api, auth, ...]    capacity: 64

PrefixDef (좌표 정의)
  service = env × region × svc_name  → service:v1:42

EventRecord (데이터 주소)
  address_context: { service: "service:v1:42", endpoint: "endpoint:v1:128" }
```

### Scope 좌표 (문서 주소 공간)

소프트웨어 정의의 **분류적 위치**를 정수 하나로 압축한다.

```
def_scope (축 정의)
  scope: [ui, feature, flow, state, constraint, data, interface]  capacity: 16
  aspect: [layout, component, func_def, domain_data, ...]         capacity: 64
  depth: [overview, specification, implementation, validation]     capacity: 8

def_document (좌표 정의)
  = scope × aspect × depth  → def_document:v1:537

Document (문서 주소)
  address: def_document:v1:537  (= feature/func_def/specification)
```

### 동형 대응표

| 개념 | Prefix 좌표 | Scope 좌표 |
|------|------------|-----------|
| **축** | AxisDef (env, region, role...) | def_scope, def_aspect, def_depth |
| **좌표 정의** | PrefixDef (service, endpoint, rbac...) | def_document, def_link |
| **주소** | `service:v1:42` (정수) | `def_document:v1:537` (정수) |
| **인코딩** | WeightedIndex mixed-radix | WeightedIndex mixed-radix |
| **버전** | v1, v2 (prefix 버전) | lifecycle (draft→approved) |
| **참조** | prefix_ref (prefix 간 참조) | links (문서 간 관계) |
| **게이트** | GateEngine 4-state | lifecycle (active=approved) |
| **검증** | CON-001~007 | validateGraph (깨진 링크, 순환) |
| **소비** | Axis 소비 10패턴 | scope별 관점 분해 5패턴 |
| **SSOT** | DEMO_CATALOG | DB (documents 테이블) |
| **registry** | registry-service (:3300) | definition-service (:3700) |

### 5Q 검증의 동형성

축/scope 선택 시 동일한 5Q 체크리스트를 적용한다:

| 질문 | Prefix 축 예시 | Scope 축 예시 |
|------|---------------|---------------|
| Q1 유한? | env: 5개 값 ✓ | scope: 7개 값 ✓ |
| Q2 의사결정 관련? | region이 배포/비용 결정 ✓ | aspect가 문서 성격 결정 ✓ |
| Q3 여러 prefix에서 공유? | env를 service/endpoint 모두 사용 ✓ | scope를 모든 문서가 사용 ✓ |
| Q4 안정적? | env 목록 변경 드묾 ✓ | scope 7종 고정 ✓ |
| Q5 capacity 관리? | nextPowerOf2(entries×2) ✓ | capacity 16/64/8 ✓ |

### 교차점: prefix_schema 문서

`data/prefix_schema` 문서 57건은 두 좌표 공간의 **교차점**이다:

```
prefix_schema 문서 (scope 좌표: data/prefix_schema/specification)
  ├── 문서 주소: def_document:v1:2697
  └── 내용: order_event prefix의 축 구성
        ├── 축: env × region × order_action × ...
        └── 이벤트 주소: order_event:v1:0~N
```

즉, **문서 좌표에서 prefix_schema를 찾으면**, 그 문서 안에 **이벤트 좌표의 정의**가 들어있다. 이것이 두 좌표 시스템이 만나는 지점이다.

## 관측성

두 좌표 시스템은 독립적으로 관측 가능하다:

- **이벤트 관측**: `GET /v1/insights/correlations` — prefix 공출현 패턴
- **문서 관측**: `POST /graph/validate` — 깨진 링크, 고아 문서, 순환 참조
- **교차 관측**: prefix가 추가/변경되면 → prefix_schema 문서 갱신 필요 → definition-service에서 drift 감지

## 현재 운영 경계 ^boundary

- prefix/event 좌표는 runtime event의 `address_context`에 실린다.
- definition/document 좌표는 `DefinitionEntry.serialized`와 frontmatter `address`로 보존된다.
- `definition-catalog/src/bridge.ts`는 definition 문서를 `def_document` address_context로 투영하지만, prefix catalog의 SSOT가 되지는 않는다.
- explicit v2 문서 주소가 없으면 legacy v1 fallback이 남아 있으므로, 현재 상태는 완전 address-first가 아니라 병행 전환 단계다.

## 검증 ^validation

```bash
corepack pnpm --filter definition-catalog test
corepack pnpm --filter definition-data-source test
corepack pnpm --filter decision-flow test
node packages/cli/dist/index.js def validate
```
