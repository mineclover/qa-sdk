---
def:
  id: swc-next-qa-sdk-optimization-05-interface-map
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: apm-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: overview
  links:
    - target: swc-next-qa-sdk-optimization-readme
      type: depends_on
status: draft
date: 2026-10-29
part_of: swc-next-qa-sdk-optimization
role: inventory
sources:
  - packages/core/src/catalog/snapshot/index.ts
  - packages/core/src/types/envelope.ts
  - packages/ingest-server/src/lib/snapshot-gate.ts
  - packages/registry-service/src/modules/catalog/catalog.controller.ts
  - packages/codegen-core/src/catalog-typescript.ts
  - packages/browser-codec/src/browser-codec.ts
---

# 인터페이스·기능 맵 (2026-10-29)

## 목적 ^purpose

이번 최적화 작업(T0, Track A~F, 1·2순위 정리, 오류 전환)이 만들거나 바꾼 공개 인터페이스를 한 곳에 모으고, 각 인터페이스를 **누가 쓰고 누가 읽는지** 적는다. 판정 기준은 [03-unwired-spec-review.md](./03-unwired-spec-review.md)와 같다: 쓰는 곳만 있고 읽는 곳이 없는 인터페이스는 관리 비용이다.

## 1. 종단 흐름 ^defines

```
Catalog ──codegen──▶ CATALOG_SNAPSHOT (Node) / BROWSER_CATALOG_SNAPSHOT (브라우저)
                          │  SDK 설정 catalogSnapshot (logger·apm·browser-sdk)
                          ▼
                 envelope.catalog_snapshot  ── JSON / proto field 12
                          │
                          ▼
          ingest snapshot gate ── registry GET /catalogs/:id/snapshots/{latest,:digest}
            resolveDecodeLayout(prefix@version)            ▲
            assertAddressInLayout(주소)                     │ prepareSnapshot / publishCandidate
                          │                       registry catalog_snapshots (불변, digest 키)
            ok·missing·degraded → 수락, violation → warn 수락 / enforce 422
```

같은 catalog면 codegen 상수의 `digest`와 registry가 발행한 snapshot의 `digest`가 같다(`computeCatalogDigest`). gate가 별도 매핑 없이 비교할 수 있는 이유다.

## 2. 인터페이스 표

### 2.1 `@qa-sdk/core` — `catalog/snapshot`

| 인터페이스 | 역할 | 프로덕션 소비자 |
|---|---|---|
| `canonicalJson`, `digestCanonical`, `computeCatalogDigest`, `shortDigest` | 결정론 직렬화·digest | codegen-core, registry(store·health), bench, browser-flatten, viz-3d 생성기 |
| `sha256Hex`, `CATALOG_DIGEST_ALGORITHM` | digest 원시 함수·알고리즘 표식 | snapshot 내부 (snapshot 필드 `digestAlgorithm`) |
| `CodecContractError`, `isCodecContractError`, `CODEC_ERROR_CODES` | 실패 계약 9종 | core runtime, codec-proto, ingest(route·gate·error-handler) |
| `buildCatalogSnapshot`, `prefixLayoutKey` | snapshot·layout 생성 | registry catalog service, decode-service |
| `layoutToDecodeMap`, `reservedEntryLabel` | layout → DecodeMap (shape = capacity) | registry, decode-service, browser-codec(라벨 규칙 복제) |
| `findUnversionedBreakingChanges` | 발행 전 breaking 검사 (`MigrationRequired`) | registry publish |
| `resolveDecodeLayout`, `assertAddressInLayout`, `toSnapshotIdentity` | decode 판정 | ingest snapshot gate |
| `classifyLayoutChange` | layout 변경 분류 | snapshot 내부(위 두 함수) |
| `toSnapshotWire` | 발행 snapshot → wire 문맥 | 테스트만. 런타임에 registry에서 받은 snapshot을 SDK에 넘기는 경로용 |
| `LEGACY_V1_CODEC`, `SUPPORTED_CODEC_VERSIONS`, `isSupportedCodecVersion`, `CATALOG_SNAPSHOT_SCHEMA_VERSION` | 버전 축 상수 | codegen-core, browser-flatten, snapshot 내부 |

