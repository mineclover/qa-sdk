---
status: review
date: 2026-04-19
part_of: tier-redesign
role: review
reviewer: opus-4.7
reviewed_system: meta-semantic (data facets + pipe-impl + simulation)
compared_against: STC tier-redesign proposal
---

# Data Facet + Flow + Simulation 체계 리뷰

> 리뷰 대상: `docs/specs/meta-semantic/` 전체 체계 (9개 원자 개념 + pipe-impl 22+ leaf)
> 비교 대상: `docs/proposals/tier-redesign/` (STC: Component/Entry/FSM/System/Layout)
> 목적: STC 제안이 기존 meta-semantic 설계와 어떻게 관계하는지, 흡수/충돌/보완 구조를 파악

---

## 0. 리뷰 개요 — 요약

**두 체계는 다른 질문에 답한다.**

- **meta-semantic**: "코드의 의도와 데이터 흐름을 어떻게 추적 가능한 단위로 쪼갤 것인가" (수집 + 해석)
- **STC**: "문서를 중복 없이 좌표로 분류하고 소비 인터페이스를 분리해 어떻게 낭비 없이 조직할 것인가"

겹침은 깊다. STC의 tier 축은 meta-semantic이 이미 정립한 "Module/Data/Pipe 3축" (philosophy 원칙 4)과 "데이터 패싯의 5역할"과 구조적으로 **재분류 관계**에 있다. 그러나 meta-semantic은 "코드 → IR → 좌표 → 시뮬 → SDK 코드 생성"이라는 **실행 가능한 파이프라인**을 이미 구현했고, STC는 그 중 "문서 메타데이터 축"만 재정의한다. 따라서 충돌은 드물고, 대부분은 **STC가 meta-semantic의 표면을 어떻게 라벨링할 것인가**의 문제다.

가장 큰 긴장점: STC `fsm` tier와 meta-semantic `pipe-impl/transition-scope`가 "state/event/transition"이라는 동일 어휘를 쓰지만 **대상 추상화 계층이 다르다**. FSM은 문서 소비 인터페이스이고, PipeTransitionScope는 제어 흐름 내 원자 경계다. 두 체계가 병존하려면 용어 정리가 필요하다.

---

## 1. 데이터 패싯 개념

### 1.1 정의

`docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md` §"5가지 역할"에 따르면, **데이터 패싯은 데이터의 역할(role)을 분리하는 설계 규칙**이다. "데이터를 5개로 쪼개라"가 아니라 "하나의 데이터가 어떤 역할로 사용되고 있는지 식별하라."

5 역할 (line 41~48):

| 역할 | 정의 | 판별 질문 |
|------|------|----------|
| **생산** | 데이터가 입력되고 생성되는 시작점 | "새 데이터를 만드는가?" |
| **소비** | 특정 모듈 컨텍스트에서 데이터를 사용 (소멸 아님) | "기존 데이터를 읽거나 표시하는가?" |
| **정의** | 기능적 필요에 의한 스키마 선언 | "데이터의 형태를 선언하는가?" |
| **관리** | 정합성 보장, 트랜잭션 보장, 계약 | "데이터의 유효성을 보장하는가?" |
| **저장** | 실제 저장 방식 + 고유 식별자 부여 | "영속화하거나 UID를 부여하는가?" |

**확장 가능**. 문서는 "5개로 고정이 아니다"(line 23)를 명시, 3가지 trigger 질문을 만족하면 새 역할 추가 가능(line 30~35).

### 1.2 단위 (spec / todo / test.md / facet.json 분리)

메모리 힌트의 `feedback_facet-definition-consumption-split` 원칙은 문서 트리에서 실제로 구현되지 않은 상태다. 대신 **아키텍처 경계는 레이어 1 / 레이어 2 분리**로 표현된다 (`meta-semantic-philosophy.spec.md:108~122`).

- **레이어 1 (수집)** — 코드 한 단위만 보고 결정 가능한 것. 패싯/바운더리/파이프/scope/aspect/layer가 단위 자체 속성.
- **레이어 2 (해석)** — 여러 단위를 연결해야 아는 것. lifecycle/link_type/concern 전파가 관계 속성.
- **단방향**: 레이어 1 → 레이어 2. 해석이 수집을 변경하지 않는다.

패싯은 레이어 1의 토대다. 다른 모든 개념(바운더리, 파이프, 좌표화)이 패싯 위에 서 있다 (`ms-concept-data-facets.spec.md:26` "이 규칙 없이는 바운더리, 계약 하향, 좌표화 등 상위 개념이 성립하지 않는다").

### 1.3 계보 (lineage) 추적 메커니즘

`meta-semantic-philosophy.spec.md:186~250` (원칙 7)와 `pipe-static-lineage.spec.md`에서 계보는 **"스키마 → prefix → 주소 → 계보" 체인**으로 작동한다.

```
DataSchema (컬럼 + 패싯 역할 매핑)
  → prefix의 축으로 등록 (table_ref 또는 axis_ref)
    → 데이터 인스턴스에 주소 부여 (prefix:version:address)
      → 필드 단위 계보 추적 (LineageCollector)
        → 스키마 버전 간 호환성 검증
```

**핵심: 메모리 힌트의 "데이터 패싯 = 계보 추적"은 정확히 이것.**

