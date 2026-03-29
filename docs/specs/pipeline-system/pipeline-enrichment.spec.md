---
def:
  id: pipeline-enrichment
  address: def_document:v2:68785
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [observability]
  links:
    - target: pipeline-monitoring
      type: depends_on
---
# enrichAddressContext 미들웨어

## 목적 ^purpose

수집된 이벤트의 address_context를 보강하는 Phase 1 미들웨어. prefix별 좌표를 파싱하고, 누락된 컨텍스트를 카탈로그에서 파생한다.

## 구성 ^overview

enrichAddressContext는 두 가지 기능으로 구성된다.

1. **infra_context 머지** — envelope 수준의 공통 컨텍스트를 각 record에 전파
2. **address 건전성 검증** — 수집된 address_context의 유효성을 경량 검사

소스: `packages/ingest-server/src/lib/enrich-address-context.ts`

## infra_context 머지 규칙

`enrichAddressContext(envelope, records)` 함수가 Phase 1 저장 직전에 호출된다.

- `envelope.infra_context`가 없으면 즉시 반환 (no-op)
- record에 `address_context`가 없으면 infra_context를 참조 공유 (복사 없음, zero-allocation)
- record에 `address_context`가 있으면 spread 머지: `{ ...infraCtx, ...record.address_context }`
- **record의 address_context가 우선** (override 규칙)

이 함수는 `storeEnvelope()` 내부에서 호출되며, 모든 record가 저장되기 전에 실행된다.

## address 건전성 검증

`checkAddressHealth(records, knownPrefixes, latestVersions)` 함수가 선택적으로 실행된다.

### 입력

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `records` | `EventRecord[]` | 수집된 레코드 배열 |
| `knownPrefixes` | `ReadonlySet<string>` | 카탈로그에 등록된 prefix ID 집합 |
| `latestVersions` | `ReadonlyMap<string, string>` | prefix별 최신 버전 맵 |

### 출력: `AddressHealthResult`

| 필드 | 설명 |
|------|------|
| `totalAddresses` | 전체 address_context entry 수 |
| `validAddresses` | 파싱 성공 + 알려진 prefix에 속하는 주소 수 |
| `orphanPrefixes` | 카탈로그에 없는 prefix ID 목록 |
| `staleVersions` | 최신이 아닌 버전을 사용 중인 prefix 목록 (`{ prefix, version, latest }`) |
| `healthRate` | `validAddresses / totalAddresses` (0~1, 주소 없으면 1) |

### 검증 흐름

```
for each record:
  for each [prefixId, serialized] in address_context:
    1. knownPrefixes에 없으면 → orphanSet에 추가
    2. parseSerializedAddress()로 파싱 실패 → skip
    3. 파싱 성공 → validAddresses++
    4. latestVersions와 비교 → 다르면 staleVersions에 추가
```

### 경고 발행 조건

- `orphanPrefixes.length > 0` → warn 로그 (healthRate 포함)
- `staleVersions.length > 0` → warn 로그

### 활성화 조건

IngestDeps에 `knownPrefixes`와 `latestVersions`가 둘 다 설정된 경우에만 실행된다. 미설정 시 건전성 검증은 건너뛴다.

## 성능 고려사항

- ingest 응답 경로(Phase 1)에서 호출되므로 성능에 민감
- `analyzeCollectionHealth()` (전체 catalog 기반 검증)의 경량 버전으로 설계
- Set/Map 기반 O(1) lookup으로 record 수에 비례하는 선형 시간
