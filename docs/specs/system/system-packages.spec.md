---
def:
  id: system-packages
  tier: layout
  owner_system: system-packages
  address: def_document:v2:138240
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [entry-point, cross-scope, structural]
  links:
    - target: spec-architecture-system
      type: refines
    - target: registry-api
      type: refines
    - target: package-surface-separation-rule
      type: refs
    - target: system-taxonomy
      type: refs
    - target: system-profile
      type: refs
    - target: system-operational-ontology
      type: refs
    - target: resource-policy-store-system
      type: refs
    - target: audit-recorder-store-system
      type: refs
    - target: infra-env-kit-system
      type: refs
    - target: scaffold-system
      type: refs
---

# 패키지 구조

## 목적 ^purpose

qa-sdk 모노레포의 패키지 의존 관계. 인코딩 라이브러리 체인(weighted-index → bit-index → permission-engine)과 플랫폼 체인(@qa-sdk/core → logger → codec → context → sdk).

## 구성 ^overview

- `인코딩 체인`: weighted-index → bit-index → permission-engine 인코딩 라이브러리 의존 체인을 정의한다.
- `플랫폼 체인`: @qa-sdk/core → logger → codec → context → sdk 플랫폼 계층을 기술한다.
- `인프라 서비스`: ingest(3200), registry(3300), gate(3400), query(3500), decode(3600) 서비스를 명시한다.
- `권한 지원 저장소`: resource-policy-store와 audit-recorder-store의 권한 lifecycle/audit 영속 경계를 명시한다.
- `환경 공급 패키지`: infra-env-kit이 `.env`/연결 코드/compose override 공급 책임을 가진다.
- `스캐폴딩 패키지`: @qa-sdk/scaffold가 도메인 계층 구조와 데이터 거버넌스 표준을 코드/템플릿/검증 규칙으로 물질화한다.
- `스펙/분석 패키지`: spec-core, convergence, decision-flow, event-catalog의 역할을 정리한다.
- `프론트엔드/데모`: platform-demo, shop-web, taxonomy-web, viz-web, operational-ontology-web, browser SDK의 소비자/preview 위치를 기술한다.
- `기능 surface 분리`: 검증된 코어, contract tooling, consumer-only, quarantine 후보를 구분한다.

## 기능 Surface 분리

qa-sdk 전체를 단일 제품 플랫폼으로 확장하지 않는다. 패키지는 기능 surface별로 유지하며, 새 기능은 먼저 하나의 surface와 하나의 기능군에 배정한다.