- `ms-concept-data-facets.spec.md:82~104` "데이터 계보: 이동과 변형" — 이동은 모듈 관계에 내재한 것이고, 추적해야 하는 것은 **변형**. 변형의 결과는 (a) 새 데이터 생성 또는 (b) 다른 데이터로의 변환. 양쪽 모두 **저장(UID 부여)됨으로써 계보가 추적**된다.
- `pipe-static-lineage.spec.md:28~58` 12개 공개 API — `deriveStaticLineage`, `deriveGraphLineage`, `findFieldOrigin`, `findFieldOriginInGraph`, `validateStaticLineage` 등이 정적 분석으로 필드 계보를 파생. 실행 기반 `extractLineageFromSimulation`도 같은 `resolveStepSchemaId`를 공유해 drift 불가.
- `pipe-fold-lineage.spec.md:14~26` — fold 시 `FoldedContract.lineageSummary`가 접힌 구간의 입출력만 보존 → fold 경계가 형태 체크포인트.

**계보의 두 경로**:
- **정적** (`deriveStaticLineage(flow)`): PipeFlow 구조만으로 파생
- **시뮬** (`extractLineageFromSimulation(result, pipes)`): 실행 결과에서 파생

양쪽이 같은 `resolveStepSchemaId`를 공유해 schemaId drift 불가.

---

## 2. 파이프 체계 (Pipe impl)

### 2.1 구성

`meta-semantic-pipe-impl.spec.md:132~175`에 구현 지도가 있다. 18개 모듈 + 594개 테스트 (33 files). 구조:

```
PipeSpec = 단일 실행 단위 (내부 패싯 흐름 트리)
PipeGraph = PipeSpec 노드들의 연결 그래프 (ScenarioSpec 대체)
```

**PipeFlow 30종** (`pipe-flow-catalog.spec.md:123~135`): step/sequence/branch/optional/parallel/race/await/retry/fallback/circuit-breaker/loop/feedback/compensate/**transition-scope**/emit/finally/timeout/map/reduce/buffer/filter/throttle/debounce/split/enrich/tap/resequence/window/dedup/correlation.

**ConnectionKind 8종** (`meta-semantic-pipe-impl.spec.md:142~153`): next / conditional / event / error / compensate / fan-out / join / feedback.

**fold topology 14종** (`pipe-flow-topology.spec.md:30~47`): atomic / linear / conditional / concurrent / resilient / iterative / transactional / signaling / temporal / batch / transformation / streaming / stateful / observational. 이는 **외부 포트 수 + 숨겨지는 내부 실행 구조** 기준 분류이며, STC에 없는 직교축이다.

### 2.2 설계→정적분석→게이트→시뮬→계보→SDK관측 흐름

메모리 힌트에 나오는 6단계 흐름은 `meta-semantic-system.spec.md:150~178`에 **정식으로 문서화되어 있다**. 다음이 원문:

```
1. 정의
   PipeFlow 30종 + ConnectionKind 8종 → PipeSpec → PipeGraph
   이벤트 정의(trigger, produces, emit), 데이터 계약(consumes/produces/accesses)
        ↓
2. 정적 분석 + 이벤트 카탈로그 수집
   구조: 경로 수, 검증, 복잡도, 병목, 서브그래프 접기/펼치기
   카탈로그: collectGraphEvents()로 trigger/produces/emit 이벤트 자동 수집
   해석: 관심사 8종 자동 추출 → BFS 전파 → 역할 분류
   ├── 품질 게이트 (구조/해석 기준은 여기서부터 적용 가능)
   ↓
3. 시뮬레이션
   (a) 실제 동작 시뮬: resolver로 분기/실패 시나리오 주입
   (b) 의도된 happy path 검증: matchHappyPath()로 설계 의도 확인
   → 실행 경로, 생산 이벤트, 패싯 트레이스 수집
   ├── 품질 게이트 (실행 데이터 기준: path-coverage-min 등)
   ↓
4. 계보 추적
   시뮬레이션 결과(SimulationResult) 기반
   extractLineageFromSimulation() → 필드 단위 계보 수집
   validateStepContracts() → step 간 스키마 호환 검증
        ↓
5. SDK 관측 코드 생성
   이벤트 카탈로그 기반 → CloudEvent 스키마 도출
   런타임 track API(event-catalog autoTrack)
   테스트 메트릭: compareWithSimulation()으로 시뮬 vs 실제 드리프트 감지
        ↓
   (피드백: 실제 수집 데이터 → 드리프트 발견 → 스펙 보정)
```

이는 단순한 개념 설명이 아니라 **실제 코드와 테스트 파일 경로까지 매핑된 구현된 파이프라인**이다. STC 제안서에는 이런 실행 파이프라인이 없다. STC는 **정의 메타데이터 축**만 다루고, 그 문서들이 연결되는 실행 체계는 meta-semantic이 이미 소유하고 있다.

### 2.3 각 단계 산출물

