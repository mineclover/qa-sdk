---
def:
  id: catalog-purity-bridge
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, architecture, convention]
  links:
    - target: definition-catalog-spec
      type: constrains
    - target: definition-service
      type: constrains
---

# Catalog Purity & Service Bridge — 패키지 경계 규율

## 목적 ^purpose

`definition-catalog` 패키지는 **DB 의존 없는 순수 라이브러리** 로 유지하고, DB 접근이 필요한 모든 로직은 `definition-service` 의 **bridge 계층** 이 담당한다. 본 규칙은 Phase C-0/C-1 (aspect-schema-hierarchy RFC) 에서 확립된 "SSoT 는 코드, DB 는 파생 복제본" 패턴을 성문화하여, catalog 를 다른 런타임 (CLI, registry, DKG, test harness) 에서 재사용 가능하게 유지한다.

---

## 1. 규칙

### 1.1 `definition-catalog` — 순수성 강제

#### 금지 의존

`packages/definition-catalog/` 는 다음을 **import 하지 않는다**:

- `better-sqlite3` / `node:sqlite`
- `drizzle-orm` / `drizzle-orm/better-sqlite3` / `drizzle-orm/node-sqlite`
- `pg`, `mysql2`, `@clickhouse/client`, `ioredis` — 모든 DB 드라이버
- `fetch` / `node:http` 기반 네트워크 클라이언트 (HTTP outbound 금지)
- 파일시스템 `fs` 는 build 시점 읽기만 허용 (runtime 의존 금지)

#### 허용 의존

- 순수 타입/상수 패키지 (`zod`, `@qa-sdk/core` 타입만, `weighted-index` 타입만)
- 자체 정의한 interface (`VersionedAxis`, `MemoryDefinitionRegistry`)

#### 공개 표면 원칙

catalog 의 모든 export 는 **pure function** 또는 **pure data structure**:

- `DEF_ASPECT`, `DEF_SCOPE`, `DEF_LEVEL`, `DEF_LIFECYCLE` — 상수 데이터
- `ASPECT_PARENTS` — runtime map
- `deriveAspectParent`, `getAspectChildren`, `getAspectFamily`, `deriveDomainRoot` — pure function
- `validateGraph` — in-memory registry 입력 → issue 배열 출력

### 1.2 `definition-service` — Bridge 패턴 강제

DB 접근이 필요한 로직은 `packages/definition-service/src/core/` 또는 `src/sync/` 에 bridge 함수로 배치:

```
packages/definition-service/src/core/
  aspect-registry.ts   ← 대표 bridge 예시
  ...
```

Bridge 구조 (`aspect-registry.ts` 참조):

```ts
export function createAspectRegistry(db?: DefinitionServiceDatabase): AspectRegistry {
  return {
    getAspectParent(childId) {
      if (!db) return deriveAspectParent(childId);  // ① fallback: pure catalog helper
      try {
        const row = db.select().from(aspectParents).where(...).get();
        if (row) return row.parentId;                // ② prefer: DB 데이터
      } catch (err) {
        logger.warn({ err }, "...");                  // ③ fail-open: 예외 시 fallback
      }
      return deriveAspectParent(childId);
    },
  };
}
```

Bridge 패턴 3원칙:

1. **DB-first** — DB 연결이 있으면 우선 사용
2. **Runtime fallback** — DB 미연결 / 빈 테이블 / 예외 시 catalog pure helper 로 복귀
3. **Fail-open** — 예외는 warning 로그만, 차단하지 않음

### 1.3 SSoT 이중화 금지

동일 정보가 catalog runtime map 과 DB 양쪽에 있을 때 **catalog 가 SSoT**, DB 는 파생 복제본:

- `ASPECT_PARENTS` map (catalog) = SSoT
- `aspect_parents` 테이블 (service) = 파생 복제 — `def sync` 시 map 기준으로 upsert
- Drift 발생 시 map 기준으로 치유 (DB-only orphan 은 warning 만, 자동 삭제 금지)

### 1.4 CLI 호출 경로 선택

CLI 는 다음 순서로 경로 선택:

1. **1순위 — catalog pure helper** (DB 없이 동작 가능 시)
   - 예: `def list --aspect X --include-children` → `getAspectFamily` 직접 호출
2. **2순위 — service bridge** (DB rolldown 필요 시)
   - 예: `def audit --rollup-aspect` → DB-first + runtime fallback
3. **3순위 — service HTTP API** (원격 서비스 참조 필요 시)
   - 예: `def list --server <url>` → fetch 경로

CLI 는 서비스 의존이 **선택적** 이어야 하며, catalog 만으로 최대한 동작하도록 설계.

### 1.5 Migration & Populate 책임 분리

