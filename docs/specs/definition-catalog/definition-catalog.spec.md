---
def:
  id: definition-catalog-spec
  level: module
  address: def_document:v2:342162
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [structural, entry-point]
  links:
    - target: system-concepts
      type: depends_on
    - target: definition-taxonomy
      type: contains
    - target: definition-concern
      type: contains
    - target: definition-extraction
      type: contains
    - target: definition-assembly
      type: contains
    - target: definition-contract
      type: contains
    - target: definition-state-model
      type: contains
    - target: definition-quality-gates
      type: contains
    - target: definition-harness
      type: contains
    - target: definition-management
      type: contains
    - target: definition-cross-loop-bridge
      type: contains
---

# Definition Catalog — 소프트웨어 정의 좌표계

## 목적 ^purpose

비즈니스 로직 정의를 좌표 주소로 분류하고, contains 계층으로 조립하는 문서 메타데이터 시스템.

## 정의 ^defines

- 1문서=1좌표 정체성 원칙
- 좌표 동형 (DEFINITION_CATALOG ≡ DemoCatalog)
- Frontmatter SSOT 계약 (scanAndBuild)
- 운영 컨벤션 C1~C12

## 위임 ^delegates

- **taxonomy** → 분류 축 정의
- **concern** → 전파 규칙
- **extraction** → 마커 추출
- **assembly** → 문서 조립
- **contract** → 계약 조립
- **state-model** → FSM 엔진 + 머신
- **quality-gates** → 품질 게이트
- **harness** → 상태 관리 자동화

## 구성 ^overview

8개 하위 모듈:

- **definition-taxonomy**: 분류 축(scope, aspect, depth, level, layer, link_type)
- **definition-concern**: concern 전파 규칙 (7종 × link 그래프 BFS)
- **definition-extraction**: ^purpose/^overview 마커 기반 요약 추출
- **definition-assembly**: assembleFeature() 그룹 멤버 조립
- **definition-contract**: 계약 조립 (8종 마커 + evidence 가역성 + 통계)
- **definition-state-model**: FSM 엔진 + 11개 상태 머신 정의
- **definition-quality-gates**: 품질 게이트 통합 (6단계 프로세스 + gate-fsm + gate-derivation)
- **definition-harness**: 상태 모델 적용층 (의존/프로세스/SDK수집)

## 참조

관련 스펙: [df-system.md](../decision-flow/df-system.md)

## 관련 소스

- `packages/definition-catalog/src/` — 구현

## 상태

implemented (v0.1.0) — 195 tests / 10 files (2026-03-25)

---

## 1. 모델 정체성

### 1개 문서 = 1개 비즈니스 로직

이 시스템의 단위는 **1개의 비즈니스 로직 정의**다.
각 문서는 정확히 하나의 좌표(scope × aspect × depth)에 위치하고,
그 좌표가 정의하는 주제의 내용만 담는다.

```
좌표 = 문서의 정체성 = "이 문서는 무엇을 정의하는가"
내용 = 그 정체성에 맞는 비즈니스 로직만
```

여러 비즈니스 로직 간의 구조(깊이, 상속, 조합)는 이 시스템의 현재 범위가 아니다.
현재 단계에서는 개별 로직의 분류와 추적에 집중한다.

### decision-flow와의 관계

```
definition-catalog   "무엇(what)을 정의하는가"    → def_document:v1:65
decision-flow        "왜(why) 그렇게 결정했는가"  → decision_event:v1:1234

what × why = 추적 가능한 소프트웨어 정의
```

### 좌표 동형

```
DEFINITION_CATALOG     ≡  DemoCatalog       (축 + prefix 구조)
def_scope/def_aspect   ≡  AxisDef           (차원)
DefinitionEntry        ≡  EventRecord       (좌표가 부여된 레코드)
VALID_SCOPE_ASPECTS    ≡  SchemaConstraint  (유효 조합 제약)
```

---

## 2. 구성

3개 하위 모듈로 분해된다:

| 하위 문서 | 역할 |
|-----------|------|
| **definition-taxonomy** | 분류 축(scope, aspect, depth, level, layer, link_type), 좌표 인코딩, 주소 체계 |
| **definition-state-model** | FSM 엔진 + 11개 상태 머신 정의 |
| **definition-harness** | 상태 모델을 실제 시스템에 적용 — 의존/프로세스/수집/품질게이트 |

### 영속성 — Frontmatter SSOT

문서 파일의 YAML frontmatter가 SSOT. registry는 파생 인덱스.

```yaml
---
def:
  id: gate-api
  version: v2
  revision: 2
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [structural, security]
  links:
    - target: gate-engine-func
      type: implements
    - target: gate-api-v1
      type: supersedes
gate:
  kind: api-contract
  workDomain: backend-logic
  command: pnpm --filter gate-service test
---
# Gate Service API 계약
...본문...
```

