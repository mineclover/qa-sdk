---
status: review
type: plan
owner: auth-model-implementation-backlog
needs-input: true
---

# Plan 07a — D1 호환성 결정 (디자인 문서)

> **For human reviewers:** 본 문서는 코드 변경이 없는 **결정 문서**다. 07b/07c/07d 실행 전에 사용자 확정이 필요하다 (`needs-input: true`). 추천 옵션 + 근거를 명시했고, 최종 결정은 `## 결정 기록` 섹션에 사용자 또는 lead가 서명한다.

**Goal:** ingest-server는 D1(Cloudflare Workers의 SQLite-호환) + 자체 SQLite 둘 다 운영 중이다. Plan 07b/07c가 PG 어댑터를 추가하면 dialect 분기가 2 → 3으로 늘어난다. D1을 어떻게 다룰지 결정해 후속 plan의 디렉토리 구조·factory 분기·테스트 매트릭스를 확정한다.

**Architecture:** 결정 문서. 코드 변경 0. 결정 결과를 07b/c/d의 File Structure 헤더에 인용한다.

**Tech Stack:** 결정 사항 — 변경 없음.

---

## 1. 배경

### 1.1 현재 구조

- **D1 stores** (`packages/ingest-server/src/stores/d1-*.ts`): D1 바인딩 + Node.js의 `node-sqlite` 양쪽에서 사용. drizzle `node-sqlite` adapter로 통합.
- **D1 type alias** (`d1-db-type.ts`):
  ```ts
  import type { DatabaseSync } from "node:sqlite";
  import { drizzle } from "drizzle-orm/node-sqlite";
  export type D1Db = ReturnType<typeof createD1Drizzle>;
  ```
  → 즉, D1Db는 사실상 `node-sqlite` drizzle 인스턴스 타입. CF Workers의 D1 binding과 Node.js DatabaseSync가 동일 SQL dialect라 한 어댑터로 양쪽 커버.
- **store-factory.ts**: `STORE_DRIVER=d1|pg|memory|clickhouse`. 현재 `pg`는 `@qa-sdk/store`의 Drizzle*Store 사용 (D1과 코드 분리).
- **§4 결과** (`docs/proposals/ingest-coordinate-storage-audit/README.md`): D1 schema는 P1·P2·P3 완료 (`(prefix_id, version, address)` PK). PG schema(`packages/store/src/db/schema.ts`)는 아직 P1~P3 미적용 → `coord-storage-exempt` 주석 보유.

### 1.2 갈등 지점

- **dialect 중복 회피**: D1과 SQLite가 SQL 호환되므로 어댑터를 한 번만 작성하고 싶다.
- **권한 모델 정합성**: PG는 RLS·schema·CHECK constraint 풀 지원. SQLite는 부분만. D1은 Workers 환경 제약(파일시스템 X, 외부 fetch 일부 제약).
- **Workers 호환성**: D1은 `node:sqlite` import를 못 한다 (Workers runtime은 Node API 부재). 그러나 현재 `d1-db-type.ts`는 type-only import이며, runtime에서는 D1 bindings의 prepared statement API를 drizzle d1 어댑터로 wrap해야 한다.

### 1.3 디자인 문서 §3 vs ingest-server

- 디자인 문서 §3: PG에 5개 schema (`auth`, `audit`, `ingest`, `decision`, `definition`)
- ingest-server는 `ingest` schema 입주 — `key_observations`, `event_records`, `key_observation_prefixes`
- D1은 schema 개념 없음 → 평면 테이블 그대로

---

## 2. 옵션 분석

### 옵션 A — D1을 SQLite 어댑터의 special case로 (capability flag)

**구조:**
- 단일 `sqlite/adapter.ts` (현 `d1-*.ts`를 generalize)
- D1 capability는 `D1Db` type alias + `runtime: "workers" | "node"` flag로 분기
- Workers 환경에서는 `drizzle-orm/d1` import (D1 bindings), Node 환경에서는 `drizzle-orm/node-sqlite`