| 단계 | 입력 | 산출물 | 구현 파일 |
|------|------|--------|-----------|
| 1. 정의 | PipeFlow kind + StepDataContract + Event | PipeSpec / PipeGraph | `pipe-types.ts` |
| 2. 정적 분석 | PipeGraph | ComplexityReport, EventCatalog, BottleneckList, ConcernPropagation | `pipe-analyze.ts`, `pipe-interpret.ts` |
| Gate (2~3) | 분석 결과 | GateResult (pass/fail/review) + diagnostic | `pipe-gate.ts` |
| 3. 시뮬레이션 | PipeGraph + initialEvent + resolvers | SimulationResult (steps, pipeTrace, facetTrace, producedEvents) | `pipe-simulate.ts` (38+40+14+12+18 tests) |
| 3b. Happy path | SimulationResult + HappyPathSpec | HappyPathMatch (pipeTraceMatch, facetMatch, divergedAtIndex) | `matchHappyPath()` |
| 4. 계보 | SimulationResult + PipeGraph | FieldLineage[] + FlowLineageSummary | `pipe-lineage.ts` (43 tests) |
| 5. SDK 관측 | EventCatalog | CloudEvent 스키마 + track API codegen | `cloud-event-bridge`, `event-track-codegen` |

---

## 3. 시뮬레이션 (control engineering)

### 3.1 Happy path simulation

`pipe-simulate.spec.md:83~100`에서 happy path 검증은 **"설계자가 의도한 정상 경로를 선언하고, 시뮬 결과와 비교"**한다.

```typescript
const match = matchHappyPath(result, {
  expectedPipeTrace: ["validate", "charge", "receipt"],
  expectedFacets: ["검증", "결제", "영수증"],
});
// → { match, pipeTraceMatch, facetMatch, divergedAtIndex, expected, actual }
```

불일치 시 `divergedAtIndex`로 어디서 의도와 다른지 보고. 이것이 **"제어 공학적" 비유가 성립하는 지점**이다: 설계된 트레이스(setpoint)와 시뮬 실행 결과(actual)를 비교하고, 편차 지점을 식별.

추가로 `TestRegistry.compareWithSimulation()`이 시뮬 vs 실제 런타임 트레이스의 드리프트를 감지 — 이는 피드백 루프 클로징 역할.

### 3.2 Transition scope, fold, static lineage의 역할

세 요소가 제어 공학적 시뮬에 기여하는 방식:

**1) Transition scope (`transition-scope.spec.md`)**
- 제어 흐름 안에서 **비즈니스 트랜잭션의 원자 경계를 1급으로 선언**
- "이 묶음은 전부 되거나 전부 안 되거나" — 설계 시점 의도 선언
- 3층 공유 키 (`transitionId`): 좌표(PathSegment.transition) ↔ 제어 흐름(PipeTransitionScope) ↔ 이벤트 카탈로그(TransitionDef)
- 구현 메커니즘(DB tx, saga, 수동 보상)은 소비자가 결정 → **설계 선언과 구현 메커니즘 분리** (메모리: `feedback_transition-is-declarative`)
- `countPipePaths`: body + compensate 경로 합산
- 검증: `validateTransitionBridge` (좌표↔흐름), `validateTransitionEvents` (흐름↔카탈로그)

**2) Fold (`pipe-fold-lineage.spec.md` + `pipe-flow-topology.spec.md`)**
- 서브그래프를 하나의 노드로 접어서 경계 계약 도출
- `FoldedContract.lineageSummary`가 입출력 압축 (접힌 구간의 입출력만 보존)
- fold 경계 = 입력 형태와 출력 형태를 검증하는 **체크포인트** (메모리: `feedback_validation-as-checkpoint`)
- **14종 fold topology**가 flow kind 전체를 덮는다 → 줌 레벨별 시각화 가능 (`pipe-zoom.ts`)

**3) Static lineage (`pipe-static-lineage.spec.md`)**
- PipeFlow 정의만으로 계보 추적 — 실행 없이
- `deriveGraphLineage(graph)` cross-pipe 계보 + facetType 필터
- reduce accumulator 특수 처리 (consumes+produces 같은 필드 = transform: "aggregate")
- fold 시 `summarizeFlowLineage`로 계보 통합

**종합**: 이 셋이 결합하면 **"시뮬 실행 전에도 설계 시점에 형태 보존과 경계 무결성을 검증"**할 수 있다. 이것이 단순 시뮬레이터가 아닌 **형태 검증 기반 제어 공학적** 접근인 이유.

---

## 4. STC 제안과의 비교

### 4.1 개념 매핑 (data facet ↔ STC tier 구조)

