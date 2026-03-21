# Module Boundaries — spec-core 내부 의존 규칙

## Sub-path Exports

| Sub-path | 모듈 | 설명 |
|----------|------|------|
| `"."` | shared + schema + export-surface + spec + loader | Foundation (타입 + 로더) |
| `"./codegen"` | codegen/ | IR + 코드 생성기 |
| `"./analysis"` | dkg/ + dkg/skills/ + convergence/ | DKG 그래프 + 수렴 분석 |
| `"./propagation"` | propagation/ | Registry 발행/활성화 |
| `"./store"` | store/ | SQLite 영속화 |
| `"./viz"` | visualization/ | 레이어 맵 + 모니터 |

## 디렉토리 구조 (12 모듈)

```
src/
  shared/          ← 리프. 의존 없음. errors, result, graph-port.
  schema/          ← shared에만 의존. 타입 + validator + category-rules.
  export-surface/  ← shared에만 의존. ExportSurface registry.
  spec/            ← shared + schema에 의존. SpecDocument + PrefixSpec.
  loader/          ← spec + export-surface에 의존. catalog-bridge, spec-loader.
  codegen/         ← spec + loader에 의존. IR builder + generators.
  analysis/        ← barrel. dkg/ + convergence/ re-export.
  dkg/             ← shared + schema에 의존. 그래프 + 타입 + bootstrap.
  dkg/skills/      ← dkg + convergence에 의존. 분석 skill들.
  convergence/     ← dkg(타입만)에 의존. 수렴 분석 도구들.
  propagation/     ← dkg + spec에 의존. publish + lifecycle.
  store/           ← dkg에 의존. SQLite 영속화.
  visualization/   ← demo-snapshot + convergence.types에 의존.
```

## 의존 규칙

```
허용:
  shared ← 모든 모듈
  schema ← dkg, convergence, spec (GraphPort 인터페이스 경유)
  dkg.types ← convergence (타입 참조만)
  dkg ← dkg/skills, propagation, store
  convergence ← dkg/skills (분석 도구 사용)
  spec ← loader, codegen, propagation

금지:
  shared → 어디에도 의존하면 안 됨
  schema → dkg (역방향 — GraphPort로 해소됨)
  convergence → dkg/skills (역방향)
  convergence → propagation (역방향)
  store → convergence (직접 의존 금지, dkg 경유)
  codegen → dkg (코드 생성은 그래프 몰라도 됨)
```

## 양방향 의존 (허용됨, 단 규칙 있음)

```
dkg ↔ convergence:
  dkg → convergence: bootstrap에서 headroom/overlap 분석 호출
  convergence → dkg: GraphRegistry 타입, PrefixNode 타입 참조

  규칙: convergence는 dkg의 타입과 GraphRegistry만 import.
        dkg의 내부 로직(bootstrap, skills)은 import 금지.
        dkg/skills만 convergence의 함수를 직접 호출.

  → 같은 sub-path("./analysis")로 합쳐서 순환 문제 해소.
```

## schema → dkg 역방향 해소

`category-rules.ts`가 GraphRegistry와 PrefixNode에 의존하던 것을
`shared/graph-port.ts`의 `GraphPort` + `PrefixLike` 인터페이스로 대체.
GraphRegistry는 GraphPort를 구조적으로 만족하므로 호환.

## 파일별 역할

| 모듈 | 핵심 파일 | 역할 |
|---|---|---|
| shared | errors.ts, result.ts, graph-port.ts | 공유 에러 + Result 타입 + GraphPort |
| schema | schema.types.ts, category-rules.ts | 6종 카테고리 + 타입 규칙 |
| spec | prefix-spec.types.ts, spec.types.ts | PrefixSpec + SpecDocument 타입 |
| loader | catalog-bridge.ts | DEMO_CATALOG → PrefixSpec 변환 |
| codegen | ir-builder.ts → ts/js/proto/json | IR → 코드 생성 |
| dkg | dkg.types.ts, graph-registry.ts | 12종 노드 + 18종 엣지 + 그래프 |
| dkg/skills | 11개 skill | 분석/검증/수렴 체인 |
| convergence | 14개 파일 | 집계/비교/감지/최적화 |
| propagation | publish.ts, lifecycle.ts | spec → registry → activate |
| store | dkg-sqlite-store.ts | SQLite 영속화 |
| visualization | layer-map.ts, monitor-queries.ts | 레이어 맵 + 모니터 |