### 2.2 envelope·SDK

| 인터페이스 | 위치 | 생산자 → 소비자 |
|---|---|---|
| `TransmissionEnvelope.catalog_snapshot` (`CatalogSnapshotWire`) | core types·zod `catalogSnapshotWireSchema`·proto field 12 | logger·apm·browser-sdk → ingest snapshot gate |
| SDK 설정 `catalogSnapshot` | logger `QaLoggerConfig`, apm `ApmBootConfig`, browser-sdk `QaMonitorConfig` | 앱 → envelope |
| `CATALOG_SNAPSHOT` (생성물) | codegen `prefix-ids.ts` (예: demo-types) | Node 앱 → SDK 설정 |
| `BROWSER_CATALOG_SNAPSHOT` (생성물) | browser-codec `demo-catalog-browser.ts` | 브라우저 앱 → SDK 설정 |
| `BrowserCatalogSnapshot` | core `browser-flatten` — `CatalogSnapshotWire`에서 `snapshot_version`을 뺀 타입 | viz-3d 생성기 |
| `entry_snapshot` / `entrySnapshot` | envelope·proto field 8, SDK 설정 3곳 | SDK → **읽는 곳 없음** (§4) |

### 2.3 browser-codec

| 인터페이스 | 실패 처리 | 소비자 |
|---|---|---|
| `encode`, `decode`, `track` | `null` 반환 (UI 크래시 방지) | browser-sdk, 앱 |
| `encodeDetailed`, `decodeDetailed` (`BrowserCodecResult`) | `{ ok: false, code }` — `UnknownPrefix`·`AddressOutOfRange`·`InvalidDimensionValue`·`MalformedAddress` | 공개 API (사내 소비자 아직 없음) |

### 2.4 서비스

| 서비스 | 인터페이스 | 소비자 |
|---|---|---|
| registry | `GET /catalogs/:id/snapshots/latest` (없으면 지연 발행), `GET /catalogs/:id/snapshots/:digest` (404 `UnknownCatalogSnapshot`) | ingest snapshot registry client |
| registry | publish 422 `UNVERSIONED_BREAKING_CHANGE {code: 'MigrationRequired'}` | catalog 작성자 |
| registry | `/health`의 `catalogHash`(= `shortDigest`)·`catalogDigest` | SDK GENERATION 비교 |
| ingest | `SNAPSHOT_GATE_MODE`(off·warn·enforce, 기본 warn), `SNAPSHOT_REGISTRY_URL` | 운영 |
| ingest | `snapshot_gate_total{result, code}`, `/health/ready`의 `snapshot_registry` | `/v1/metrics`, readiness |
| ingest | `CodecContractError` → `CorruptEnvelope` 400, 그 외 422 | SDK |
| ingest | `/v1/key-observations/{summary,unregistered,prefixes/:id}` (U-4) | 운영 조회 |
| ingest | `/v1/patterns/{health,stats}` (U-2) | 운영 조회 |

### 2.5 개발 도구

| 도구 | 역할 |
|---|---|
| `pnpm ci:local` (`scripts/ci-local.mjs`) | workflow 게이트·핵심 패키지 테스트·bench smoke (`--only`·`--skip`·`--list`) |
| `scripts/catalog-codegen-drift.mjs` (`--update`) | 생성물 바이트 비교 |
| `arch:verify` (`scripts/verify-analysis-os.ts`) | 파일 목록은 `git ls-files`(추적 + 무시 규칙 밖) 기준 — 로컬 도구 상태·깨진 symlink가 결과를 바꾸지 않는다 |
| codegen 헤더 `catalogDigest`·`sourceDigest` | 생성물이 어느 catalog·소스에서 나왔는지 |

## 3. 이번 정리에서 맞춘 것

