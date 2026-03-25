---
def:
  id: definition-catalog-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [entry-point]
---
# Definition Catalog — 소프트웨어 정의 좌표계

> 비즈니스 로직 정의를 좌표 주소로 분류하고, contains 계층으로 조립하는 문서 메타데이터 시스템. ^purpose

관련 스펙: [decision-flow.spec.md](../decision-flow/decision-flow.spec.md)
구현: `packages/definition-catalog/src/`

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

## 2. 축 설계

### 설계 원칙

각 축은 5Q 자격 검증을 통과한다:
- Q1 유한한가? Q2 정의 분류와 관련있는가? Q3 여러 문서에서 공유되는가?
- Q4 안정적인가? Q5 capacity 관리가 가능한가?

좌표는 **불변 정체성**만 인코딩한다. 변하는 상태(lifecycle)는 좌표에 포함하지 않는다.

### 축 카탈로그

| 축 | role | entries | cap | 설명 |
|---|---|---|---|---|
| **def_scope** | primary | 7 | 16 | 무엇에 대한 정의인가 — 대분류 |
| **def_aspect** | primary | 20 | 64 | 어떤 세부 측면인가 — scope 내 유형 |
| **def_depth** | secondary | 4 | 8 | 얼마나 상세한가 |
| **def_lifecycle** | contextual | 5 | 16 | 문서의 현재 상태 (좌표 외 메타데이터) |
| **link_type** | relation | 5 | 16 | 정의 간 관계 성격 |

---

## 3. 분류 체계

### 7대 분류 × 20 세부 유형

```
소프트웨어 정의
├── 화면/UI (ui)
│   ├── 레이아웃 (layout)         화면의 공간 배치와 구조
│   ├── 컴포넌트 (component)      재사용 가능한 UI 구성 요소
│   └── 인터랙션 (interaction)    사용자 상호작용 동작과 피드백
│
├── 기능 (feature)
│   ├── 기능정의 (func_def)       기능의 명세와 동작 규칙
│   └── 시나리오 (scenario)       기능의 사용 시나리오와 기대 결과
│
├── 흐름 (flow)
│   ├── 사용자시나리오 (user_scenario)  사용자 관점의 작업 흐름
│   ├── 프로세스흐름 (process_flow)     시스템 내부 처리 순서
│   └── 연관관계 (relation)             엔티티/기능 간 연결과 의존성
│
├── 상태 (state)
│   ├── 앱상태 (app_state)        프론트엔드 애플리케이션 상태
│   ├── 도메인상태 (domain_state)  비즈니스 도메인 상태 모델
│   └── 시스템상태 (system_state)  인프라/런타임 수준 상태
│
├── 제약조건 (constraint)
│   ├── 기술적제약 (tech_constraint)   기술 스택, 성능, 호환성 제약
│   ├── 비즈니스제약 (biz_constraint)  비즈니스 규칙, 정책, 규정 제약
│   └── 인프라제약 (infra_constraint)  인프라, 배포, 운영 환경 제약
│
├── 데이터 (data)
│   ├── 도메인데이터 (domain_data)    비즈니스 도메인 엔티티와 스키마
│   ├── 시스템데이터 (system_data)    설정, 로그, 메트릭 등 시스템 데이터
│   └── 외부데이터 (external_data)    외부 API, 서드파티 데이터 연동
│
└── 인터페이스 (interface)
    ├── API계약 (api_contract)       REST/gRPC 엔드포인트, 요청/응답 스키마
    ├── CLI계약 (cli_contract)       커맨드, 플래그, 옵션, 출력 형식
    └── 이벤트계약 (event_contract)  이벤트 스키마, 메시지 포맷, 발행/구독 규약
```

scope-aspect 유효 조합: 20개. `VALID_SCOPE_ASPECTS`가 제약, `validateScopeAspect()`가 검증.

### 깊이 (depth)

```
overview         전체 그림, 목적과 범위
  ↓
specification    상세 요구사항, 인터페이스 정의
  ↓
implementation   구현 세부, 코드 수준 설계
  ↓
validation       테스트 계획, 검증 기준
```

### 생명주기 (lifecycle) — 좌표 외 메타데이터

```
draft → review → approved → deprecated → archived
```

좌표에 포함하지 않는다. lifecycle이 바뀌어도 주소가 안정적으로 유지된다.

---

## 4. 좌표 인코딩

### Prefix

| prefix | dims | totalSpace | 역할 |
|--------|------|-----------|------|
| def_document | scope(16) × aspect(64) × depth(8) | 8,192 | 문서 불변 정체성 |
| def_link | scope(16) × aspect(64) × link_type(16) | 16,384 | 관계 좌표 |

### 직렬화

```
"def_document:v1:65"   → ui/component/specification
"def_document:v1:481"  → data/domain_data/overview
```

같은 scope × aspect × depth인 문서 여러 건은 **같은 좌표**를 공유한다.
좌표는 문서 유형의 정체성이고, 개별 문서는 `id`로 구분한다.
`findByAddress()`는 해당 유형의 모든 문서를 반환한다.

---

## 5. 영속성 — Frontmatter SSOT

문서 파일의 YAML frontmatter가 SSOT. registry는 파생 인덱스.