**장점:**
- 어댑터 코드 1개 — 유지보수 비용 최소
- D1과 Node-SQLite가 동일 SQL을 쓰므로 비즈니스 로직 100% 공유
- 향후 Bun-SQLite, libsql 추가 시 capability flag 1줄 추가로 흡수
- 디자인 문서의 "비즈니스 로직 dialect-agnostic" 원칙과 정합

**단점:**
- runtime 분기가 type 시스템에 노출됨 (factory에서 둘 중 하나의 drizzle adapter를 dynamic import)
- `D1Db` 타입이 두 driver의 union이 되어 type narrowing이 어색해질 가능성
- Workers-only 빌드 시에도 node:sqlite type import가 type-only로 남음 (런타임 없음, 무해)

**구현 영향:**
- `d1-*.ts` → `sqlite/*.ts`로 rename + 디렉토리 이동
- `D1KeyObservationStore` → `SqliteKeyObservationStore` (backward-compat alias 유지)
- factory 분기: `dialect: "sqlite" | "pg"`, `sqliteRuntime: "node" | "workers"`

### 옵션 B — D1 전용 어댑터 분리

**구조:**
- `sqlite/adapter.ts` (Node.js SQLite 전용)
- `d1/adapter.ts` (Workers D1 전용, drizzle-orm/d1 사용)
- `pg/adapter.ts` (PG 전용)
- factory: `dialect: "sqlite" | "d1" | "pg"`

**장점:**
- 각 어댑터의 의존이 깔끔히 분리 (Workers 빌드는 D1만, Node는 SQLite/PG만 import)
- D1-specific edge case (예: prepared statement batching, transaction 제약)를 격리 가능
- Workers에서 node:sqlite type import가 0 (Workers 빌더가 외부 의존 0)

**단점:**
- SQL 코드 중복 (D1과 Node-SQLite가 사실상 같은 SQL을 작성) — 약 80% 코드가 두 어댑터에 동일
- 비즈니스 로직 변경 시 두 곳 동기 필요 (실수 위험)
- 디자인 문서의 "한 어댑터가 dialect 흡수" 원칙과 부분 충돌
- 테스트 매트릭스 3 dialect × 모든 store ≈ 30+ contract test 조합

**구현 영향:**
- 디렉토리 3개 (`sqlite/`, `d1/`, `pg/`)
- factory 3-way 분기
- shared 헬퍼 모듈 (`shared/sql-builders.ts`)을 강제로 만들어 코드 중복 완화 — 결국 옵션 A와 유사한 구조로 수렴할 가능성

### 옵션 C — D1 deprecate, 모두 PG로 (Cloudflare Workers 환경 포기)

**구조:**
- `pg/adapter.ts`만 (or `sqlite/adapter.ts` for local dev)
- D1 stores 전체 제거
- ingest-server는 Node.js only (Workers 빌드 deprecated)

**장점:**
- 가장 단순. 코드 1세트
- RLS·schema·CHECK 풀 활용 — 권한 모델 100% 정합
- 디자인 문서 §3의 5-schema 구조를 정직하게 구현

**단점:**
- **Workers 환경 포기**: ingest-server가 CF Workers에 배포되지 않음 → edge ingest 시나리오 상실
- D1 사용자에게 마이그레이션 강제 (실 운영 사용처 있는지 확인 필요)
- `INGEST_D1_SCHEMA_DDL`, `D1KeyObservationStore` 등 자산 폐기
- §4의 P1~P3 D1 한정 작업이 무효화됨

**구현 영향:**
- D1 stores 9개 파일 제거 (`d1-*.ts`)
- store-factory에서 `d1` driver 케이스 제거
- ingest-server가 Workers에 배포되는지 audit 필요

---

## 3. 추천 옵션 + 근거

### 추천: **옵션 A** (D1을 SQLite 어댑터의 capability flag로)

**근거 1 — SQL 호환성 사실:**
D1과 better-sqlite3/node-sqlite는 SQLite 3.x SQL dialect를 공유한다. 차이는 driver API뿐(`prepare()` vs `select()`). drizzle-orm이 두 driver를 동일 query builder로 추상화하므로, 비즈니스 로직 코드는 100% 공유 가능. 옵션 B의 코드 중복은 정당화되지 않는다.

