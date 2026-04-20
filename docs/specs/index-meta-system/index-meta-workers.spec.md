---
def:
  id: index-meta-workers
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: index-meta-workers
  tags: [workers, edge, cloudflare]
  links:
    - target: index-meta-system
      type: refines
---

# index-meta-workers 스펙

## 목적 ^purpose

Cloudflare Workers / Edge 런타임 전용 index-meta 서브셋 패키지.
Node.js 전용 네이티브 바인딩을 제거하여 Workers 환경에서 안전하게 import 가능한 진입점을 제공한다.

## 구성 ^overview

- **아키텍처**: `index-meta/workers` 진입점을 단일 re-export (`export * from "index-meta/workers"`)
- **포함**: D1SqlDriver, 모든 순수 로직(GateEngine, MetaCodec, PrefixDecoder 등), SQL 스토어, 정책 리졸버
- **제외**: Node.js 전용 드라이버 5종(NodeSqliteDriver, BetterSqliteDriver, BunSqliteDriver, createSqliteDriver, getDatabaseSync)
- **소비자**: gate-service, query-service, decode-service (각 `worker.ts` 진입점)
- **빌드**: tsup dual format (ESM + CJS), unscoped name

## 정의 ^defines

### 존재 이유

Cloudflare Workers 런타임은 Node.js 전용 모듈을 로드할 수 없다.

| 제외 대상 | 의존하는 Node.js 모듈 |
|---|---|
| `NodeSqliteDriver` | `node:fs`, `node:path`, `node:module`, `node:sqlite` |
| `BetterSqliteDriver` | `better-sqlite3` (네이티브 바인딩) |
| `BunSqliteDriver` | `bun:sqlite` |
| `createSqliteDriver` | 위 드라이버 오케스트레이션 |
| `getDatabaseSync` | `node:module` (`createRequire`) |

`index-meta` 패키지의 메인 진입점(`.`)은 위 드라이버를 모두 포함하므로, Workers에서 import하면 번들 시점에 해석 실패가 발생한다.
`index-meta/workers` 진입점은 이 5종을 명시적으로 제외하고, `index-meta-workers` 패키지는 이를 re-export하여 깔끔한 import 경로를 제공한다.

### 포함 모듈 분류

#### SDK / Core

| 모듈 | 역할 |
|---|---|
| `createIndexSDK` | 경량 소비 SDK |
| `MetaRegistry` | 메타데이터 등록/조회 허브 |
| `AddressProtocolManager` | 주소 직렬화 프로토콜 |
| `MetaCodec` / `MetaCodecBig` | DecodeMap 기반 encode/decode |
| `MetaResolver` | DecodeMap/DimRange/IndexRange 변환 |
| `defineTable` / `compileSchema` | 테이블 스키마 선언/컴파일 |

#### Workers 호환 어댑터

| 모듈 | 역할 |
|---|---|
| `D1SqlDriver` | Cloudflare D1 SQL 드라이버 |
| `D1IndexMetaStore` | D1 기반 IndexMetaStore |
| `SqlIndexMetaStore` | SQL 범용 스토어 |
| `SqlPrefixRegistry` / `SqlPrefixRouter` | SQL 기반 prefix 관리 |
| `InMemory*` | 메모리 기반 스토어 (테스트/로컬) |

#### Gate / Address State

| 모듈 | 역할 |
|---|---|
| `GateEngine` | 4-state 게이트 모델 |
| `ADDRESS_GATE` / `checkGate` / `classifyAddress` | 주소 상태 분류 |
| `SqlAddressStateStore` / `SqlAddressRangeCache` | SQL 기반 주소 상태 저장 |

#### Query / Decode

| 모듈 | 역할 |
|---|---|
| `PrefixDecoder` / `PrefixDecoderBig` | prefix 디코딩 + 의미 해석 |
| `composeQuery` / `deepDecode` | 크로스 인덱스 탐색 |
| `gateFilterRanges` / `gateAwareResolve` | 게이트 연동 쿼리 |
| `queryAcrossVersions` | 버전 횡단 쿼리 |

#### 정책 / 관계

| 모듈 | 역할 |
|---|---|
| `RelationalEngine` | 관계형 주소 질의 |
| `matchRules` / `resolvePatternPolicy` | PatternRule 정책 해석 |
| `resolvePolicy` / `detectConflicts` | PolicyRule named 정책 해석 |

#### 기타

| 모듈 | 역할 |
|---|---|
| `DistributedStoreClient` | 분산 스토어 클라이언트 |
| `syncSchemaToRegistry` | 스키마 동기화 |
| `CrossVersionEntrySync` | 크로스 버전 엔트리 동기화 |
| `CoalescingCache` / `EntryCache` / `MigrationCache` / `MetadataCache` | 캐시 레이어 |
| `migrateAddress` / `migrateBatch` | 주소 마이그레이션 |
| `exportVersion` / `importVersion` | 백업/복원 |
| `generateTypes` / `lintSchema` | 코드 생성 / 린트 |

### 소비 서비스

| 서비스 | 진입점 | 번들 크기 | gzip | (2026-04-08 기준) |
|---|---|---|---|
| decode-service | `src/worker.ts` | 391 KiB | 73 KiB |
| gate-service | `src/worker.ts` | 292 KiB | 53 KiB |
| query-service | `src/worker.ts` | 810 KiB | 142 KiB |

세 서비스 모두 `worker.ts`에서 `index-meta-workers`를 import하여 Cloudflare Workers로 배포된다.

### 의존 구조

```
index-meta-workers
  └── index-meta/workers (re-export)
        └── index-meta 내부 순수 모듈들
              └── weighted-index
```

`index-meta-workers`는 `index-meta`에 대한 workspace 의존(`workspace:*`)만 가진다.
런타임에 추가 네이티브 의존성이 없으므로 Edge 환경에서 안전하다.

### import 경로

```ts
// Workers 환경 — index-meta-workers 사용
import { D1SqlDriver, GateEngine, PrefixDecoder } from "index-meta-workers";

// Node.js 환경 — index-meta 메인 진입점 사용
import { NodeSqliteDriver, GateEngine, PrefixDecoder } from "index-meta";
```

## 상태

implemented
