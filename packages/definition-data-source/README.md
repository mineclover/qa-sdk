# definition-data-source

`definition-data-source`는 local SQLite, remote service, raw scan을 하나의 `DefDataSource` 팩토리로 묶는다.

## 먼저 볼 문서

- [definition-catalog.spec.md](../../docs/specs/definition-catalog/definition-catalog.spec.md) — data source가 연결되는 전체 구조
- [definition-service-system.md](../../docs/specs/definition-service/definition-service-system.md) — remote source 경계
- [definition-runtime-guide.md](../../docs/specs/guides-system/definition-runtime-guide.md) — local/runtime 사용 흐름

## 패키지 역할

- 로컬 SQLite datasource와 definition-service HTTP datasource를 자동 감지해 제공한다.
- raw scan, review feedback source 같은 보조 source를 함께 묶는다.
- CLI와 운영 도구가 동일한 문서 질의 surface를 쓸 수 있게 한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/factory.ts` — datasource 팩토리
- `src/local-data-source.ts` — SQLite 기반 로컬 source
- `src/server-data-source.ts` — remote HTTP source
- `src/scan-data-source.ts`, `src/review-feedback-source.ts` — 보조 source
- `src/sync-local-db.ts` — 로컬 DB sync

## 실행

```bash
pnpm --filter definition-data-source build
pnpm --filter definition-data-source typecheck
```
