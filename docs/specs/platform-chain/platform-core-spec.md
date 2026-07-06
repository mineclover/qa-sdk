---
def:
  id: platform-core-spec
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: core
  tags: [entry-point]
  links:
    - target: platform-chain-system
      type: refines
sources:
  - packages/core/src/index.ts
  - packages/core/src/catalog/runtime.ts
  - packages/core/src/types/service-identity.ts
  - packages/core/src/lib/create-logger.ts
  - packages/core/src/lib/app-error.ts
  - packages/core/src/platform/index.ts
  - packages/core/src/types/service-identity.test.ts
  - packages/core/src/lib/create-logger.test.ts
---
# @qa-sdk/core — 플랫폼 루트 라이브러리

## 목적 ^purpose

Catalog 타입/런타임, 서비스 정체성, 공용 ID/clock/address helper, 에러 컨벤션, 플랫폼 전용 port/schema export를 제공하는 루트 패키지. downstream 패키지는 `@qa-sdk/core` 또는 좁은 `@qa-sdk/core/platform` export를 소비하지만, core는 downstream 패키지를 import하지 않는다.

소스: `packages/core/src/index.ts`, `packages/core/src/catalog/runtime.ts`, `packages/core/src/types/service-identity.ts`, `packages/core/src/platform/index.ts`

## 정의 ^defines

- Catalog / PrefixDef / AxisDef / DimRef — 좌표계 핵심 타입
- latestPrefixVersion, getPrefixProfile, encodePrefix, decodePrefix, encodePrefixByValue, decodePrefixAsResult — canonical catalog 런타임
- DecodeResult, DecodedPosition — 디코딩 결과
- AppError (code, statusCode, extras) — 서비스 에러 계층
- ServiceBootConfig, toServiceDims, toTransmissionSource, toTransmissionBuild, createServiceBootConfig — 서비스 정체성 진입점
- newTransmissionId, newLogId, newTraceId, newSpanId, newQaSessionId, compareTimestamps, normalizeTimestamp — 공용 런타임 helper
- StaticCatalogProvider, CatalogRegistry — 카탈로그 제공 패턴
- `@qa-sdk/core/platform` — 서비스 전용 scenario/graph/verdict/port/auth utility export

## 소비 ^consumes

- pino — `createLogger()`의 구조화 로거 구현
- zod — 환경변수 스키마 검증
- ulid — ID 생성

## 관련 소스

- `packages/core/src/index.ts` — root public export
- `packages/core/src/platform/index.ts` — 서비스 전용 좁은 export
- `packages/core/src/catalog/runtime.ts` — prefix encode/decode/profile runtime
- `packages/core/src/types/service-identity.ts` — ServiceBootConfig 파생 규칙