**근거 2 — 디자인 문서 §1과 정합:**
> "비즈니스 로직(순수 state machine, 도메인 규칙)은 dialect-agnostic, schema 정의와 SQL adapter만 dialect별 분리."

옵션 A는 이 원칙을 D1까지 확장한다. 옵션 B는 dialect 가짓수를 늘려 원칙을 약화시킨다.

**근거 3 — Workers 호환성 보존:**
옵션 C는 Workers 배포 가능성을 단절한다. 본 backlog에 Workers 배포 사례를 명시적으로 폐기한다는 결정이 없으므로, 옵션 C는 회복 불가능한 손실. 옵션 A는 capability flag로 양쪽 보존.

**근거 4 — §4 자산 보존:**
§4의 P1~P3 작업이 D1 schema에 적용되어 있고 12+ versioned 테스트가 통과한다. 옵션 A는 이 자산을 그대로 흡수 (rename + capability flag만). 옵션 C는 폐기.

**근거 5 — 권한 모델 정합성:**
권한 모델(RLS·schema)은 PG에서만 풀 동작한다. D1/SQLite는 본질적으로 single-tenant + application-level enforcement. 본 차이는 옵션과 무관 — 어떤 옵션을 택해도 PG 어댑터에서만 RLS 적용. 옵션 A로도 PG schema 격리(`pgSchema("ingest")`)는 정상 동작.

### 비추천 사유 요약

| 옵션 | 비추천 사유 |
|---|---|
| B | SQL 코드 중복 80% — 정당화 부족. shared 헬퍼로 우회 시 결국 A로 수렴. |
| C | Workers 배포 가능성 폐기는 별도 회복 불가능 결정. 본 backlog 범위 외. |

---

## 4. 옵션 A 적용 시 후속 plan에 미치는 영향

### 4.1 디렉토리 구조 (07b/c/d 공통)

```
packages/ingest-server/src/stores/
├── sqlite/                      # 옵션 A — D1 + Node-SQLite 통합
│   ├── adapter-runtime.ts       # capability flag (workers | node)
│   ├── key-observation.adapter.ts   # 기존 d1-key-observation-store.ts
│   ├── record.adapter.ts            # 기존 d1-record-store.ts
│   ├── ... (rest)
│   └── schema.ts                # 기존 db/schema.ts (sqliteTable)
├── pg/                          # Plan 07b/07c 신규
│   ├── schema.ts                # pgSchema("ingest").table(...)
│   ├── key-observation.adapter.ts
│   ├── record.adapter.ts
│   └── adapter.test.ts
├── store-factory.ts             # dialect 분기 (sqlite | pg)
└── d1-*.ts                      # backward-compat re-export shim (deprecated)
```

### 4.2 factory 시그니처

```ts
export type Dialect = "sqlite" | "pg";
export type SqliteRuntime = "node" | "workers";

export interface CreateStoresOpts {
  dialect: Dialect;
  // sqlite 전용
  sqliteRuntime?: SqliteRuntime;     // 기본 "node"
  sqliteDriver?: SqlDriver;           // node 시
  d1Binding?: D1Database;             // workers 시
  // pg 전용
  pgUrl?: string;
  pgSchema?: string;                  // 기본 "ingest"
}
```

기존 `STORE_DRIVER=d1` env는 `STORE_DRIVER=sqlite` + `SQLITE_RUNTIME=workers|node`로 분해. backward-compat: `d1` 입력 시 `sqlite` + `workers` 자동 추론.

### 4.3 테스트 매트릭스

- `__tests__/cross-adapter/cross-adapter.sqlite.test.ts` — 기존 `d1.test.ts` rename
- `__tests__/cross-adapter/cross-adapter.pg.test.ts` — 기존 유지 (07b/c가 채움)
- D1 바인딩 specific 회귀는 별도 e2e (Workers 환경 필요 — defer)

### 4.4 backward-compat 정책