| meta-semantic 개념 | STC tier | 관계 설명 |
|---|---|---|
| **Module IR** (파이프 소유 주체) | **System** | 거의 동형. `meta-semantic-concepts.spec.md:125`가 이미 "Module ≡ DefinitionEntry (좌표가 부여된 구조 단위)"라고 선언. STC는 이를 "operations 집합"으로 재표현. |
| **Data IR.definition** (DataSchema) | **Component** | 거의 동형. Data IR의 definition 역할이 Component의 "데이터 shape / 공유 계약" 정의와 일치. |
| **Data IR.lifecycle** (facetRole 상태) | **FSM** (부분) | "생산/소비/관리/저장" 상태 전환이 FSM이 될 수 있음. Pilot 예시의 `deterministic-label-record-fsm`이 정확히 이 패턴 (DRAFT → LINTED → RESOLVED → ACTIVE → ...) |
| **Pipe IR** (EventRecord 트리거 실행) | 어디에도 없음 | **STC에 대응 개념이 없다.** System이 operations를 가지지만, operations의 연결 그래프(PipeGraph)는 STC 축 바깥. |
| **바운더리** (패싯 중 일부가 있는 검증 단위) | **Component + System** | 바운더리 자체는 "검증 가능 기능 단위". STC는 이를 tier로 쪼개서 재분류하는 효과. leaf(바운더리)인데 데이터면 Component, operations면 System, 상태 전이면 FSM. |
| **Semantic Folding** | fold topology (14종) 존재, STC는 직접 대응 개념 없음 | |
| **검증 단위 (Verification Unit)** | 함축적 — tier 3-check는 "System인가"를 판단, "검증 단위인가"는 별개 층위 | |
| **분기 경로 / Spacetime UID** | STC 바깥 | 런타임 좌표 영역 |
| **PipeTransitionScope** | **FSM ≠ 일치. 인접하지만 다름** | §4.5 상술 |
| **계약 하향 (Contract Descent)** | **System 독립성 원칙(§1.2)과 정합** | 두 체계 모두 "상하 계약 분리". STC는 `contains` 금지로 표현, meta-semantic은 "상위도 하위도 서로의 세부를 모른다"로 표현. |

### 4.2 겹치는 영역

겹침은 **동일 문제를 다른 세부 수준에서 해결**하는 구조다.

1. **"Module is not a level, it's defined by what it does"**
   - meta-semantic `ms-concept-boundary.spec.md:72~76` "바운더리 = 모듈이다. 모듈은 '코드의 구조적 단위'가 아니라 '패싯 중 일부가 존재하는 검증 가능한 기능 단위'에 의해 정의된다."
   - STC `00-design.md:76~80` + R-7 3-check: "명명 가능 + 독립 운용 + lifecycle → System"
   - **같은 입장**. STC의 R-7 3-check는 meta-semantic 바운더리의 "검증 가능" 기준을 **System tier에 한해** 더 엄밀화한 버전.

2. **Data shape vs operations 분리**
   - meta-semantic Data IR ≠ Module IR (원칙 4 직교)
   - STC Component ≠ System (정의 vs operations)
   - **완전 정합**.

3. **상태 전이를 독립 개념으로**
   - meta-semantic: `Data IR.lifecycle`, `PipeTransitionScope`, Verdict FSM들
   - STC: FSM tier를 독립 축으로
   - **STC가 더 명시적**. meta-semantic은 "상태"를 여러 위치에 분산시킨다 (Data IR lifecycle, pipe 내 state 필드, transition-scope). STC는 FSM tier로 통합된 위치를 제안.

4. **Layout = 조직적 배치**
   - meta-semantic에 명시적 대응 없음. 단, `DefLevel group` + `cross-scope` 태그가 비슷한 역할.
   - STC Layout tier + `refs` LinkType이 이를 명시화.
   - **STC가 신규 기여**.

5. **구성/재귀 depth**
   - meta-semantic: folding L0/L1/L2 + 세그먼트 재귀 깊이 제한 없음
   - STC: Layout 재귀 + `depends_on` 체인 + System `contains` 금지
   - **구조 유사**, STC가 더 느슨함 (재귀는 허용하되 소유는 금지).

### 4.3 차이 / 분리되어야 할 영역

**1) Pipe / PipeGraph는 STC에 속하지 않는다**
- PipeGraph는 "여러 System의 연결된 실행 흐름" — STC 용어로는 "Layout이 실행 시점에 구체화된 인스턴스"와 비슷하나 정확히 다름.
- STC는 정적 문서 좌표만 다룬다. 실행 그래프는 meta-semantic 영역.
- **권장: STC 제안에 "PipeGraph는 STC 범위 밖"을 명시**하거나, `scope: flow` + `aspect: process_flow` 문서로 STC 안에 자리 잡되 **tier=system**으로 분류하는 컨벤션 필요.

**2) 시뮬레이션 / 게이트 / 계보 / SDK 코드 생성**
- 이 4단계는 완전히 STC 바깥. meta-semantic의 실행 파이프라인.
- STC가 흡수하려 들면 제안 범위 초과. 현재 제안이 이 영역을 건드리지 않는 것은 **올바른 경계 설정**.

**3) 런타임 좌표 (Spacetime UID, WeightedIndex, 분기 경로)**
- STC `03-decisions.md:603~645` "qa-sdk 기존 좌표계와의 관계"에서 URN/prefix/axis를 좌표계 #1로 인정 → **이미 직교 선언됨**.
- 충돌 없음. 단, 문서 내 `prefix_ref`나 `sources` 필드로 연결되는 것을 STC가 흐트러뜨리지 않도록 Phase 1에서 확인 필요.

**4) Folding 개념의 소유자**
- meta-semantic `ms-concept-folding.spec.md`가 Folding을 "Module + Pipe 모두에 적용되는 구조적 개념"으로 정의.
- STC의 `contains` 체인 + Layout 재귀도 일종의 folding이지만, Pipe Folding (실행 단계 접기)은 STC 바깥.
- **권장: 두 folding의 용어 구별**. 예) "Doc fold (STC)" vs "Pipe fold (meta-semantic)". Pilot 실증 전에 용어 분리가 안 되면 문서 수준에서 충돌.

