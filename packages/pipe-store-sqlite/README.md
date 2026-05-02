# pipe-store-sqlite

`pipe-store-sqlite`는 meta-semantic 계열 `PipeStore`와 `ManifestRegistry`의 SQLite 영속 구현이다.

## 먼저 볼 문서

- [pipe-store-sqlite.spec.md](../../docs/specs/meta-semantic/pipe-impl/model/pipe-store-sqlite.spec.md) — 공개 계약
- [pipe-store.spec.md](../../docs/specs/meta-semantic/pipe-impl/model/pipe-store.spec.md) — store 계층 전체
- [meta-semantic-v2-migration.spec.md](../../docs/specs/meta-semantic/migration/meta-semantic-v2-migration.spec.md) — ManifestRegistry 위치와 migration 맥락
- [drizzle-orm-convention.spec.md](../../docs/specs/system/drizzle-orm-convention.spec.md) — SQLite/Drizzle 제약

## 패키지 역할

- `PipeGraphStore`, `PipeSpecStore`, `ManifestRegistry`를 SQLite로 영속한다.
- CLI/workflow에서 장기 보관이 필요한 meta-semantic store 어댑터다.
- facet-code lineage 같은 부가 저장소도 함께 담는다.

## 코드 진입점

- `src/index.ts` — public export
- `src/store.ts` — PipeGraph/PipeSpec 저장소
- `src/manifest-store.ts` — ManifestRegistry
- `src/facet-code-store.ts` — facet code lineage 저장소
- `src/db/schema.ts`, `src/db/connection.ts` — DB 계층

## 실행

```bash
pnpm --filter pipe-store-sqlite build
pnpm --filter pipe-store-sqlite test
```
