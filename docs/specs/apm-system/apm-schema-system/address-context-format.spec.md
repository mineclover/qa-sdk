---
def:
  tier: component
  id: address-context-format
  address: def_document:v2:412800
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [observability, contract, runtime]
  links:
    - target: apm-schema-system
      type: refines
---

# Address Context 형식

## 목적 ^purpose

`address_context`가 EventRecord와 TransmissionEnvelope에 실리는 문자열 형식, 머지 규칙, 하위 호환 경계를 정리한다.

## 구성 ^overview

- `직렬화 형식`: address_context의 key/value 문자열 형식과 파싱 규칙을 정의한다.
- `머지 규칙`: envelope.infra_context와 record.address_context 간 우선순위를 규정한다.
- `Zod 스키마 검증`: transmissionEnvelopeSchema에서의 address_context 검증 범위를 기술한다.
- `하위 호환 정책`: 새 key 추가 시 기존 소비자가 깨지지 않는 확장 규칙을 명시한다.

## 직렬화 형식

`address_context`는 `Record<string, string>` 구조로, key는 prefix ID, value는 `"prefix:version:address"` 3파트 또는 `"catalogId:prefix:version:address"` 4파트 문자열이다.

```typescript
// core/src/lib/address-parser.ts — ParsedAddress 인터페이스
interface ParsedAddress {
  readonly catalogId?: string;  // 4파트일 때만 존재
  readonly prefix: string;      // 예: "tracking"
  readonly version: string;     // 예: "v1"
  readonly address: number;     // 1D 정수 주소
}
```

- 3파트와 4파트는 콜론(`:`) 구분자 개수로 자동 판별한다.
- 4파트 사용 시 `knownCatalogIds`를 전달하여 첫 파트가 등록된 카탈로그인지 검증한다.
- address 파트는 반드시 정수(Number)여야 한다. NaN이면 파싱 에러를 발생시킨다.
- `serializeAddress(parsed)` → catalogId 유무에 따라 3파트 또는 4파트 문자열 생성.

## 머지 규칙

envelope의 `infra_context`와 record의 `address_context`가 동시에 존재할 때, record가 우선한다(override). `enrichAddressContext()` (ingest-server/src/lib/enrich-address-context.ts) 구현:

1. infra_context 없으면 → 즉시 반환 (zero-allocation)
2. record에 address_context 없으면 → infra_context 참조 공유 (복사 없음)
3. 양쪽 다 있으면 → `{ ...infraCtx, ...record.address_context }` (record 우선)

같은 key가 양쪽에 있으면 record의 값이 이긴다. 이 규칙은 SDK 레벨에서 이벤트에 직접 부여한 좌표가 인프라 기본 좌표보다 구체적이라는 가정을 반영한다.

## Zod 스키마 검증

`transmissionEnvelopeSchema` (core/src/schema/envelope.schema.ts):
- `infra_context`: `z.record(z.string(), z.string()).optional()`
- `records[].address_context`: eventRecordSchema 내부에서 동일 규칙 적용

구조 검증만 수행하고, 의미 검증(prefix 존재 여부, version 유효성)은 `checkAddressHealth()`에서 별도 처리한다.

## 하위 호환 정책

| 변경 유형 | 허용 | 비고 |
|-----------|------|------|
| 새 key 추가 | O | 기존 소비자는 모르는 key를 무시 |
| 기존 key 의미 변경 | X | 디코딩 결과가 달라지므로 금지 |
| key 삭제 | O (deprecation 후) | 소비자에게 사전 고지 필요 |
| value 형식 변경 (3파트→4파트) | O | 파서가 양쪽 모두 지원 |

## 건전성 검증

`checkAddressHealth(records, knownPrefixes, latestVersions)` — ingest 경로에서 address_context의 건전성을 간이 검증한다.

- `orphanPrefixes`: catalog에 없는 prefix ID 탐지
- `staleVersions`: 최신이 아닌 version 사용 탐지
- `healthRate`: validAddresses / totalAddresses 비율
- 이벤트를 거부하지 않고 경고로 기록한다(fail-open).