### 4.4 Taxonomy 교차 단위 관점에서 본 정합성

`mental-models.md:126~170`의 Model 4 (Taxonomy 교차 단위)는 "문서의 identity = 모든 축의 특정 값 조합"이라 주장.

**예시 문서 좌표**:
```
deterministic-label-record-fsm.spec.md의 교차 좌표
  tier = fsm
  scope = interface
  aspect = api_contract
  layer = mediation
  lifecycle = approved
  doc-type-ext = .spec
  tags = [contract, observability]
```

이 관점은 meta-semantic 체계와 **대부분 정합**하지만, 몇 가지 긴장이 있다:

**정합 구조**:
- meta-semantic `meta-semantic-system.spec.md:60~91` 레이어 1 수집 항목 (scope/aspect/layer/concern/branch-path)이 Model 4의 "축"과 1:1 대응.
- Model 4의 "관점(perspective) = 질의 조합"은 meta-semantic의 "PipeGraph 해석 질의"와 동일한 발상 — 다른 축을 필터로 집합 추출.
- `meta-semantic-concepts.spec.md:97~114` "개념 의존 그래프"는 Model 4 축들이 어떻게 조립되는지 이미 선언.

**긴장 지점**:
- **`tier` 축 신설로 교차 공간이 확장**되는데, meta-semantic이 소유한 IR (Module/Data/Pipe)과 tier의 관계가 STC 제안 어디에도 **명시되지 않음**. R-1의 "tier × doc-type 직교" 표는 있으나 "tier × IR 구분"은 없음.
- meta-semantic이 이미 "한 코드가 Module/Data/Pipe 세 축에 동시 투영 가능" (원칙 4)라고 선언했다. STC의 한 문서 = 한 tier 정책과 미묘한 긴장.
- **질문**: 하나의 실행 가능 단위가 "System(operations 집합) + Component(data shape) + FSM(state lifecycle)"을 모두 가지면 tier를 어떻게 쪼갤 것인가? STC는 분할을 요구한다 (`00-design.md:149~158`의 `definition-catalog-spec` 분할 예시). meta-semantic은 한 개념이 세 축 투영을 유지하는 것을 허용한다.

**권장**: R-1 표를 확장해 "tier × IR 축" 매트릭스를 추가하고, "하나의 도메인 개념이 여러 tier 문서로 분할될 때 각 tier가 meta-semantic IR의 어느 부분에 해당하는지"를 명시. 현 상태는 Pilot 문서 분할 시 혼란 가능성 있음.

### 4.5 FSM tier vs pipe transition 차이

**이 지점이 두 체계의 가장 깊은 긴장**이다. 동일한 UML 어휘를 쓰지만 참조 대상이 다르다.

#### STC FSM tier (`tiers/fsm.md`)

| 요소 | 의미 |
|---|---|
| **State** | Entry 상태 마커 Component (무데이터 또는 최소 데이터) |
| **Event** | 트리거 Component (임시, 처리 후 소멸) |
| **Guard** | 전이 pre-condition 평가 단위 (UML `[Guard]`) |
| **Transition** | `(from-state, event, guard) → to-state` 매핑 + 실행 System 참조 |
| **Invariant** | 전체 불변식 |

- **대상**: **문서 수준 계약**. "Consumer가 읽을 System 소비 인터페이스."
- **생애**: 정적 (문서 접힘). State 인스턴스는 여러 Entry가 갖고, 한 FSM 문서가 그 state의 **의미**를 정의.
- **SSOT 방향**: 문서 → 코드 (code enum이 FSM 문서의 states[]를 따름).

#### meta-semantic PipeTransitionScope (`transition-scope.spec.md`)

| 요소 | 의미 |
|---|---|
| **transitionId** | 전이 식별자 (3층 공유 키) |
| **body** | 전이 본체 PipeFlow — 원자적으로 성공/실패해야 하는 제어 흐름 |
| **events** | 이 전이에 소속된 이벤트 목록 |
| **compensate** | 실패 시 보상 PipeFlow (선택) |

- **대상**: **제어 흐름 내 원자 경계**. "이 묶음이 전부 되거나 전부 안 되거나."
- **생애**: 동적 (실행 시점). 한 번의 run에서 `body`의 모든 step이 성공하면 commit, 실패하면 `compensate`.
- **SSOT 방향**: 문서 (PipeSpec) → 코드 (PipeRunner 구현). 구현 메커니즘(DB tx/saga/수동 보상)은 소비자 선택.

#### 대응 vs 차이

| 축 | STC FSM | PipeTransitionScope |
|---|---|---|
| 다루는 계층 | 개념 계약 (consumer-facing) | 실행 원자성 (runtime atomicity) |
| 기본 단위 | Entry의 상태 변화 | PipeFlow의 원자 실행 |
| state 개념 | 명시적 상태 리스트 | 없음 — body 흐름이 완료되면 성공 |
| event 개념 | 외부 트리거 | 전이에 소속된 이벤트들 (TransitionDef와 대조) |
| guard 개념 | 있음 (UML Guard) | 없음 (body 내부 분기는 별도 PipeFlow kind) |
| compensate 개념 | 없음 (failure mode는 Guard의 failure mode로) | 있음 (rollback 명시적) |
| Invariant | 있음 (monotonic 등) | 없음 |

