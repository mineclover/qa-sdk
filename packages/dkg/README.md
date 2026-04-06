# dkg

`dkg`는 Design Knowledge Graph 커널이다. 성장 나선, 노드/엣지, skill, SQLite 상태 저장소까지 묶는다.

## 먼저 볼 문서

- [dkg-system.md](../../docs/specs/dkg-system/dkg-system.md) — 전체 진입점
- [dkg-node-types.spec.md](../../docs/specs/dkg-system/dkg-node-types.spec.md) — 노드 타입
- [dkg-edge-types.spec.md](../../docs/specs/dkg-system/dkg-edge-types.spec.md) — 엣지 타입
- [dkg-skills-system.md](../../docs/specs/dkg-system/dkg-skills-system.md) — skill 계층
- [dkg-state-store.spec.md](../../docs/specs/dkg-system/dkg-state-store.spec.md) — SQLite 상태 저장소

## 패키지 역할

- DKG graph registry와 관련 query/bridge/skill 실행 표면을 제공한다.
- decision-flow, convergence, spec-transition, spec-schema와 연결된 설계 그래프를 유지한다.
- core graph와 store를 subpath export로 분리한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/graph-registry.ts`, `src/dkg.types.ts` — 그래프 코어
- `src/bootstrap.ts`, `src/catalog-derive.ts`, `src/service-topology.ts` — 도메인 조립
- `src/skills/*` — DKG skill 구현
- `src/store/*` — SQLite store

## 실행

```bash
pnpm --filter dkg build
pnpm --filter dkg test
```
