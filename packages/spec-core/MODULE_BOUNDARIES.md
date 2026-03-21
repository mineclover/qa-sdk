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
| dkg | dkg.types.ts, graph-registry.ts | 13종 노드 + 18종 엣지 + 그래프 |
| dkg/skills | 25개 skill | 분석/검증/수렴 체인 |
| convergence | 17개 파일 | 집계/비교/감지/최적화/metric |
| propagation | publish.ts, lifecycle.ts | spec → registry → activate |
| store | dkg-sqlite-store.ts | SQLite 영속화 |
| visualization | layer-map.ts, monitor-queries.ts | 레이어 맵 + 모니터 |

## 스펙 관리 vs 로깅 인프라 경계

```
스펙 관리 (있어야 하는 것)         로깅 인프라 (관측된 것)
─────────────────────────       ─────────────────────────
schema + category rules          usage aggregation
prefix spec + export surface     deployment skew measurement
constraint + invariant           entry coverage measurement
DSL bundle definition            temporal trend analysis
                │                        │
                └──── DKG (다리) ─────────┘
                      Observation ← 로깅에서 생성
                      Decision    ← 스펙에서 생성
                      prompts 엣지 = 관측이 결정을 촉발
```

## Convergence 계층 분류

| 계층 | 함수 | 특성 |
|------|------|------|
| 집계 | aggregateUsageData, aggregateByDsl/Category/Service | 원시 이벤트 → UsageData |
| 품질 | analyzeCollectionHealth | 데이터 품질 검증 |
| 측정 | analyzeDeploymentSkew, analyzeTemporalTrends, analyzeEntryCoverage | 런타임 상태 측정 |
| 비교 | compareAxes, comparePrefixes, scanAxisOverlaps, scanDecisionConflicts | 구조 정적 분석 |
| 추천 | analyzeSimplification, analyzeHeadroom, optimizeCapacities | Decision 생성 후보 |
| 기록 | recordSeparation, applySeparationRecord | DKG 노드/엣지 변경 |
| 필터 | filterUsageByCategory, groupUsageByCategory, summarizeByCategory | 슬라이싱 유틸 |

## 서비스 데이터 흐름

```
ingest-server
  └── AddressContextRecord[] → aggregateUsageData() → UsageData
       ├── store.saveUsageSnapshot(usage) → SQLite
       ├── analyzeDeploymentSkew()        → metric:skew
       └── analyzeCollectionHealth()      → metric:health

registry-service
  └── SchemaSnapshot → catalogToPrefixSpecs() → PrefixSpec[]
       └── propagation.publishSpec()      → VersionNotification

gate-service
  └── VersionEvent → DKG graph.addNode()  → version-event 노드
       └── analyzeImpact()                → cascade 분석

dkg self-check (자기참조 — 실체화 완료)
  └── pnpm build/test → AddressContextRecord[]
       ├── encodePrefixByValue → build_event/test_event 주소
       ├── aggregateUsageData → UsageData (entryUsage+addressUsage)
       ├── analyzeCollectionHealth → 건전성 검증
       ├── analyzeEntryCoverage  → 커버리지 측정
       ├── collectMetrics        → 전체 metric 수집
       ├── dsl-dev 불변조건 검증 → invariant violation 감지
       ├── auto-resolve         → 이전 observation 자동 해소
       └── store.saveUsageSnapshot → SQLite 영속화
```

## Observation Intent 분류

```
intent 판정 규칙:
  1. obs.intent 명시 → 그대로
  2. obs.resolution 있음 → 이미 해결, health 제외
  3. obs → prompts → active Decision → acknowledged, health 제외
  4. source=metric → action-needed
  5. source=manual/review + suggestion → action-needed
  6. source=manual/review + suggestion 없음 → monitoring

health metric은 action-needed만 issue로 집계.
overlap은 DEC-SEP Decision 수용 시 ok로 다운그레이드.
```

## Metric 체계

| Metric ID | 함수 | 자동 | 임계값 |
|-----------|------|------|--------|
| metric:headroom:\<axis\> | analyzeHeadroom | ✓ | headroom ≤ 0 → critical, 1 → warning |
| metric:skew:\<prefix\> | analyzeDeploymentSkew | ✓ | spread ≥ 3 → warning, ≥ 5 → critical |
| metric:coverage:\<prefix\> | analyzeEntryCoverage | ✓ | coverage ≤ 20% → critical, ≤ 50% → warning |
| metric:overlap:\<a\>:\<b\> | scanAxisOverlaps | ✓ | ratio ≥ 80% → warning, ≥ 95% → critical |
| metric:conflict:decisions | scanDecisionConflicts | ✓ | ≥ 1 → warning, ≥ 3 → critical |
| metric:health:\<domain\> | collectMetrics (inline) | ✓ | issues ≥ 1 → warning, ≥ 5 → critical |