**두 체계는 엄격하게 말하면 "직교하는 개념"이다.**

- STC FSM = 상태 기반 (states가 1급)
- PipeTransitionScope = 실행 기반 (flow가 1급, 원자성이 속성)

**같은 도메인에서 둘 다 필요할 수 있다**: Pilot 예시 `deterministic-label-record-fsm`은 DRAFT→LINTED→RESOLVED 같은 상태 전이를 FSM으로 표현, 실제 한 번의 `transition-request` operation을 실행할 때 DB 쓰기+validation+notification을 하나의 원자 경계로 묶으려면 **PipeTransitionScope가 필요**하다.

**긴장**:
- 같은 단어(transition)를 쓰니 혼동.
- FSM의 Transition은 `(from, event, guard) → to` 정적 매핑.
- Pipe의 Transition은 "원자 경계의 실행 흐름".
- Pilot 문서를 작성하면서 저자가 두 개념을 섞을 가능성 높음.

**권장**:
- STC 제안서에 "FSM Transition ≠ PipeTransitionScope"를 명시하는 짧은 섹션 추가.
- 또는 PipeTransitionScope를 `AtomicScope` 같은 다른 이름으로 교체하는 것도 고려 (meta-semantic 측의 리네이밍).
- 용어 정책: FSM에서는 `state-transition` 또는 `state-change`, PipeFlow에서는 `atomic-scope` 등으로 분리하면 혼동 낮아짐.

