# SQL 어댑터 보강

> Memory-only Store 인터페이스에 SQL 어댑터를 추가하여 프로덕션 영속성을 확보한다.

## 흐름 심볼

`[S4]` — Core DB 계층 보강.

## 현재 상태

| Store 인터페이스 | Memory | SQL | 영향 |
|---|---|---|---|
| VersionLifecycleStore | ✅ | ❌ | gate-service 프로덕션 전제 |
| MigrationStore | ✅ | ❌ | query-service 버전 횡단 전제 |
| PrefixRouter | ✅ | ❌ | decode-service 멀티 prefix |
| EntryMetadataStore | ✅ | ❌ | 직접 영향 낮음 |

## 선행 조건

없음. 기존 SQL 어댑터 패턴 (`SqlAddressStateStore` 등) 참조.

## spec.todo 매핑

H-1, H-2, H-3

## 작업 항목

| # | 작업 | 파일 | 우선순위 |
|---|---|---|---|
| H-1 | VersionLifecycleStore SQL | `index-meta/src/adapters/sql-version-lifecycle-store.ts` | 높 |
| H-2 | MigrationStore SQL | `index-meta/src/adapters/sql-migration-store.ts` | 중 |
| H-3 | PrefixRouter SQL | `index-meta/src/adapters/sql-prefix-router.ts` | 중 |

## 각 어댑터 구현 패턴

기존 `SqlAddressStateStore` 참조:

1. Drizzle 테이블 스키마 정의
2. Store 인터페이스 구현 (CRUD 위임)
3. 단위 테스트 (InMemory ↔ SQL 동작 동등성)
4. `index-meta/src/index.ts`에 export 추가

## 산출물

- SQL 어댑터 3건 + 테스트
- gate-service / query-service 프로덕션 배포 blocker 해소
