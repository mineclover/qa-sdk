# permission-engine

`permission-engine`는 `weighted-index` 위의 bitmask 권한 엔진이다. 패키지 스펙 인덱스가 이미 중앙에 있다.

## 먼저 볼 문서

- [indexing/permission-engine/README.md](../../docs/specs/indexing/permission-engine/README.md) — 패키지 스펙 인덱스
- 위 인덱스에서 `core`, `codec`, `resource`, `migration` 하위 문서로 이어진다.

## 패키지 역할

- 권한을 compact address와 bitmask로 압축해 O(1) grant/check를 제공한다.
- ternary 상속, scope 라우팅, 외부 identity contract를 함께 제공한다.
- auth/gateway/service 계층이 이 패키지를 권한 커널로 소비한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/permission-set.ts`, `src/ternary-mask.ts`, `src/scoped-engine.ts` — 코어
- `src/permission-codec.ts` — codec
- `src/resource.ts`, `src/service-ref.ts`, `src/permission-code.ts` — 외부 contract
- `src/migration.ts` — 버전 적응

## 실행

```bash
pnpm --filter permission-engine build
pnpm --filter permission-engine test
```
