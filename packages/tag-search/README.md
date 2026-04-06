# tag-search

`tag-search`는 좌표계 외부의 태그 기반 역색인 라이브러리였지만, 현재는 deprecated다.

## 먼저 볼 문서

- [tag-search.md](../../docs/specs/tag-search/tag-search.md) — deprecation 안내
- [tag-search.spec.md](../../docs/specs/indexing-core-system/tag-search.spec.md) — 기존 공개 계약
- [tag-management.spec.md](../../docs/specs/storage-system/tag-management.spec.md) — 현재 SSOT

## 패키지 역할

- 역사적으로는 다중 태그 부착과 역색인 검색을 제공했다.
- 현재 운영 SSOT는 `tag-management.spec.md`와 definition-service SearchModule로 이동했다.
- 이 패키지는 호환/탐색 용도로만 읽어야 한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/port.ts`, `src/types.ts` — 포트/타입
- `src/memory-store.ts` — 인메모리 구현

## 실행

```bash
pnpm --filter tag-search build
pnpm --filter tag-search test
```