- `D1KeyObservationStore`, `D1RecordStore` 등 클래스명은 `Sqlite*Store` rename + 기존명 alias 유지 (07b/c/d 작업)
- `STORE_DRIVER=d1` env는 deprecation warning + sqlite로 자동 매핑 (07d 작업)
- `d1-*.ts` 파일은 `sqlite/` re-export shim으로 1 release cycle 동안 유지

---

## 5. 결정 기록

> 사용자 또는 lead가 본 섹션에 옵션 + 일자 + 서명 추가 후 07b/c/d 실행.

| 항목 | 값 |
|---|---|
| 결정자 | (TBD — 사용자 입력 필요) |
| 결정 일자 | (TBD) |
| 선택 옵션 | (A / B / C 중 선택) |
| 선택 근거 요약 | (TBD) |
| 옵션 변경 시 트리거 | Workers 배포 폐기 결정, libsql/Bun-SQLite 도입, D1 SQL dialect 분기 발생 |

본 plan author 추천: **옵션 A**.

---

## Task 0: 사용자 결정 수령

- [ ] **Step 1: 본 문서 검토 + 옵션 확정**

리뷰 포인트:
- §3의 추천(옵션 A) 근거가 backlog 맥락에 맞는가
- §4.1 디렉토리 구조가 ingest-server 현 구조와 충돌하지 않는가
- §4.2 factory 시그니처가 service-profile.json과 호환되는가
- Workers 배포 사례를 폐기할 의향 있으면 옵션 C 재고

- [ ] **Step 2: 결정 기록 (§5) 채우기**

```markdown
| 결정자 | <이름> |
| 결정 일자 | 2026-04-XX |
| 선택 옵션 | A |
| 선택 근거 요약 | <2~3 문장> |
```

- [ ] **Step 3: 07b/c/d 디렉토리 구조 확정 통지**

결정이 옵션 A 외라면 07b/c/d File Structure 표를 갱신해야 한다. 옵션 A면 이미 07b/c/d가 정합.

---

## Task 1: 후속 plan 헤더 갱신 (옵션 확정 후)

- [ ] **Step 1: 07b 헤더에 결정 인용 추가**

`07b-key-observations-pg-adapter.md` 상단의 `Architecture:` 섹션에 다음 추가:

```markdown
**선행 결정 (07a)**: 옵션 <X> 채택 (일자 <YYYY-MM-DD>). 07b는 PG 어댑터만 추가 — D1/SQLite는 옵션 <X> 구조 그대로.
```

- [ ] **Step 2: 07c, 07d에 동일 인용**

- [ ] **Step 3: 본 문서 lifecycle을 review → approved로 전이**

frontmatter `status: review` → `status: approved`. `needs-input: true` → 제거.

---

## Self-Review

- [ ] 옵션 A/B/C 각각 장·단·구현영향 명시
- [ ] 추천 옵션의 근거 5가지 (SQL 호환·디자인 정합·Workers 보존·§4 자산·권한 정합)
- [ ] 옵션 A 시 후속 plan 영향(디렉토리·factory·테스트·backward-compat) 4 섹션
- [ ] §5 결정 기록 템플릿 — 사용자 입력 자리 명확
- [ ] 코드 변경 0 (결정 문서 본질 유지)

---

## Defer

| 작업 | 이유 |
|---|---|
| 옵션 A 실제 적용 | 07b/c/d에서 수행. 본 plan은 결정만. |
| Workers 배포 e2e | Workers 환경 셋업 필요 — 본 backlog 범위 외 |
| libsql / Bun-SQLite 추가 | capability flag 확장만으로 흡수 가능 — 트리거 발생 시 별도 plan |

---

## 의존·후속

- **선행 의존 없음** — 결정 문서이므로 다른 plan 완료 불요
- **참조 문서**: `docs/proposals/auth-model-implementation-backlog/pg-migration-design.md` §1, §3, §5
- **참조 문서**: `docs/proposals/ingest-coordinate-storage-audit/README.md` §4 이행 결과
- **차단 plan**: 07b, 07c, 07d — 본 plan §5 결정 기록 후 실행
- **연관 plan**: 04a/b/c/d (PG 인프라 부트스트랩) — 07b/c가 의존