| 항목 | 이전 | 지금 |
|---|---|---|
| gate 주소 범위 | prefix@version layout 호환만 확인. `assertAddressInLayout`은 소비자 없음 | 사용된 주소마다 layout 주소 공간 확인 (`AddressOutOfRange`, `StrideOverflow`) |
| Node SDK 문맥 생산 | 설정 `catalogSnapshot`은 있으나 값을 만들 생성물 없음 → Node envelope은 항상 `missing` | codegen이 `CATALOG_SNAPSHOT` 생성. 브라우저 `BROWSER_CATALOG_SNAPSHOT`과 대칭 |
| 문맥 타입 | `BrowserCatalogSnapshot`이 `CatalogSnapshotWire`와 같은 필드를 따로 선언 | `Omit<CatalogSnapshotWire, 'snapshot_version'>`에서 파생 |
| 환경변수 표 | `SNAPSHOT_GATE_*`가 `docs/CONVENTIONS.md`에 없음 | 추가 |

## 3.1 안정성 등급과 회귀 방지 ^validation

| 등급 | 의미 | 대상 | 지키는 테스트 |
|---|---|---|---|
| **stable** | 외부(배포된 SDK·운영 API)가 의존한다. 필드·코드는 추가만 하고 바꾸거나 지우지 않는다 | envelope `catalog_snapshot`(JSON·proto field 12), `CODEC_ERROR_CODES` 9종과 HTTP 400/422 매핑, SDK 설정 `catalogSnapshot`, 생성물 `CATALOG_SNAPSHOT`·`BROWSER_CATALOG_SNAPSHOT`, registry `snapshots/latest`·`snapshots/:digest`, `computeCatalogDigest` 결과 | demo-tests `codec-compat/interface-contract`(코드 집합, Node·브라우저 문맥 일치, registry digest 일치), `three-way-parity`·`legacy-v1-corpus`, codec-proto round-trip, ingest `snapshot-gate`·`error-handler` |
| **experimental** | 공개돼 있지만 사내 소비자가 없다. 첫 소비자가 생길 때 형태를 확정한다 | `encodeDetailed`·`decodeDetailed`, `toSnapshotWire`, `/v1/key-observations/*`, `/v1/patterns/*` | 각 패키지 단위 테스트 |
| **deprecated** | 읽는 곳이 없다. 수용만 하고 새 코드는 쓰지 않는다 | `entry_snapshot`·`entrySnapshot` (I-2) | schema 수용 테스트 |

stable 인터페이스를 바꿔야 하면 ADR-010을 먼저 고치고, 위 테스트가 실패하는 것을 확인한 뒤 함께 갱신한다.

## 4. 남은 정리 후보 (사람 결정)

| # | 대상 | 상태 | 권장 |
|---|---|---|---|
| I-1 | codegen-core `generateTypescript`·`generateProto` (SchemaSnapshot DSL → `ApmEnvelope`·proto) | 프로덕션 호출 0 (테스트·CLI e2e만). 생성하는 envelope이 `TransmissionEnvelope`·`proto/transmission.proto`와 다르다 (owner·source 평탄화, `entry_snapshot = 11` vs 실제 8, `catalog_snapshot` 없음) | ✅ 2026-10-29 삭제 — 생성기·전용 테스트(CLI `type-safety.e2e`, `scenarios.e2e` S2·S7·S9 등)·spec `codegen-schema-output` deprecated |
| I-2 | `entry_snapshot` / `entrySnapshot` | D-2로 deprecated 유지. ingest·store 어디도 읽지 않는다 | 외부 SDK 배포본이 보내는 동안은 schema 수용만 유지하고, SDK 설정 3곳의 옵션은 다음 major에서 제거 |
| I-3 | `toSnapshotWire` | 테스트만 사용 | 유지 — registry에서 받은 snapshot을 런타임에 SDK로 넘기는 정식 경로. 쓰는 앱이 생기기 전까지 추가 기능 금지 |
| I-4 | `encodeDetailed`·`decodeDetailed` | 사내 소비자 없음 | 유지 — 실패 원인을 알아야 하는 외부 소비자용 공개 API (오류 전환에서 승인) |
| I-5 | envelope `catalog_snapshot` 영속 | gate 판정 후 버린다 | #15(batch 문맥 조회)에서 읽는 API와 함께 설계 — 읽는 곳 없이 저장하지 않는다 |
