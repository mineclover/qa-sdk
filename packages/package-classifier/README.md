# package-classifier

`package-classifier`는 `packages/*` surface-managed 패키지를 스캔해 `tier/runtime/scope`로 분류하는 유틸리티다. CLI와 리뷰 도구는 이 패키지를 분류 SSOT로 소비하고, 별도 classifier 사본을 유지하지 않는다.

## 먼저 볼 문서

- [package-classifier.spec.md](../../docs/specs/system/package-classifier.spec.md) — 패키지 계약
- [system-overview.md](../../docs/system-overview.md) — `git-utils → package-classifier` 패키지 구조 맥락
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 패키지 계층과 의존 체계
- [package-implementation-review.md](../../docs/package-implementation-review.md) — 현재 분류 surface를 실제 문서 보강 작업에 어떻게 쓰는지

## 패키지 역할

- `packages/*`를 순회하며 내부 패키지를 스캔한다.
- 각 패키지의 이름/범위/의존을 바탕으로 `tier`, `runtime`, `scope`를 추정한다.
- CLI나 리뷰 도구가 패키지군을 묶어 읽을 수 있는 최소 메타데이터를 제공한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/pkg-classifier.ts` — scan + heuristic 분류

## 실행

```bash
pnpm --filter package-classifier build
pnpm --filter package-classifier typecheck
```

현재 분류 규칙은 heuristic이다. 규칙을 바꿀 때는 저장소 패키지 구조 문서와 실제 소비처의 기대값을 함께 맞춰야 한다.
