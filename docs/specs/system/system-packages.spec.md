---
def:
  id: system-packages
  tier: component
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
---

# 패키지 구조

## 목적 ^purpose

qa-sdk 모노레포의 패키지 의존 관계. 인코딩 라이브러리 체인(weighted-index → bit-index → permission-engine)과 플랫폼 체인(@qa-sdk/core → logger → codec → context → sdk).

## 구성 ^overview

- `인코딩 체인`: weighted-index → bit-index → permission-engine 인코딩 라이브러리 의존 체인을 정의한다.
- `플랫폼 체인`: @qa-sdk/core → logger → codec → context → sdk 플랫폼 계층을 기술한다.
- `인프라 서비스`: ingest(3200), registry(3300), gate(3400), query(3500), decode(3600) 서비스를 명시한다.
- `환경 공급 패키지`: infra-env-kit이 `.env`/연결 코드/compose override 공급 책임을 가진다.
- `스펙/분석 패키지`: spec-core, convergence, decision-flow, event-catalog의 역할을 정리한다.
- `프론트엔드/데모`: platform-demo, shop-web, viz-web, browser-sdk의 위치를 기술한다.

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

권장 사용 분리:

- 운영/배포/관측: `infra ...`
- 환경 공급: `infra-env ...`

## 프론트엔드/데모

| 패키지 | 역할 |
|--------|------|
| platform-demo | 3D 모니터 + 다이어그램 뷰어 (Vite) |
| shop-web | 쇼핑 데모 사이트 (browser-sdk 소비자) |
| viz-web | 시각화 웹 |
| browser-sdk | 범용 브라우저 SDK (특정 도메인 데이터 금지) |
| motion-content | 모션 콘텐츠 (platform-demo에서 분리) |
