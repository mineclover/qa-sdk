---
def:
  id: drizzle-orm-convention
  level: leaf
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [orm, database, cross-package]
  links:
    - target: doc-type-convention
      type: depends_on
---

# Drizzle ORM 컨벤션

## 목적 ^purpose

QA-SDK 모노레포 전체 Drizzle ORM/Kit 사용 규칙을 정의한다. 모든 SQLite 서비스에 적용되는 패키지 횡단 기술 제약.

---

## 버전

- `drizzle-orm` / `drizzle-kit` 모두 `1.0.0-beta.20` 고정

## 스키마 & 설정

- **스키마 파일**: 각 패키지 `src/db/schema.ts` (예외 없음)
- **설정 파일**: 각 패키지 루트 `drizzle.config.ts` (`dialect: "sqlite"`, `out: "./drizzle"`)

## 마이그레이션 폴더 경로

- `new URL("../drizzle", import.meta.url).pathname` 사용 (process.cwd 금지)
- **주의**: tsc가 `src/` → `dist/`로 컴파일하므로 `dist/xxx.js` 기준으로 `../drizzle`이 `패키지/drizzle`을 가리키는지 확인

## 생성 SQL 규칙

- drizzle `migrate()`가 `__drizzle_migrations` hash로 중복 실행을 방지하므로, `IF NOT EXISTS`는 정상 경로에서 불필요
- 생성된 SQL을 수동 수정하지 않는다

## PRAGMA

- 모든 SQLite 서비스에 WAL + `busy_timeout=3000`
- FK 있으면 `foreign_keys=ON`

## 드라이버 선택

| 환경 | 드라이버 |
|------|---------|
| NestJS 서비스 | `drizzle-orm/better-sqlite3` |
| 나머지 (CLI, 라이브러리) | `drizzle-orm/node-sqlite` |

- **node:sqlite 타입**: `getDatabaseSync()` + `DatabaseSyncInstance`를 `index-meta`에서 import. 자체 인터페이스 정의 금지

## 쿼리 빌더

- 신규 코드는 drizzle query builder 사용. raw SQL 금지 (기존 definition-service 예외)

## 에러 핸들링

- `migrate()` 호출은 try/catch + throw 필수. 에러 삼킴 금지 (index-meta SCHEMA_DDL 폴백 제외)

## D1 (Workers)

- 파일시스템 접근 불가하므로 런타임 `migrate()` 불가
- DDL 문자열은 `src/db/schema.ts`와 수동 동기화

## tsup 번들

- `drizzle/` 폴더는 `onSuccess` 훅으로 `dist`에 복사 (`publicDir` 아님)
