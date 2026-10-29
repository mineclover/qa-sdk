---
def:
  tier: component
  id: ingest-snapshot-gate
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: ingest-server
  tags: [contract, runtime]
  links:
    - target: ingest-interface-contract
      type: refines
sources:
  - packages/ingest-server/src/lib/snapshot-gate.ts
  - packages/ingest-server/src/lib/snapshot-gate.test.ts
  - packages/ingest-server/src/lib/snapshot-registry-client.ts
  - packages/ingest-server/src/integrity.purpose-flow.test.ts
---

# Ingest snapshot gate (ADR-010)

## 목적 ^purpose

envelope의 `catalog_snapshot` 문맥으로 좌표 주소를 해석해도 되는지 판정한다. 선언(CatalogSnapshot)과 실제(SDK가 보낸 주소)의 차이를 수집 시점에 드러내는 정합성 관리(P3) 진입점이다.

## 판정 ^defines

| 판정 | 조건 | warn | enforce |
|---|---|---|---|
| `ok` | 사용된 prefix@version이 모두 decode 가능하고 주소가 layout 주소 공간 안 | 수락 | 수락 |
| `missing` | `catalog_snapshot` 없음 (구버전 SDK) | 수락 + 경고 1회 | 수락 + 경고 1회 |
| `degraded` | registry 조회 실패·target snapshot 없음 | 수락 + 경고 1회 (fail-open) | 수락 + 경고 1회 (fail-open) |
| `violation` | `resolveDecodeLayout` 또는 `assertAddressInLayout`(`AddressOutOfRange`·`StrideOverflow`)이 `CodecContractError`로 거부 | 수락 + 경고 1회 | **422** |

- target snapshot: registry `GET /catalogs/:id/snapshots/latest` (60s 캐시), 생성 snapshot: `GET /catalogs/:id/snapshots/:digest` (불변이라 영구 캐시). 둘 다 `AbortSignal.timeout(5_000)`
- 생산자: Node SDK는 codegen 생성물의 `CATALOG_SNAPSHOT`, 브라우저 SDK는 `BROWSER_CATALOG_SNAPSHOT`을 설정 `catalogSnapshot`으로 넘긴다
- 설정: `SNAPSHOT_GATE_MODE`, `SNAPSHOT_REGISTRY_URL`(미설정 시 `REGISTRY_URL`)
- 관측: `snapshot_gate_total{result, code}`, `/health/ready`의 `snapshot_registry: ok|degraded`(장애여도 readiness는 유지)
