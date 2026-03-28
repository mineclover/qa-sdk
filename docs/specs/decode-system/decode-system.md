---
def:
  id: decode-system
  address: def_document:v1:3224
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [structural, entry-point, tier-infra]
  links:
    - target: decode-api
      type: contains
    - target: decode-bundle
      type: contains
    - target: decode-deploy
      type: contains
    - target: registry-system
      type: depends_on
---

# Decode 시스템

## 목적 ^purpose

MetaRegistry 없이 DecodeMap 번들로 독립 decode를 수행하는 경량 서비스. Edge Worker부터 Standalone Node.js까지 다양한 배포 형태를 지원한다.

## 구성 ^overview

- `decode-api`: 주소 정수를 entity ID 매핑으로 변환하는 REST 엔드포인트.
- `decode-bundle`: decode에 필요한 최소 데이터(entity name → ID 매핑)를 DecodeMap 번들로 패키징하고, 캐시/갱신을 관리한다.
- `decode-deploy`: Decode Service의 3가지 배포 형태와 각각의 제약 조건을 정의한다.

## 운영 개요

### 서비스 정체성

- `ServiceBootConfig`: `createServiceBootConfig("decode-service")`
- ownedPrefixes: `[]` — 읽기 전용, 이벤트 생산 없음
- consumedPrefixes: `["service"]`
- 포트: 3600 (기본)

### 서비스 의존

```
decode-service
  → registry-service (startup 시 DecodeMap fetch)
  ← ingest-server (Phase 2에서 주소 디코딩 호출)
```

- `REGISTRY_URL` 미설정 → 빈 pool로 시작 (fail-open)
- registry fetch: `AbortSignal.timeout(5_000)` 적용

### 캐시 전략

- `DecoderPool`: prefix/version별 `PrefixDecoder` TTL 기반 캐시
- Node.js: `CACHE_TTL_MS` (기본 60초). TTL 만료 → 다음 접근 시 null → 클라이언트 재요청
- Worker: TTL=0 (만료 없음, 프로세스 수명 동안 유지)
- 능동적 갱신 없음 — pull 모델
