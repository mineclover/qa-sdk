# Realization Plan: 카탈로그 생명주기 관리

> Status: **completed**
> Created: 2026-03-22
> Completed: 2026-03-22
>
> **달성**: Phase 1~4 전부 구현.
> Phase 1: generateCatalogTypes() 순수 함수 → 7개 TS 파일 (prefix-ids, axes, dims, sdk-factory, context-types, dsl, index).
> Phase 2: CatalogRegistry register/unregister/setDefault + computeCatalogHash() 드리프트 감지.
> Phase 3: viz-3d/scripts/generate-browser-catalog.ts 자동 생성 + prebuild 스크립트.
> Phase 4: loadCatalog() 3-tier 우선순위 (--catalog → qa-sdk.config.ts → DEMO_CATALOG).

## 1. 현재 상태 + 문제 진단

### 1.1 카탈로그의 두 가지 진실

현재 카탈로그 데이터가 두 곳에 존재하며 서로 동기화되지 않는다.

| 출처 | 위치 | 형태 | 역할 |
|------|------|------|------|
| **TypeScript 상수** | `packages/demo-snapshot/src/demo-catalog.ts` | `const DEMO_CATALOG` (readonly 객체) | 빌드 시점 SSOT. `_axes` → `_svcAddr()` → refEntries 자동 파생 |
| **런타임 Store** | `packages/registry-service/src/stores/catalog-store.ts` | `CatalogRecord` (JSON 직렬화) | HTTP CRUD (`/catalogs`). SQLite 또는 InMemory |

registry-service의 `seedDemoCatalog()` (`packages/registry-service/src/server.ts:150-199`)가 시작 시 `JSON.stringify(DEMO_CATALOG)`로 blob을 한 번 복사하지만, 이후 양쪽은 독립적으로 진화한다.

### 1.2 끊어진 5개 경로

| # | Gap | 현재 상태 | 문제 |
|---|-----|----------|------|
| G1 | `dkg add-entry --apply` → TS 파일 | `executeEntryAdd()`가 DKG 그래프 + SQLite만 변이. `mutation.catalog`을 반환하지만 CLI가 이를 무시 | TS 상수가 실제로 바뀌지 않음 |
| G2 | `dkg add-entry` → CatalogStore | `entry-add-executor.ts`가 registry-service CatalogStore에 대해 아무 작업도 하지 않음 | 런타임 API와 DKG 불일치 |
| G3 | CatalogStore → TS 파일 | PUT `/catalogs/:id`로 blob을 교체할 수 있지만, TS 파일로 역방향 기록하는 경로 없음 | API 변경이 코드에 반영 안 됨 |
| G4 | AxisProfileStore → CatalogStore | axis entries POST가 `entryCount`만 증가. CatalogRecord JSON blob은 그대로 | 축 프로필과 blob 불일치 |
| G5 | BROWSER_CATALOG 재생성 | `generate-browser-catalog.ts`가 TS import 기반. 런타임 변이 후 자동 재생성 경로 없음 | 프론트엔드 카탈로그 stale |

### 1.3 CatalogMutator의 현재 상태

`packages/spec-core/src/propagation/catalog-mutator.ts`에 두 함수가 이미 구현되어 있다:

- `addEntryToCatalog(catalog, axisId, entry)` — 축에 entry 추가 + 영향 prefix 버전 핀 갱신. 새 `Catalog` 객체 반환
- `expandCapacity(catalog, axisId)` — capacity 2배 확장. stride-break 경고

`entry-add-executor.ts`가 이를 오케스트레이션하며 DKG VersionEvent를 기록하지만, **변이된 catalog 객체가 어디에도 영속화되지 않는다.**

---

## 2. 목표 아키텍처

```
define ──→ register ──→ mutate ──→ persist ──→ sync
  │           │           │          │          │
  │           │           │          │          ├─ TS 파일 재생성
  │           │           │          │          ├─ CatalogStore PUT
  │           │           │          │          └─ BROWSER_CATALOG 재생성
  │           │           │          │
  │           │           │          ├─ DKG VersionEvent
  │           │           │          └─ DkgSqliteStore.saveGraph
  │           │           │
  │           │           ├─ addEntryToCatalog (spec-core)
  │           │           └─ expandCapacity (spec-core)
  │           │
  │           ├─ CatalogRegistry.register
  │           └─ CatalogStore.register
  │
  ├─ demo-catalog.ts (DEMO_CATALOG)
  └─ qa-sdk init (custom catalog)
```

핵심 원칙:

1. **단일 변이 경로**: 카탈로그 변이는 `catalog-mutator.ts`만 통과
2. **변이 결과의 다중 영속화**: 하나의 mutation이 (a) CatalogRegistry in-memory, (b) CatalogStore runtime DB, (c) TypeScript 파일, (d) DKG graph 네 곳에 반영
3. **TypeScript 파일은 파생물**: 런타임 Catalog 객체가 SSOT. TS 파일은 코드 리뷰 + 빌드 재현성을 위한 파생 스냅샷
4. **Append-only 불변조건**: position 불변, capacity 단조 증가

---

## 3. Phase 1: Catalog Writer (TypeScript 파일 재생성)

### 3.1 목표

`Catalog` 객체 → `.ts` 파일을 결정적으로 생성하는 순수 함수.

### 3.2 설계

**새 모듈**: `packages/spec-core/src/propagation/catalog-writer.ts`

```typescript
serializeCatalogToTs(catalog: Catalog, options?: WriterOptions): string
```

- 입력: `Catalog` 객체 (변이 후)
- 출력: TypeScript 소스 문자열