> **해소됨 (2026-04-18, D-16)**: Option B (Hybrid absorb) 채택. FSM Transition은 Form 1 (inline 매핑) 또는 Form 2 (scope_ref로 PipeTransitionScope 참조) 둘 중 선택. 같은 `transitionId`를 공유 키로 **4층 정합** (좌표/흐름/이벤트/FSM tier) 구성. meta-semantic은 리네이밍 없이 유지. 상세: [../03-decisions.md#D-16](../03-decisions.md)

---

## 5. 주요 발견 + 권장 사항

### 5.1 기존 설계가 STC로 흡수될 수 있는 부분

1. **DefLevel(group/module/leaf) → tier 재분류**
   - STC D-3 우선순위 6단계가 이미 이 전환을 담당. meta-semantic은 영향 없음 (IR/패싯 축은 레이어 1 속성, tier는 별개 분류축).
   - 구체적으로: meta-semantic entry point 문서들(`meta-semantic-system`, `meta-semantic-pipe-impl`)의 level이 group/module인데, STC에서는 tier=layout(entry-point 배치) 또는 tier=system(기능 집합)으로 분류 가능.

2. **"cross-scope" 태그 + group 재귀 → Layout tier + refs**
   - meta-semantic이 이미 "cross-scope" 태그로 Layout-like 관계를 표현. `refs` LinkType으로 승격하면 더 명확.
   - `docs/specs/meta-semantic/meta-semantic-pipe-catalog.spec.md:11` `tags: [cross-scope]`이 전형 예.

3. **Verdict FSM / IngestSessionState 같은 기존 state machine → FSM tier**
   - 이미 코드 수준 FSM이 있고 state enum도 있다. FSM tier 문서로 승격하면 R-7 3-check의 "Lifecycle 유무"를 바로 통과.

### 5.2 분리 유지해야 할 부분

1. **meta-semantic 실행 파이프라인 (시뮬/게이트/계보/SDK)**
   - STC가 건드리지 않음. 실행 파이프라인은 meta-semantic 소유. **건드리지 말 것.**
   - STC Phase 1~5에서 이 파이프라인에 영향 주는 변경이 생기면 rollback trigger로 추가 권장.

2. **분기 경로 좌표 / Spacetime UID / 합산 주소 모델**
   - STC `03-decisions.md:607`이 URN/prefix/axis를 좌표계 #1로 공식 인정. 이 경계를 지킬 것.

3. **PipeTransitionScope 및 ConnectionKind 8종**
   - 실행 계층 구성 요소. STC 문서 축에 직접 들어오지 않음. 단, 소비되는 문서에서 참조될 수 있으므로 "frontmatter sources 필드로 코드 참조 가능"을 유지.

4. **데이터 패싯 5역할 (특히 "관리" + "저장")**
   - STC의 어떤 tier도 패싯을 대체하지 않는다. 패싯은 **레이어 1 단위 속성**이고, tier는 문서 메타데이터 축. 직교.
   - Component에 `facetRole: produced | consumed | derived | managed | identity` 필드를 허용하거나, FSM 문서에서 evidence shape 컬럼이 facet role을 달도록 권장할 수 있음.

### 5.3 충돌 가능성이 있는 부분

1. **FSM vs PipeTransitionScope 어휘 충돌 (§4.5)**
   - 전술한 바와 같이 같은 "transition" 어휘를 다른 의미로 쓴다.
   - Pilot 저자가 혼동할 리스크 있음.

2. **"Pipe Folding" vs "STC `contains` 계층" (§4.3 #4)**
   - folding은 meta-semantic에서는 실행 단계 접기. STC에서는 문서 구조 접기.
   - Pilot 문서 작성 시 "folding"을 쓰면 누구의 folding인지 모호.

3. **`level`(group/module/leaf) 제거 시점과 meta-semantic 문서 좌표 드리프트**
   - `meta-semantic-philosophy.spec.md:244~250` 등 level 기반 설명이 많다.
   - STC Phase 5에서 level deprecate 예정인데, meta-semantic 문서들이 level에 의존한 설명을 바꿔야 함.
   - 비용 평가 필요.

4. **`depth` 필드 제거 (D-6 보류)**
   - meta-semantic 문서 다수가 `depth: overview/specification/implementation`을 사용.
   - 제거되면 lifecycle + 확장자로 대체되지만, 기존 문서 일괄 변경 필요.
   - Phase 1 전수 조사 결과가 영향 범위 결정.

### 5.4 STC 제안 개선에 반영할 수 있는 기존 설계의 통찰

**통찰 1: "수집 vs 해석" 레이어 분리 (philosophy 원칙 3)**
- STC는 tier / scope / layer 축을 병렬로 다룬다. meta-semantic은 "한 단위만 보고 결정 가능한 것"과 "관계 기반 해석"을 분리.
- STC R-1의 "tier × doc-type 직교"는 이미 이 분리에 근접. 더 나아가 **tier/scope/layer 각각이 "한 문서만 보고 결정 가능"이라는 보장이 필요**하다. "depends_on" chain을 따라가야 결정되는 tier는 좋지 않음 (설계 냄새).

**통찰 2: 경로 합산 모델의 문서적 함의 (philosophy 원칙 2)**
- "경로 합산, 전곱 금지"는 런타임 좌표 이야기지만, 문서 구조에도 적용 가능.
- 메모리: `feedback_abstraction-over-wiring` "추상화가 코딩만큼 복잡하면 실패. 최소 선언 → 최대 파생."
- STC Layout의 `refs`도 "Layout이 모든 System을 소유(contains)하면 문서 조합이 폭발" 이라는 같은 논리. **§1.2 System 독립성 원칙의 이론적 근거로 meta-semantic 원칙 2 인용 가능**.

**통찰 3: 변형 후 저장으로 계보 추적 (data-facet 단위)**
- `ms-concept-data-facets.spec.md:102~104` "이동은 모듈 관계에 내재, 변형은 생산+저장의 조합으로 표현. 데이터 계보는 저장의 UID 체인이 추적한다."
- STC Component 변경 경로(`tiers/component.md:44~53`)가 v2 신규 작성 + superseded_by 패턴 제안. **이 패턴은 meta-semantic의 "변형 후 저장" 원리의 문서 버전이다**. 근거로 인용하면 설득력↑.

**통찰 4: 형태 체크포인트로서의 fold 경계**
- 메모리: `feedback_validation-as-checkpoint` "검증 = 데이터 변환 지점의 형태 체크포인트 명시적 지정."
- `pipe-fold-lineage.spec.md:22~26` "fold 경계는 입력 형태와 출력 형태를 검증하는 체크포인트가 된다."
- **FSM Guard + Invariant도 같은 아이디어**. STC fsm.md에 "Guard는 전이 체크포인트, Invariant는 전체 체크포인트"라는 일관된 framing 추가 가능.

**통찰 5: 시뮬레이션 없이 검증 가능한 속성**
- meta-semantic은 정적 분석만으로 경로 수/복잡도/병목/계보를 추출.
- STC가 "tier 분류 → 자동 분류 성공률 측정"만 다루는데, "tier 분류 후 정적 분석으로 문서 품질 측정"이라는 후속 단계를 meta-semantic이 제공 가능.
- **STC Phase 2 자동 분류 직후 meta-semantic interpret/gate를 적용하는 파이프라인**이 자연스러운 확장.

**통찰 6: "비즈니스 로직 = 이벤트에 의해 트리거되는 파이프들의 집합"**
- `ms-concept-pipe.spec.md:30~54` 정의.
- STC `tiers/system.md` System 정의 "operations 집합"의 좀 더 구체적 버전.
- R-6 "System CRUD 오해 해소"에 보충: "System은 operations 집합이되, 그 operations는 이벤트 트리거 + 패싯 흐름으로 정의될 수 있다."

---

## 6. 질문거리

1. **PipeTransitionScope와 FSM Transition을 용어 수준에서 분리할 의사가 있는가?**
   - 기존 코드/문서를 생각하면 `transition`이라는 단어를 FSM이 점유하고, PipeTransitionScope는 `atomic-scope` / `transaction-scope`로 개명하는 방안.
   - 또는 "STC scope에서는 FSM 전이, meta-semantic scope에서는 PipeTransitionScope"로 문서 범위로 구별하고 용어 사전에 명시.

2. **meta-semantic의 Module/Data/Pipe 3축 직교 원칙과 STC "한 문서 = 한 tier" 정책을 어떻게 화해할 것인가?**
   - `definition-catalog-spec` 분할 예시처럼 항상 분할이 답인가?
   - 혹은 `primary_tier` + `aspects: [tier2, tier3]` 같은 보조 필드로 한 문서에 여러 tier 투영을 허용할 것인가?

3. **`depth` 필드 제거가 meta-semantic 문서 다수에 미치는 영향을 Phase 1 조사에 포함할 것인가?**
   - meta-semantic entry-point만 9개 이상, pipe-impl leaf 문서 22+, concepts leaf 9. 전수 조사 시 대규모 변경.

4. **Layout tier가 meta-semantic 실행 파이프라인(시뮬 등)에 영향을 주지 않는지 확인할 메커니즘이 있는가?**
   - 예: `meta-semantic-pipe-impl`이 Layout인가 System인가? (현재 level=module, 30+ contains). R-7 3-check를 돌리면 명명 ✓ 독립 운용 ? lifecycle ? → 애매.
   - STC Phase 2~3에서 이런 "Meta-system 성격 문서"의 분류가 어떻게 정의될지.

5. **Happy path simulation 결과를 FSM Invariant의 evidence로 쓸 수 있는가?**
   - `matchHappyPath` 성공이 FSM Invariant(예: monotonic) 검증의 근거가 되는 파이프라인이 가능한가?
   - 가능하다면 STC FSM tier의 Invariant 섹션에 "evidence = meta-semantic simulation result"를 명시 가능.

6. **Pilot 문서 작성 시 meta-semantic entry point를 건드릴 계획이 있는가?**
   - 건드리지 않는다면 OK.
   - 건드린다면 meta-semantic 소유자와 STC 제안자가 동기화 필요.

7. **데이터 패싯 5역할 + tier 매트릭스를 명시할 여지?**
   - Component가 facet role 중 "정의"만 담당, System이 "생산/소비/관리/저장" 담당, FSM이 transition 트리거로 "관리" 담당, 같은 명시적 매핑이 Pilot 때 필요한지?

---

## 7. 결론

STC 제안과 meta-semantic 체계는 **공존 가능하며 서로 독립적으로 가치를 낸다**. 큰 충돌은 없고, 주의할 것은:

1. **FSM Transition ≠ PipeTransitionScope** 용어 혼동 방지 (§4.5)
2. **"한 문서 = 한 tier" vs "한 개념 = 세 축 투영"** 화해 방식 결정 (§4.4)
3. **depth 제거와 meta-semantic 문서 영향 범위** (§5.3 #4)
4. **Folding 용어 중복** 해소 (§4.3 #4)

반면 meta-semantic이 STC에 제공할 수 있는 보강은 많다:

- 수집/해석 레이어 분리 원칙(§5.4 통찰 1)
- 경로 합산 논리가 Layout 독립성 원칙의 근거가 됨(§5.4 통찰 2)
- fold 경계 = 체크포인트 framing을 FSM Guard/Invariant에 적용(§5.4 통찰 4)
- Phase 2 자동 분류 후 정적 분석 파이프라인 확장 가능(§5.4 통찰 5)

**즉, STC는 meta-semantic의 표면을 더 깔끔한 문서 축으로 재분류하는 역할이고, meta-semantic은 그 문서들을 실행 가능한 파이프라인에 연결하는 역할이다**. 둘 다 필요하며 거의 직교한다.

---

## 참고 파일 인덱스

### meta-semantic (리뷰 대상)

- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-philosophy.spec.md` — 7가지 원칙
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-concepts.spec.md` — 9개 원자 개념 허브
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-system.spec.md` — 전체 시스템 entry-point (데이터 흐름 파이프라인 정의)
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md` — 5가지 역할
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/concepts/ms-concept-pipe.spec.md` — 파이프 = 이벤트에 의해 트리거되는 패싯의 실행 묶음
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/concepts/ms-concept-folding.spec.md` — Folding = 하위 패싯을 상위 인터페이스로 끌어올림
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/concepts/ms-concept-boundary.spec.md` — 바운더리 = 모듈 정의 기준
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/concepts/ms-concept-verification-unit.spec.md` — 검증 단위 = Folding L2 산출물
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/concepts/ms-concept-contract-descent.spec.md` — 계약 하향 = 상호 무지, 자기 계약 명확
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-pipe-impl.spec.md` — PipeFlow 30종 + ConnectionKind 8종 구현
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/meta-semantic-pipe-catalog.spec.md` — 카탈로그 운영 규칙
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/pipe-impl/pipe-flow-catalog.spec.md` — flow 30종 taxonomy
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/pipe-impl/pipe-flow-topology.spec.md` — 14종 fold topology
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/pipe-impl/pipe-static-lineage.spec.md` — 정적 계보 API 12개
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/pipe-impl/pipe-fold-lineage.spec.md` — fold 시 계보 통합
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md` — PipeTransitionScope (원자 경계)
- `/Users/junwoobang/workflow/qa-sdk/docs/specs/meta-semantic/pipe-impl/engine/pipe-simulate.spec.md` — 시뮬레이션 + happy path 검증

### STC (비교 대상)

- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/00-design.md` — 전체 개요
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/mental-models.md` — 4 mental model + 관점
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/tiers/fsm.md` — FSM tier
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/tiers/component.md` — Component tier
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/tiers/entry.md` — Entry tier (R-2 조건부)
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/tiers/system.md` — System tier + R-7 3-check
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/tiers/layout.md` — Layout tier
- `/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/03-decisions.md` — D-1~D-15 + R-1~R-7