```yaml
---
def:
  id: gate-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [security]
  links:
    - target: gate-engine-func
      type: implements
---
# Gate Service API 계약
...본문...
```

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

## 6. Concern 전파

concern은 단순 태그가 아니라 **link 그래프를 타고 전파되는 구조적 제약**이다.

### 전파 규칙

| concern | 전파 경로 |
|---------|----------|
| security | refines↓, implements↓, depends_on↑, constrains↓, **contains↓** |
| performance | refines↓, implements↓, depends_on↑, **contains↓** |
| accessibility | refines↓, implements↓, constrains↓, **contains↓** |
| observability | refines↓, implements↓, **contains↓** |
| testing | refines↓, implements↓, **contains↓** |
| migration | depends_on↑, refines↓, **contains↓** |
| deprecation | refines↓, implements↓, depends_on↑, **contains↓** |

↓ = downstream (상위→하위), ↑ = upstream (의존대상→의존자)
`contains↓` = 그룹→멤버 전파. `traces_to`는 전파하지 않는다.

### EffectiveConcerns

```typescript
const concerns = computeEffectiveConcerns(
  "gate-api",
  id => registry.get(id),
  (id, dir) => registry.getLinks(id, dir),
);
// concerns.direct: ["security"]         — 직접 부여
// concerns.inherited: [{ concern: "security", from: "gate-constraint", via: "constrains", path: [...] }]
// concerns.all: ["security"]            — 합집합
```

다단계 전이적 전파(BFS), 순환 참조 안전.

---

## 7. 계층 구조 (contains)

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

## 8. 마커 기반 요약 추출

줄 끝 `^purpose` / `^overview` 마커로 추출 수준을 작성자가 명시.

```markdown
> RPC 엔드포인트 명세. ^purpose

6개 RPC: check, classify, getState, recompute, cascadeRecompute, filterRanges ^overview
```

| 수준 | 추출 대상 | 용도 |
|------|----------|------|
| purpose | `^purpose` 줄만 | "무엇을 하는가" 1줄 |
| overview | `^purpose` + `^overview` | 핵심 사실 포함 |
| full | 전체 (마커만 제거) | 상세 내용 |

---

## 9. 문서 조립 (assembleFeature)

그룹의 contains 멤버를 purpose/overview 수준으로 조립.

```typescript
const assembled = assembleFeature("gate-system", getEntry, getLinks, getBody, "purpose");
// → 그룹 purpose + 멤버별 { scope, purpose } (scope 순서 정렬)
```

scope 정렬: constraint → state → data → feature → flow → interface → ui
(제약이 뭐고 → 상태가 뭐고 → 기능이 뭐고 → 어떻게 접근하는가)

---

## 10. 운영 컨벤션

### C1. 1개 문서 = 1개 좌표 = 1개 비즈니스 로직

문서의 좌표가 정의하는 주제의 내용**만** 담는다.
다른 scope의 내용은 1줄 요약 + link로 대체.
2줄 이상 서술하면 분리 신호.

### C2. scope 결정 기준 — "주 독자가 누구인가"

- API를 호출하는 사람 → `interface/api_contract`
- 흐름을 이해하려는 사람 → `flow/process_flow`
- 상태를 설계하는 사람 → `state/domain_state`

### C3. 여러 scope에 걸치면 — 쪼개고 link로 연결

scope별 독립 문서로 분리 → link로 연결.
정말 쪼갤 수 없으면: 주 scope 1개 + `tags: ["cross-scope", ...]`

### C4. 횡단 관심사는 scope가 아니라 ConcernTag

보안, 성능, 접근성 등은 tag로 횡단 추적. link 그래프를 통해 자동 전파.

### C5. aspect 추가 시 — 기존 동류와 성격 비교

새 aspect는 "주 독자/성격"이 기존 aspect와 동류인지 확인 후 배치.

### C6. aspect 이동은 파괴적 — 마이그레이션 프로토콜

기존 aspect 유지 → 새 aspect 추가 → 마이그레이션 → traces_to 추적.

### C7. cross-scope 3개 이상이면 분리 후보

`detectCrossScope()`로 자동 감지.

---

## 11. 구현 현황

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

### 운영 문서

| 문서 | frontmatter | ^purpose | contains |
|------|:-----------:|:--------:|:--------:|
| system-overview | ✓ | ✓ | — |
| record-spec | ✓ | ✓ | — |
| ingest-api-spec | ✓ | ✓ | — |
| decision-flow-spec | ✓ | ✓ | — |
| gate-service-spec | ✓ | ✓ | — |
| definition-catalog-spec | ✓ | ✓ | — |
| **gate-system** | ✓ | ✓ | **6 멤버** |
| gate-api | ✓ | ✓ | — |
| gate-state-model | ✓ | ✓ | — |
| gate-engine-func | ✓ | ✓ | — |
| gate-flow | ✓ | ✓ | — |
| gate-constraint | ✓ | ✓ | — |
| gate-scenario | ✓ | ✓ | — |

---

## 12. Quality Gates

```
pnpm --filter definition-catalog typecheck   # 타입 체크
pnpm --filter definition-catalog test        # 234 tests (13 files)
pnpm --filter definition-catalog build       # ESM + CJS 빌드
```

---

## 13. 현재 범위와 경계

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