| Surface | 기능군 | 역할 | 대표 패키지 |
|---------|--------|------|-------------|
| Coordinate kernel | coordinate kernel capability | 좌표 인코딩과 주소 수학 | `weighted-index`, `index-meta`, `bit-index`, `permission-engine` |
| Observability runtime | observability runtime capability | 이벤트 수집·저장·SDK runtime | `@qa-sdk/core`, `@qa-sdk/sdk`, `@qa-sdk/ingest-server`, `@qa-sdk/registry-service` |
| Definition control plane | definition catalog capability | 문서 그래프와 품질 gate | `definition-catalog`, `@qa-sdk/definition-service`, `doc-envelope` |
| Taxonomy tooling | taxonomy capability | 유한 vocabulary 선언·검증·diff/codegen | `taxonomy-engine` |
| Taxonomy decision bridge | taxonomy capability | taxonomy artifact와 decision-flow 변환 계약 | `taxonomy-decision-bridge` |
| Taxonomy preview surfaces | taxonomy capability | taxonomy artifact 브라우저 탐색 consumer | `@qa-sdk/taxonomy-web` |
| Profile contract tooling | profile capability | profile fixture 계약과 adapter payload | `data-structure-profile` |
| Quality evidence ledgers | profile capability | gate/review 결과 영속 기록 | `quality-ledger`, `review-ledger` |
| Measurement tooling | profile capability | 측정 실행과 리포트 표면 | `@qa-sdk/bench` |
| Profile preview surfaces | profile capability | lineage/graph artifact 브라우저 consumer | `@qa-sdk/viz-web` |
| Operational ontology runtime | operational ontology capability | schema/pack/runtime/projector와 programming artifact registry | `operational-ontology` |
| Operational ontology preview surfaces | operational ontology capability | ontology store JSON 브라우저 탐색 consumer | `@qa-sdk/operational-ontology-web` |
| Decision recording | decision evidence capability | 판단 과정과 증거 기록 | `decision-flow`, `decision-flow-store`, `dkg` |
| Spec analysis kernel | spec analysis capability | 스펙/전이/수렴/코드생성 증거 | `@qa-sdk/spec-core`, `spec-schema`, `spec-transition`, `codegen-core` |
| Infra governance tooling | governance tooling | CLI, scaffolding, config/db/git/infra 보조 | `@qa-sdk/cli`, `@qa-sdk/archi`, `package-classifier`, `infra-env-kit` |
| Authorization support | authorization support capability | 권한 정책/감사 영속 보조 | `resource-policy-store`, `audit-recorder-store` |
| Motion authoring | motion authoring capability | motion content/workspace authoring | `motion-content`, `motion-workspace`, `motion-workspace-client` |
| Simulation contracts | simulation contract capability | 시뮬레이션 producer/consumer DTO 계약 | `sim-service-catalog`, `sim-decision-view`, `sim-outbox-view` |
| Visual analysis tools | visual analysis capability | 시각화/브릿지/레이아웃 분석 도구 | `viz-core`, `@qa-sdk/viz-3d`, `visbug-bridge` |
| Verification suites | verification suite capability | 테스트 하니스와 시나리오 저장소 | `test-types`, `@qa-sdk/e2e`, `test-scenario-store` |
| Product demo surfaces | demo consumer surfaces | 제품 데모/스모크 UI와 API consumer | `@qa-sdk/platform-demo`, `@qa-sdk/shop-web`, `@qa-sdk/registry-ui` |
| Quarantine candidates | quarantine | 제품 surface 승격 보류 | `request-contract`, `weighted-gpu` |

상세 승격/격리 규칙은 `package-surface-separation-rule`을 따른다. `packages/*` surface-managed package coverage와 기능군 drift는 `corepack pnpm arch:surfaces`와 `corepack pnpm arch:verify`가 검증한다. `arch:surfaces`는 기능군별 surface/package 요약도 출력하므로 coordinate kernel, observability runtime, definition catalog, decision evidence, spec analysis, governance tooling, taxonomy capability, profile capability, operational ontology capability, authorization support, motion authoring, simulation contract, visual analysis, verification suite, demo consumer, quarantine이 같은 제품 surface로 다시 합쳐졌는지 즉시 확인할 수 있다. `simulations/*`와 `vendor/*` workspace는 support scope로만 감사하며, 기능 surface 표에는 승격하지 않는다.

운영자가 실제 패키지를 고를 때는 taxonomy 기능군은 `system-taxonomy`, profile 기능군은 `system-profile`, operational ontology 기능군은 `system-operational-ontology`를 먼저 본다. 이 문서들은 package ownership을 새로 만들지 않고 이 표와 `package-surface-separation-rule`의 배정을 소비하는 얇은 entry surface다.

## 인코딩 체인

mixed-radix 좌표 인코딩의 핵심 라이브러리 체인:

```
weighted-index (1D 주소 인코딩/디코딩)
  → bit-index (비트 기반 인메모리 필터)
    → permission-engine (권한 3-tier 코덱: text ↔ integer ↔ bitmask)
```

| 패키지 | 역할 | 형식 |
|--------|------|------|
| weighted-index | shape 기반 encode/decode + LabelRegistry | unscoped, tsup dual (ESM+CJS) |
| bit-index | BitIndex, BitMaskSet, IndexBridge | unscoped, tsup dual |
| permission-engine | PermissionCodec, PermissionSet, resource 검증 | unscoped, tsup dual |

의존 방향: weighted-index ← bit-index ← permission-engine. 역방향 import 금지.

## 플랫폼 체인

이벤트 수집과 좌표 관리의 플랫폼 계층:

```
@qa-sdk/core (타입, 스키마, ID 생성, catalog runtime)
  → @qa-sdk/logger (QaLogger, Transport, masking)
    → codec (browser-codec, codec-proto)
      → @qa-sdk/context (서비스 컨텍스트 관리)
        → @qa-sdk/sdk (통합 SDK)
```

