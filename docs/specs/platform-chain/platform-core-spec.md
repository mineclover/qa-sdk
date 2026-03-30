---
def:
  id: platform-core-spec
  level: leaf
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
---
# @qa-sdk/core — 플랫폼 루트 라이브러리

## 목적 ^purpose

Catalog 타입 정의, 런타임 함수(encodePrefix, decodePrefix, getPrefixProfile), 에러 컨벤션(AppError, ServiceClientError), auth middleware를 제공하는 플랫폼 의존 체인의 루트.

## 정의 ^defines

- Catalog / PrefixDef / AxisDef / DimRef — 좌표계 핵심 타입
- encodePrefix, decodePrefix, latestPrefixVersion — canonical 런타임
- DecodeResult, DecodedPosition — 디코딩 결과
- AppError (code, statusCode, extras) — 서비스 에러 계층
- ServiceBootConfig — 서비스 정체성 진입점
- compareTimestamps, normalizeTimestamp — ISO-8601 비교
- StaticCatalogProvider, CatalogRegistry — 카탈로그 제공 패턴

## 소비 ^consumes

- pino — 로거 타입 (peer dependency)
- zod — 환경변수 스키마 검증
- ulid — ID 생성

## 관련 소스

- `packages/core/src/` — 294줄 index.ts, 54 exports