`gate` 블록은 선택이다. `depth: validation` 문서가 실행 가능한 단일 품질 게이트와 1:1로 대응할 때 사용한다.

### 스캔

```typescript
const result = await scanAndBuild(rootDir, [join(rootDir, "docs")]);
// result.registry: 자동 구성된 MemoryDefinitionRegistry
// result.registered: 등록된 문서 수
// result.linked: 연결된 관계 수
// result.errors: 파싱 에러 목록
```

1. 디렉토리 재귀 스캔 → .md 파일에서 frontmatter 추출
2. `def` 블록 파싱 + scope-aspect 검증
3. registry 자동 등록 (좌표 자동 계산)
4. links 자동 연결 (모든 문서 등록 후)
5. frontmatter 없는 파일은 건너뜀

---

## 3. 계층 구조 (contains)

`contains` 링크로 문서를 그룹으로 묶는다. 그룹도 문서(overview depth).

```
gate-system (flow/overview, tags: [security])
  ├── contains → gate-constraint (constraint/specification)
  ├── contains → gate-state-model (state/specification)
  ├── contains → gate-engine-func (feature/specification)
  ├── contains → gate-flow (flow/specification)
  ├── contains → gate-api (interface/specification)
  └── contains → gate-scenario (feature/validation)
```

3가지 패턴:
- **묶음**: 그룹이 멤버를 contains
- **교집합**: 1개 문서가 여러 그룹에 소속 (DAG)
- **상속**: 그룹의 concern이 모든 멤버에 contains↓ 전파

---

## 4. 운영 컨벤션

### 분류 컨벤션

**C1. 1개 문서 = 1개 좌표 = 1개 비즈니스 로직**

문서의 좌표가 정의하는 주제의 내용**만** 담는다.
다른 scope의 내용은 link로 참조. 본문에 2줄 이상 서술하면 분리 신호.

**C2. scope 결정 기준 — "주 독자가 누구인가"**

- API를 호출하는 사람 → `interface/api_contract`
- 흐름을 이해하려는 사람 → `flow/process_flow`
- 상태를 설계하는 사람 → `state/domain_state`

**C3. 여러 scope에 걸치면 — 쪼개고 link로 연결**

scope별 독립 문서로 분리 → link로 연결.
정말 쪼갤 수 없으면: 주 scope 1개 + `tags: ["cross-scope", ...]`

**C4. 횡단 관심사는 scope가 아니라 ConcernTag**

보안, 성능, 접근성 등은 tag로 횡단 추적. link 그래프를 통해 자동 전파.

**C5. aspect 추가 시 — 기존 동류와 성격 비교**

새 aspect는 "주 독자/성격"이 기존 aspect와 동류인지 확인 후 배치.

**C6. aspect 이동은 파괴적 — 마이그레이션 프로토콜**

기존 aspect 유지 → 새 aspect 추가 → 마이그레이션 → traces_to 추적.

**C7. cross-scope 3개 이상이면 분리 후보**

`detectCrossScope()`로 자동 감지.

### 문서 작성 컨벤션

**C8. 모든 문서에 frontmatter + `## 목적 ^purpose` 필수**

```yaml
---
def:
  id: <고유 ID>
  scope: <scope>
  aspect: <aspect>
  depth: <depth>
  lifecycle: <lifecycle>
  tags: [<태그들>]          # 선택
  links:                    # 선택
    - target: <대상 ID>
      type: <관계 유형>
---
```

본문 첫 번째 `##` 섹션은 반드시 `## 목적 ^purpose`.

**C9. `## 목적 ^purpose` — 이 문서가 무엇인가를 서술**

섹션 분량으로 작성. 작성자가 요약에 포함할 내용을 통제한다.
assembleFeature()가 이 섹션을 수집하여 그룹 요약을 조립한다.

**C10. `## 방법 ^method` — 하위 구성요소로 목적을 어떻게 달성하는가** (module/group 권장)

하위 구성요소를 주어로 써서 목적 달성 경로를 서술한다.
`^delegates` 목록의 각 항목이 무엇을 하는지 흐름으로 연결.

**C11. `## 구성 ^overview` — 핵심 사실을 나열** (선택)

무엇이 있는가, 몇 개인가, 주요 항목 목록.
purpose보다 구체적이지만 상세 내용은 아닌 수준.

**C12. 마커 없는 섹션 = detail (full에서만 보임)**

`## 엔드포인트`, `## 상태 정의` 등 마커 없는 섹션은 full 추출에서만 보인다.

**C13. 그룹 문서는 overview depth + contains 링크**

```yaml
def:
  id: <시스템>-system
  scope: flow
  aspect: process_flow
  depth: overview
  links:
    - target: <멤버 ID>
      type: contains
```