| 책임 | 소유 패키지 | 위치 |
|---|---|---|
| 스키마 정의 (Drizzle `sqliteTable`) | `@qa-sdk/definition-service` | `src/db/schema.ts` |
| SQL migration 파일 | `@qa-sdk/definition-service` | `drizzle/<timestamp>_*/migration.sql` |
| CLI 로컬 DB 미러 (resetTables + populate) | `definition-data-source` | `src/sync-local-db.ts` |
| 포퓰레이트 source 데이터 | `definition-catalog` | `ASPECT_PARENTS`, `DEFINITION_TAXONOMY` 등 |

`definition-data-source` 는 catalog → CLI local SQLite 의 단방향 동기화를 담당하는 얇은 계층. catalog 불변성 유지 + CLI 독립 실행 보장.

### 1.6 Cross-package import 방향

```
definition-catalog  (의존 대상 없음 — 순수)
        ↑
        │ (pure API 소비)
        │
definition-service  (DB 소유, bridge 제공)
definition-data-source (CLI 동기화 계층)
        ↑
        │
@qa-sdk/cli (CLI 진입점)
```

역방향 import (`definition-catalog` → `definition-service`) 는 절대 금지.

---

## 2. 검증

### 2.1 catalog 의존 감사

```bash
# package.json 의존성 확인
cat packages/definition-catalog/package.json | jq '.dependencies,.devDependencies'
# better-sqlite3, drizzle-orm, pg 등이 나오면 위반
```

자동 감지 후보:

```bash
# import 스캔
grep -rn "from ['\"]better-sqlite3" packages/definition-catalog/src/
grep -rn "from ['\"]drizzle-orm" packages/definition-catalog/src/
grep -rn "from ['\"]@qa-sdk/definition-service" packages/definition-catalog/src/
# 결과가 비어있어야 통과
```

### 2.2 Bridge 테스트 3경로

bridge 구현체는 아래 3 경로가 **모두 테스트** 되어야 한다:

| 경로 | 테스트 조건 | 기대 동작 |
|---|---|---|
| DB 있음 + 데이터 존재 | populated sqlite + db 전달 | DB 데이터 반환 |
| DB 있음 + 빈 테이블 | empty sqlite + db 전달 | runtime map fallback |
| DB 미전달 | db=undefined | runtime map 직접 사용 |

참고 구현: `packages/definition-service/src/core/aspect-registry.test.ts` (11 cases, 3 경로 × family/children/parent method)

### 2.3 빌드 순서 검증

catalog 를 수정했을 때 아래 순서로 rebuild:

```bash
pnpm --filter definition-catalog build
pnpm --filter definition-data-source build
pnpm --filter @qa-sdk/definition-service build
pnpm --filter @qa-sdk/cli build
```

역순 의존이 있다면 순환 경고 발생 → 위반 신호.

### 2.4 CLI 독립 실행 smoke test

```bash
# DB 서비스 미실행 상태
pnpm exec qa-sdk def list --aspect func_def --include-children
# 결과가 local mode 로 정상 동작해야 함 (catalog pure helper 만 사용)
```

---

## 3. 예외

| 예외 | 정당화 |
|---|---|
| catalog 가 `zod` 에 런타임 의존 | pure validation 라이브러리 — DB/네트워크 없음 |
| catalog 가 build 시점 `fs` 읽기 | codegen / snapshot 만 — runtime 아님 |
| `definition-data-source` 의 CLI 로컬 SQLite 쓰기 | CLI 전용 파생 계층, catalog 본체 아님 |
| service bridge 에서 `logger` 사용 | 운영 진단 필수. 예외 삼킴 방지 |

**예외 없음**: catalog 에서 `fetch`, `pg`, `better-sqlite3`, `drizzle-orm` 직접 import.

---

## 4. 근거

- [aspect-schema-hierarchy RFC](../../proposals/aspect-schema-hierarchy/README.md) §"핵심 주장" 3. "가역성 유지"
- [domain-hierarchy/reviews/2026-04-21-phase-c-0-1-exec.md](../../proposals/domain-hierarchy/reviews/2026-04-21-phase-c-0-1-exec.md) §"C-1 bridge 구조 — 설계 원칙" — catalog 패키지 순수성 유지의 실행 증거
- [domain-hierarchy/reviews/2026-04-21-phase-c-2-exec.md](../../proposals/domain-hierarchy/reviews/2026-04-21-phase-c-2-exec.md) §"RFC 트릴로지 완결" — C-2 에서도 순수성 재확인
- [aspect-evolution-index.md](../../proposals/aspect-evolution-index.md) — 3-RFC 통합 서사
- `packages/definition-catalog/src/vocabulary.ts` — pure helper 구현 SSoT
- `packages/definition-service/src/core/aspect-registry.ts` — bridge 대표 구현
- `packages/definition-data-source/src/sync-local-db.ts` — CLI 로컬 DB 미러 구현
- CLAUDE.md §"설계 원칙" — "spec-core 는 라이브러리 — ingest-server/registry-service 에 정적 의존 없음" 기존 원칙의 확장 적용
