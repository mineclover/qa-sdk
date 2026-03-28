---
def:
  id: registry-client-spec
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [tier-infra]
  links:
    - target: registry-events-spec
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
---

# RegistryClient

## 목적 ^purpose

이벤트 레지스트리에 대한 검증 HTTP 클라이언트. TTL+LRU 캐시로 중복 호출 방지.

## 구성 ^overview

- **validateEvent**: serviceName + eventKey + eventVersion 조합으로 레지스트리에 등록 여부 검증 → ValidationResult(valid, reason?)
- **캐시**: TTL(기본 5분) + LRU(기본 1000개) in-memory 캐시, 성공(200)과 실패(404) 모두 저장
- **Fail-Open**: 네트워크 에러·5xx 등 장애 시 valid: true 반환 + 경고 로깅 (이벤트 차단하지 않음)
- **HTTP 경로**: GET {baseUrl}/services/{serviceName}/events/{eventKey}/versions/{eventVersion}
- **제약**: 단일 인스턴스 내 in-process 캐시 (서버 간 공유 없음), 캐시 무효화 API 없이 TTL 만료에 의존

## 상태

implemented

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

## RegistryClientOptions

```typescript
interface RegistryClientOptions {
  baseUrl: string;
  cacheMaxEntries?: number;
  cacheTtlMs?: number;
  fetch?: typeof fetch;
  logger?: Pick<Logger, "warn">;
}
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `baseUrl` | (필수) | 레지스트리 서버 URL |
| `cacheMaxEntries` | 1000 | 캐시 최대 항목 수 |
| `cacheTtlMs` | 300000 (5분) | 캐시 TTL (밀리초) |
| `fetch` | 글로벌 `fetch` | HTTP fetch 구현 (테스트용 주입) |
| `logger` | - | 경고 로깅용 Logger |

## ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  reason?: string;
}
```

- `valid: true` — 레지스트리에 등록된 이벤트
- `valid: false, reason: string` — 미등록 이벤트 (사유 포함)

## 동작

### 검증 흐름

```
1. 캐시 조회 (serviceName + eventKey + eventVersion 키)
2. 캐시 히트 + TTL 유효 → 캐시 결과 반환
3. 캐시 미스 → HTTP GET /services/{serviceName}/events/{eventKey}/versions/{eventVersion}
4. 200 OK → valid: true, 캐시 저장
5. 404 Not Found → valid: false, reason 포함, 캐시 저장
6. 기타 에러 (네트워크, 5xx 등) → fail-open (valid: true 반환, 캐시 안 함)
```

### Fail-Open 전략

- 레지스트리 서버 장애 시 이벤트를 차단하지 않음
- 네트워크 에러, 비정상 응답 코드 → `{ valid: true }` 반환
- 경고 로깅 후 정상 처리 계속

### 캐시

- TTL + LRU 기반 in-memory 캐시
- 만료된 항목은 조회 시 자동 삭제
- 최대 항목 수 초과 시 가장 오래된 항목 제거
- 검증 성공(200)과 실패(404) 모두 캐시

### HTTP 요청

- `GET {baseUrl}/services/{serviceName}/events/{eventKey}/versions/{eventVersion}`
- 경로 파라미터는 URL 인코딩
- 인증은 게이트웨이 레벨에서 처리 (클라이언트는 인증 헤더 미포함)

## 제약 조건

- 단일 인스턴스 내 in-process 캐시 (서버 간 공유 없음)
- 캐시 무효화 API 없음 — TTL 만료에 의존