그룹 문서의 `## 목적 ^purpose`에 시스템 전체 목적,
`## 구성 ^overview`에 멤버 목록과 구성 요약.

---

## 5. 구현 현황

| 구현 | 파일 |
|------|------|
| 핵심 타입 (축, concern, entry, link, filter) | `types.ts` |
| 5축 정의 + AXIS_META | `vocabulary.ts` |
| 분류 체계 트리 + 제약 맵 + 컨벤션 + 태그 | `taxonomy.ts` |
| 카탈로그 (axes + 2 prefixes) | `catalog.ts` |
| 좌표 인코딩/디코딩 | `observe.ts` |
| 인메모리 레지스트리 | `registry.ts` |
| concern 전파 엔진 | `concern.ts` |
| 마커 기반 추출 | `extract.ts` |
| 문서 조립 | `assemble.ts` |
| frontmatter 파서 + 스캐너 | `frontmatter.ts` |
| decision-flow 브릿지 | `bridge.ts` |
| public exports | `index.ts` |

### 검증

| 테스트 | 검증 내용 |
|--------|----------|
| `taxonomy.test.ts` | scope-aspect 제약, 태그, 컨벤션, cross-scope 감지 |
| `observe.test.ts` | 라운드트립, capacity 규칙 |
| `registry.test.ts` | CRUD, 질의, 관계, 통계 |
| `address-collision.test.ts` | 같은 유형 문서 다수 등록/삭제 |
| `concern.test.ts` | 7종 concern 전파 규칙, 순환 안전 |
| `extract.test.ts` | ^purpose/^overview 마커 추출 |
| `hierarchy.test.ts` | contains 묶음, 교집합, 계층 상속 전파 |
| `assemble.test.ts` | assembleFeature 조립 + 마커 커버리지 100% |
| `sample.test.ts` | 결제 시나리오 9문서 × 10관계 |
| `real-docs.test.ts` | qa-sdk 20문서 수동 등록 질의 |
| `frontmatter.test.ts` | 파서 단위 + 스캔 통합 |
| `scan-real.test.ts` | docs/ 디렉토리 스캔 |
| `gate-docs.test.ts` | gate 7문서 scope 분리 + 그룹 + concern |
| `ingest-docs.test.ts` | ingest 12문서 분할 + 조립 + concern 전파 |

### 운영 문서 (24건)

| 그룹 | 문서 | scope | contains |
|------|------|-------|:--------:|
| — | system-overview | flow/overview | — |
| — | definition-catalog-spec | data/specification | — |
| — | df-state-model | state/specification | — |
| — | gate-api | interface/specification | — |
| **gate** | gate-system | flow/overview | **6 멤버** |
| | gate-api | interface/specification | — |
| | gate-state-model | state/specification | — |
| | gate-engine-func | feature/specification | — |
| | gate-flow | flow/specification | — |
| | gate-constraint | constraint/specification | — |
| | gate-scenario | feature/validation | — |
| **ingest** | ingest-system | flow/overview | **11 멤버** |
| | ingest-api-spec | interface/specification | — |
| | query-api-spec | interface/specification | — |
| | scenario-api-spec | interface/specification | — |
| | stream-api-spec | interface/event_contract | — |
| | verdict-api-spec | interface/specification | — |
| | admin-api-spec | interface/specification | — |
| | record-spec | data/specification | — |
| | trace-spec | data/specification | — |
| | session-spec | data/specification | — |
| | ingest-pipeline-flow | flow/specification | — |
| | ingest-infra-spec | constraint/specification | — |

---

## 6. Quality Gates

```
pnpm --filter definition-catalog typecheck   # 타입 체크
pnpm --filter definition-catalog test        # 248 tests (14 files)
pnpm --filter definition-catalog build       # ESM + CJS 빌드
```

---

## 7. 현재 범위와 경계

### 현재 범위

- 1개 비즈니스 로직 = 1개 좌표 = 1개 문서
- contains 계층으로 그룹 조립 (묶음/교집합/상속)
- ^purpose/^overview 마커로 요약 추출
- assembleFeature()로 그룹의 목적+멤버 요약 자동 조립
- frontmatter SSOT → scanAndBuild → registry 파생
- concern 전파: 7종 × 7개 link type (contains 포함)

### 후속 과제

| 과제 | 설명 |
|------|------|
| DEMO_CATALOG 통합 | definition 축/prefix를 DEMO_CATALOG에 추가 |
| CLI 연동 | `qa-sdk def scan/query/assemble` 명령 |
| 자동 link 추론 | 좌표 유형 간 구조적 관계에서 link를 자동 생성 |
| 커버리지 히트맵 | scope × aspect별 문서 존재/부재 시각화 |
| 나머지 문서 frontmatter 주입 | docs/specs/ 200+건에 점진적 frontmatter 추가 |