### 3.3 demo-catalog 특수 처리

demo-catalog를 2파트로 분리 (권장):
- `demo-catalog-data.ts` — 순수 데이터 (자동 생성 가능)
- `demo-catalog.ts` — import + `_axes` + MEANING → refEntries 파생 + re-export

### 3.4 CLI 연동

`dkgAddEntry()` 수정:
1. `executeEntryAdd()` 반환의 `mutation.catalog`를 CatalogRegistry에 re-register
2. `--apply` 시 `writeCatalogFile()` 호출하여 TS 파일 갱신

### 3.5 검증

- 라운드트립: `DEMO_CATALOG` → `serializeCatalogToTs()` → eval → deep equal
- 변이 후 라운드트립: `addEntryToCatalog()` → 직렬화 → eval → 새 entry 존재 확인

---

## 4. Phase 2: Runtime Catalog Mutation (CatalogRegistry mutation 지원)

### 4.1 CatalogRegistry 확장

`packages/core/src/catalog/catalog-registry.ts` 새 메서드:

```typescript
mutate(id: string, mutation: (catalog: Catalog) => Catalog): Catalog
getVersion(id: string): number  // 변이 횟수 추적 (낙관적 동시성)
```

### 4.2 CatalogStoreSyncPort

`packages/spec-core/src/propagation/catalog-store-port.ts` (새 파일):

```typescript
export interface CatalogStoreSyncPort {
  update(id: string, name: string, data: string): Promise<void>;
  get(id: string): Promise<{ data: string } | null>;
}
```

spec-core가 registry-service에 직접 의존하지 않도록 포트 인터페이스 정의.

### 4.3 entry-add-executor 통합

`EntryAddOptions`에 새 필드 추가:

```typescript
readonly catalogRegistry?: MutableCatalogProvider;
readonly catalogStore?: CatalogStoreSyncPort;
```

---

## 5. Phase 3: Bi-directional Sync

### 5.1 동기화 방향

```
TS 파일 ←── (Phase 1 writer) ←── Catalog 객체
                                     ↑
CatalogStore ←── (Phase 2 sync) ←───┤
                                     ↑
DKG graph ←── (기존 entry-add) ←────┘
```

변이는 항상 Catalog 객체에서 시작. 세 저장소로 팬아웃.

### 5.2 Drift 감지

새 convergence metric: `catalog-store-drift`
- DKG의 AxisNode.currentVersions vs CatalogStore JSON의 axis.versions 키 비교
- 차이 발견 시 `OBS-METRIC-catalog-drift` observation 자동 생성

### 5.3 BROWSER_CATALOG 자동 재생성

`dkg add-entry --apply` 이후:
1. `writeCatalogFile()` — TS 파일 갱신
2. `flattenForBrowser()` 호출
3. `demo-catalog-browser.ts`에 기록

---

## 6. Phase 4: Custom Catalog Workflow

### 6.1 커스텀 카탈로그 변이 워크플로우

```
qa-sdk init --name my-service
  → my-service.catalog.ts + qa-sdk.config.ts 생성

qa-sdk dkg add-entry category "analytics" --apply
  → catalog-loader로 my-service.catalog.ts 로드
  → addEntryToCatalog 변이
  → writeCatalogFile → my-service.catalog.ts 갱신
```

### 6.2 loadCatalog 반환 타입 확장

```typescript
interface LoadCatalogResult {
  catalog: LoadedCatalog;
  source: { kind: "file" | "demo"; path?: string };
}
```

`source.path`를 `writeCatalogFile()`에 전달.

---

## 7. 구현 순서

```
Phase 1: catalog-writer.ts (순수 함수) → catalog-file-writer.ts → CLI 수정
Phase 2: CatalogRegistry.mutate() → catalog-store-port.ts → executor 확장
Phase 3: drift metric → dkg pull-catalog → --sync-registry → BROWSER_CATALOG
Phase 4: loadCatalog 확장 → 커스텀 카탈로그 변이 → dkg publish --catalog
```

---

## 8. 검증 기준

| # | 검증 항목 | 기준 |
|---|----------|------|
| V1 | TS 라운드트립 | `DEMO_CATALOG` → serialize → eval → deep equal |
| V2 | 변이 반영 | `dkg add-entry --apply` → TS 파일에 새 entry 존재 |
| V3 | CatalogRegistry 정합 | 변이 후 `getCatalog()`에 새 entry 포함 |
| V4 | CatalogStore 정합 | 변이 후 `GET /catalogs/demo`에 새 entry 포함 |
| V5 | Drift 감지 | TS 수동 수정 → converge에서 drift 검출 |
| V6 | 멱등성 | 같은 entry 두 번 add → `already-recorded` |
| V7 | 커스텀 카탈로그 | `init` → `add-entry` → TS 파일 갱신 |

---

## 9. 리스크

| # | 리스크 | 심각도 | 완화 |
|---|--------|--------|------|
| R1 | demo-catalog.ts 재생성 시 `_axes`/MEANING 패턴 손실 | 높음 | 2파트 분리 (데이터 vs 파생 로직) |
| R2 | CLI와 registry-service 동시 변이 충돌 | 중간 | CatalogRegistry version 기반 낙관적 잠금 |
| R3 | refEntries 재계산 누락 | 중간 | catalog-mutator가 이미 경고 생성. Phase 2에서 자동 파생 연동 |
| R4 | capacity 확장 stride-break 연쇄 재인코딩 | 높음 | expandCapacity에 경고 존재. migration plan 자동 생성 |
