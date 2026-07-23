---
def:
  tier: component
  id: registry-client-spec
  address: def_document:v2:412827
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: registry-client
  tags: [contract, runtime, performance]
  links:
    - target: registry-events-spec
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
sources:
  - packages/registry-client/src/index.ts
  - packages/registry-client/src/registry-client.test.ts
  - packages/ingest-server/src/server.ts
  - packages/cli/src/commands/init.ts
---

# RegistryClient

## 목적 ^purpose

registry-service를 소비하는 HTTP 클라이언트. 현재 운영 표면은 catalog/config/endpoint 조회용 `createRegistryConfigClient()`이고, 이벤트 검증 표면은 `RegistryClient.validateEvent()`가 TTL+LRU 캐시와 fail-open 정책으로 제공한다.

## 구성 ^overview

- **createRegistryConfigClient**: registry-service에서 endpoint, catalog, config, decode-map, event schema, gateway route를 조회한다.
- **validateEvent**: serviceName + eventKey + eventVersion 조합으로 이벤트 스키마 HTTP target에 등록 여부를 질의한다 → ValidationResult(valid, reason?)
- **캐시**: TTL(기본 5분) + LRU(기본 1000개) in-memory 캐시, 성공(200)과 실패(404) 모두 저장
- **Fail-Open**: 네트워크 에러·5xx 등 장애 시 valid: true 반환 + 경고 로깅 (이벤트 차단하지 않음)
- **이벤트 검증 HTTP 경로**: GET {baseUrl}/api/event-schemas/{serviceName}/{eventKey}/{eventVersion}
- **Registry config HTTP 경로**: `/api/endpoints`, `/api/services/*`, `/catalogs/:id/*`, `/api/decode-map`, `/api/event-schemas`, `/health/generation`
- **fetch 주입**: `createRegistryConfigClient()`는 선택적 `fetch` 구현을 받아 테스트·독립 소비자가 transport를 제어할 수 있다. 생략하면 global `fetch`를 사용한다.
- **제약**: 단일 인스턴스 내 in-process 캐시 (서버 간 공유 없음), 캐시 무효화 API 없이 TTL 만료에 의존

## 소비자 ^consumers

- `ingest-server`는 `REGISTRY_URL`이 설정된 경우 `RegistryClient`를 생성하여 이벤트 수집 단계에서 service/event/version 등록 여부를 검증한다.
- `qa-sdk init`은 `createRegistryConfigClient()` 사용 예시를 생성하여 독립 소비자가 registry endpoint/config를 조회할 수 있게 한다.
- `dev:local`은 workspace export가 최신 route contract를 가리키도록 시작 전에 `@qa-sdk/registry-client`를 build한다.

## 이벤트 경로 전환 정책 ^constraint

- 정식 이벤트 검증 경로는 `GET /api/event-schemas/{serviceName}/{eventKey}/{eventVersion}`이다.
- 기존 `/services/{serviceName}/events/{eventKey}/versions/{eventVersion}` 경로는 호환 alias로 유지하지 않으며, 현재 구현에서 `404`를 반환한다.
- registry-service route와 `RegistryClient.validateEvent()`의 경로를 변경할 때는 이 문서, client test, registry controller test, local event smoke를 같은 변경 단위로 갱신한다.
- 경로 전환은 `RegistryClient`의 public method signature를 변경하지 않는 transport contract 변경으로 취급한다.

## 인터페이스

```typescript
class RegistryClient {
  constructor(options: RegistryClientOptions);
  validateEvent(
    serviceName: string,
    eventKey: string,
    eventVersion: string,
  ): Promise<ValidationResult>;
}
```

```typescript
function createRegistryConfigClient(config: RegistryConfig): RegistryConfigClient;
```

## RegistryClientOptions

```typescript
interface RegistryClientOptions {
  baseUrl: string;
  cacheMaxEntries?: number;
  cacheTtlMs?: number;
  fetch?: typeof fetch;
  logger?: Pick<Logger, 'warn'>;
}
```

| 옵션              | 기본값         | 설명                            |
| ----------------- | -------------- | ------------------------------- |
| `baseUrl`         | (필수)         | 레지스트리 서버 URL             |
| `cacheMaxEntries` | 1000           | 캐시 최대 항목 수               |
| `cacheTtlMs`      | 300000 (5분)   | 캐시 TTL (밀리초)               |
| `fetch`           | 글로벌 `fetch` | HTTP fetch 구현 (테스트용 주입) |
| `logger`          | -              | 경고 로깅용 Logger              |

`createRegistryConfigClient()`의 `RegistryConfig`에도 `fetch?: typeof fetch`와
`timeoutMs?: number`를 제공한다. config client는 네트워크 실패 시 endpoint는 `null`,
목록은 빈 배열, map은 빈 객체, catalog/config/generation은 `null`, health는 `false`를
반환하는 fail-soft 정책을 유지한다.

## ValidationResult

```typescript
interface ValidationResult { valid: boolean; reason?: string }
```

- `valid: true` — 레지스트리에 등록된 이벤트
- `valid: false, reason: string` — 미등록 이벤트 (사유 포함)

## 동작

### Config 조회 흐름

```
1. createRegistryConfigClient({ registryUrl, catalogId?, env?, namespace?, region?, timeoutMs? })
2. endpoint/config/catalog/decode-map/event-schema/gateway 메서드 호출
3. registry-service HTTP 응답이 실패하거나 timeout이면 null, 빈 배열, 빈 객체 등 fail-soft 기본값 반환
4. 정상 응답이면 JSON payload 반환
```

### 이벤트 검증 흐름

```
1. 캐시 조회 (serviceName + eventKey + eventVersion 키)
2. 캐시 히트 + TTL 유효 → 캐시 결과 반환
3. 캐시 미스 → HTTP GET /api/event-schemas/{serviceName}/{eventKey}/{eventVersion}
4. 200 OK → valid: true, 캐시 저장
5. 404 Not Found → valid: false, reason 포함, 캐시 저장
6. 기타 에러 (네트워크, 5xx 등) → fail-open (valid: true 반환, 캐시 안 함)
```

### 캐시

- TTL + LRU 기반 in-memory 캐시
- 만료된 항목은 조회 시 자동 삭제
- 최대 항목 수 초과 시 가장 오래된 항목 제거
- 검증 성공(200)과 실패(404) 모두 캐시

### HTTP 요청

- `GET {baseUrl}/api/event-schemas/{serviceName}/{eventKey}/{eventVersion}`
- 경로 파라미터는 URL 인코딩
- 인증은 게이트웨이 레벨에서 처리 (클라이언트는 인증 헤더 미포함)
- legacy event route alias는 제공하지 않는다.

## 제약 조건

- 단일 인스턴스 내 in-process 캐시 (서버 간 공유 없음)
- 캐시 무효화 API 없음 — TTL 만료에 의존