| 패키지 | 역할 | 형식 |
|--------|------|------|
| @qa-sdk/core | EventRecord, TransmissionEnvelope, Catalog, address-parser, service-ports | @qa-sdk scope, tsc ESM |
| @qa-sdk/logger | QaLogger, Transport 6종, masking | @qa-sdk scope |
| browser-codec | 브라우저용 경량 인코딩 | unscoped |
| codec-proto | Protobuf encode/decode (zero-dependency) | @qa-sdk scope |
| @qa-sdk/context | 서비스 부트 설정, 런타임 컨텍스트 | @qa-sdk scope |
| @qa-sdk/sdk | 통합 SDK (서버용) | @qa-sdk scope |

## 인프라 서비스

SERVICE_PORTS (core/src/lib/service-ports.ts) SSOT:

| 서비스 | 포트 | 역할 | 저장소 |
|--------|------|------|--------|
| ingest-server | 3200 | 이벤트 수집 + Phase 2 | memory/d1/pg/clickhouse |
| registry-service | 3300 | 카탈로그/주소 스키마 관리 | SQLite (D1) |
| gate-service | 3400 | 주소 상태 게이트 (읽기 전용) | SQLite |
| query-service | 3500 | 정책 규칙 질의 | SQLite |
| decode-service | 3600 | 좌표 디코더 캐시 | Stateless |

비즈니스 서비스 (데모): shopping-backend(4100), auth(4200), payment(4300), gateway(4400).
프론트엔드: shopping-web(5220), platform-demo(5176).

## 스펙/분석 패키지

| 패키지 | 역할 |
|--------|------|
| spec-core | 스키마 검증, DKG, codegen, propagation, convergence, transition |
| convergence | convergence 파이프라인 분리 모듈 (spec-core에서 동적 import) |
| decision-flow | 의사결정 흐름 엔진 (FlowEngine, FlowSchema, narrative) |
| event-catalog | 이벤트 카탈로그 + auto-track + prefix 매핑 |
| definition-catalog | 좌표/영속/전파/추출/조립/역추적 전체 구조 |

## 환경 공급 패키지

| 패키지 | 역할 |
|--------|------|
| infra-env-kit | `.env` 생성, 서비스 연결 TS 모듈 생성, docker-compose override 생성, export/codegen orchestration, `infra-env` CLI |

운영/소비 패키지인 `infra-engine`와 분리되어, 공급 기능은 `infra-env-kit`를 기본 surface로 사용한다.

## 권한 지원 저장소

| 패키지 | 역할 | 시스템 문서 |
|--------|------|-------------|
| resource-policy-store | `ResourcePolicyRegistry` SQLite/PG 구현, resource lifecycle persistence, PostgreSQL RLS enforcement | `resource-policy-store-system` |
| audit-recorder-store | `AuditRecorder` SQLite/PG 구현, nested audit tree persistence, first-failure replay, RLS shadow evidence | `audit-recorder-store-system` |

## 스캐폴딩 패키지

| 패키지 | 역할 | 시스템 문서 |
|--------|------|-------------|
| @qa-sdk/scaffold | DDD/CQRS/Ports and Adapters 도메인 구조, template catalog, architecture validator, governance metadata scaffold | `scaffold-system` |

권장 사용 분리:

- 운영/배포/관측: `infra ...`
- 환경 공급: `infra-env ...`

## 프론트엔드/데모

| 패키지 | 역할 |
|--------|------|
| platform-demo | 3D 모니터 + 다이어그램 뷰어 (Vite) |
| shop-web | 쇼핑 데모 사이트 (`@qa-sdk/browser` 소비자) |
| @qa-sdk/taxonomy-web | taxonomy artifact와 decision bridge 결과를 탐색하는 preview consumer |
| @qa-sdk/viz-web | lineage/graph artifact를 탐색하는 profile preview consumer |
| @qa-sdk/browser | 범용 브라우저 SDK (특정 도메인 데이터 금지) |
| motion-content | 모션 콘텐츠 (platform-demo에서 분리) |
