# Definition Catalog — 소프트웨어 정의 좌표계

> 소프트웨어를 구성하는 정의(화면, 기능, 흐름, 상태, 제약, 데이터)를
> **좌표 주소**로 분류하고 관리하는 문서 메타데이터 시스템.

관련 스펙: [decision-flow.spec.md](../decision-flow/decision-flow.spec.md)
구현: `packages/definition-catalog/src/`

## 상태

implemented (v0.1.0) — 106 tests / 5 files (2026-03-25)

---

## 1. 모델 정체성

### 왜 좌표계인가

소프트웨어를 정의하는 문서는 종류가 많다 — 화면 설계, 기능 명세, 상태 모델, 제약 사항, 데이터 스키마.
이 문서들이 흩어져 있으면 "이 기능의 명세가 있는가?", "어떤 제약이 걸려 있는가?"를 파악하기 어렵다.

**소수의 축으로 분류하면 모든 정의 문서에 고유 주소가 생긴다.**

이것이 qa-sdk 좌표 인코딩과 동형인 이유:
데이터 이벤트의 "어디서"를 좌표로 표현하듯, 정의 문서의 "무엇을"을 좌표로 표현한다.

### decision-flow와의 관계

```
definition-catalog   "무엇(what)을 정의하는가"    → def_document:v1:1057
decision-flow        "왜(why) 그렇게 결정했는가"  → decision_event:v1:1234

what × why = 추적 가능한 소프트웨어 정의
```

decision-flow는 결정의 "왜"를 좌표로 증명한다.
definition-catalog는 결정의 "산출물"이 어떤 종류의 정의인지를 좌표로 분류한다.
두 좌표가 연결되면 "이 컴포넌트 명세는 왜 이렇게 작성되었는가"를 주소 쌍으로 추적할 수 있다.

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

### 축 카탈로그

4개 core 축 + 1개 관계 축. 설명력 역할(role) 기준 분류.

#### Primary — 문서의 정체성을 결정하는 축

| 축 | entries | cap | 설명 |
|---|---|---|---|
| **def_scope** | 7 | 16 | 무엇에 대한 정의인가 — 대분류 |
| **def_aspect** | 20 | 64 | 어떤 세부 측면인가 — scope 내 세부 유형 |

#### Secondary — 문서의 성격을 한정하는 축

| 축 | entries | cap | 설명 |
|---|---|---|---|
| **def_depth** | 4 | 8 | 얼마나 상세한가 — 개요/명세/구현/검증 |

#### Contextual — 문서의 상태를 측정하는 축

| 축 | entries | cap | 설명 |
|---|---|---|---|
| **def_lifecycle** | 5 | 16 | 현재 어떤 상태인가 — 초안/검토/승인/폐기/보관 |

#### Relation — 문서 간 관계를 표현하는 축

| 축 | entries | cap | 설명 |
|---|---|---|---|
| **link_type** | 5 | 16 | 두 정의 사이의 관계 성격 |

---

## 3. 분류 체계 (Taxonomy)

### 7대 분류 × 20 세부 유형

scope-aspect는 **트리 구조**다. 유효한 조합은 20개뿐이다.

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
    ├── API계약 (api_contract)       REST/gRPC 엔드포인트, 요청/응답 스키마, 인증
    ├── CLI계약 (cli_contract)       커맨드, 플래그, 옵션, 출력 형식 정의
    └── 이벤트계약 (event_contract)  이벤트 스키마, 메시지 포맷, 발행/구독 규약
```

### scope-aspect 제약

좌표 공간은 16 × 64 = 1,024이지만 유효 조합은 20개.
`VALID_SCOPE_ASPECTS`가 이 제약을 표현하고, `validateScopeAspect()`가 등록 시 검증한다.
aspect만 알면 scope를 역추론할 수 있다 (`ASPECT_TO_SCOPE`).

---

## 4. 깊이 (Depth)

같은 scope × aspect 내에서 문서의 상세도를 구분한다.

```
overview         전체 그림, 목적과 범위
  ↓
specification    상세 요구사항, 인터페이스 정의
  ↓
implementation   구현 세부, 코드 수준 설계
  ↓
validation       테스트 계획, 검증 기준
```

예: `ui/component`에 대해
- overview: "인증 컴포넌트가 필요하다"
- specification: "입력 필드 3개, 유효성 규칙, API 호출 명세"
- implementation: "React Hook Form + zod 스키마, 파일 구조"
- validation: "단위 테스트 시나리오, 접근성 검증 기준"

---

## 5. 생명주기 (Lifecycle)

문서의 현재 상태를 추적한다.

```
draft → review → approved
                    ↓
               deprecated → archived
```

| 상태 | 의미 | 신뢰도 |
|------|------|--------|
| draft | 작성 중, 미완성 | 참조 주의 |
| review | 리뷰 대기/진행 | 변경 가능 |
| approved | 확정, 참조 가능 | 신뢰 |
| deprecated | 대체됨, 참조 비권장 | 이력용 |
| archived | 이력 보존, 비활성 | 읽기 전용 |

### decision-flow verdict 매핑

decision-flow의 결정 판정이 문서 생명주기에 자연스럽게 매핑된다:

| verdict | → lifecycle | 이유 |
|---------|-------------|------|
| success | approved | 결정 성공 → 관련 문서도 확정 |
| failure | deprecated | 결정 실패 → 관련 문서는 폐기 후보 |
| deferred | draft | 결정 보류 → 문서는 아직 초안 |
| superseded | archived | 결정 대체 → 문서는 보관 |

---

## 6. 관계 (Links)

정의 문서 간 관계를 5가지 유형으로 표현한다.

| 유형 | 방향 | 의미 | 전이성 |
|------|------|------|--------|
| depends_on | A → B | A는 B 없이 성립하지 않음 | 전이적 |
| implements | A → B | A는 B의 구현체 | 비전이적 |
| refines | A → B | A는 B를 더 구체화 | 전이적 |
| constrains | A → B | A가 B의 범위를 제한 | 비전이적 |
| traces_to | A → B | A와 B가 추적 관계 (decision-flow 등) | 비전이적 |

### 관계 예시: 로그인 기능

```
로그인 흐름(flow/user_scenario)
    │ refines
    ▼
로그인 기능정의(feature/func_def)
    │ implements          │ depends_on
    ▼                     ▼
로그인 컴포넌트           인증 상태 모델
(ui/component)           (state/domain_state)
    ▲ constrains              ▲ constrains
    │                         │
보안 제약(constraint/tech_constraint)
```

---

## 7. 좌표 인코딩

### Prefix 정의

| prefix | dims | totalSpace | 역할 |
|--------|------|-----------|------|
| def_document | scope(16) × aspect(64) × depth(8) | 8,192 | 문서 불변 정체성 좌표 |
| def_link | scope(16) × aspect(64) × link_type(16) | 16,384 | 관계 좌표 |

**설계 결정: lifecycle은 좌표에 포함하지 않는다.**

좌표는 **불변 정체성**을 인코딩한다. "이 문서는 UI/컴포넌트/명세다"는 바뀌지 않는다.
lifecycle(draft → approved)은 **변하는 상태**이므로 메타데이터 필드로만 관리한다.
이렇게 하면 lifecycle이 바뀌어도 주소가 안정적으로 유지되어 외부 참조가 깨지지 않는다.

### 직렬화

기존 qa-sdk SemanticAddress와 동일:

```
"def_document:v1:65"       → ui/component/specification
"def_document:v1:481"      → data/domain_data/overview
"def_link:v1:145"          → feature/func_def/depends_on
```

### 라운드트립

```typescript
const address = encodeDocument({ scope: "ui", aspect: "component", depth: "specification" });
const decoded = decodeDocument(address);
// → { scope: "ui", aspect: "component", depth: "specification" }
// lifecycle이 draft → approved로 바뀌어도 address는 불변
```

---

## 8. 레지스트리

`MemoryDefinitionRegistry`가 문서 메타데이터의 CRUD + 좌표 기반 질의를 제공한다.

### 등록

```typescript
const entry = registry.register({
  id: "login-component-spec",
  title: "로그인 컴포넌트 명세",
  scope: "ui", aspect: "component",
  depth: "specification", lifecycle: "draft",
  createdAt: "2026-03-25T00:00:00Z",
  updatedAt: "2026-03-25T00:00:00Z",
});
// entry.address = 1057
// entry.serialized = "def_document:v1:1057"
```

- scope-aspect 유효성 자동 검증 (무효 조합은 에러)
- 좌표 자동 계산

### 질의

```typescript
registry.findByScope("ui");                           // 모든 UI 문서
registry.findByAddress(1057);                         // 좌표로 직접 조회
registry.query({ scope: "ui", lifecycle: "approved" }); // 복합 필터
registry.stats();                                     // 분포 통계
```

### 관계

```typescript
registry.link("login-spec", "auth-state", "depends_on");
registry.getLinks("login-spec", "outgoing");
```

---

## 9. Bridge — decision-flow 연결

### 산출 유형 매핑

decision-flow의 `NarrativeOutcome.artifactType` → `DefScope`:

| artifactType | → scope | 이유 |
|-------------|---------|------|
| component, page, screen | ui | 시각적 산출물 |
| module, service, package | feature | 기능 산출물 |
| plan, workflow, pipeline | flow | 흐름 산출물 |
| state, model, entity | state | 상태 모델 산출물 |
| config, policy, rule | constraint | 제약/정책 산출물 |
| schema, axis, prefix, table | data | 데이터 구조 산출물 |
| api, endpoint, cli, event-schema | interface | 접근 계약 산출물 |

### address_context 빌더

```typescript
const ctx = buildDefinitionContext(entry);
// → { def_document: "def_document:v1:1057" }
```

기존 수집 파이프라인(ingest)에 그대로 연결 가능.

---

## 10. 태그 체계 (Tags)

### 횡단 관심사 태그 (ConcernTag)

scope를 횡단하는 관심사를 표현한다. scope로 만들면 분류가 깨지지만, tag로 묶으면 각 문서의 정체성은 유지된다.

| 태그 | 의미 | 걸리는 scope 예시 |
|------|------|-----------------|
| `security` | 인증, 인가, 암호화, 감사 | interface + constraint + state |
| `performance` | 지연, 처리량, 최적화 | data + flow + constraint |
| `accessibility` | a11y, WCAG, 스크린리더 | ui + constraint |
| `observability` | 로깅, 메트릭, 트레이싱 | data + flow + interface |
| `testing` | 검증 전략, 커버리지 | feature + flow |
| `migration` | 스키마 변경, 데이터 이전 | data + constraint |
| `deprecation` | 대체 계획, 이전 가이드 | 모든 scope |

### 구조 태그 (StructuralTag)

문서의 구조적 특성을 표시한다.

| 태그 | 의미 |
|------|------|
| `cross-scope` | 여러 scope에 걸치는 통합 문서 |
| `entry-point` | 이 주제의 시작 문서 (진입점) |
| `decision` | 의사결정 기록이 포함됨 |
| `generated` | codegen 등으로 자동 생성된 문서 |

### cross-scope 감지

`detectCrossScope(tags)`가 태그에서 scope 참조를 감지한다:
- scope 이름 2개 이상 → `isCrossScope: true`
- scope 이름 3개 이상 → `shouldSplit: true` (분리 후보)

---

## 11. 운영 컨벤션 (Classification Conventions)

### C1. scope 결정 기준 — "주 독자가 누구인가"

같은 주제라도 독자에 따라 scope가 다르다.
- API를 호출하는 사람이 볼 문서 → `interface/api_contract`
- 흐름을 이해하려는 사람이 볼 문서 → `flow/process_flow`
- 상태를 설계하는 사람이 볼 문서 → `state/domain_state`

### C2. 여러 scope에 걸치면 — 쪼개고 link로 연결

하나의 문서에 scope 2개 이상이 걸리면:
1. scope별로 독립 문서로 분리
2. `refines` / `depends_on` / `constrains`로 연결
3. 정말 쪼갤 수 없으면: 주 scope 1개 + `tags: ["cross-scope", "ui", "state", ...]`

### C3. 횡단 관심사는 scope가 아니라 tag

보안, 성능, 접근성 등은 여러 scope에 걸치는 관심사.
scope로 만들면 분류가 깨진다. `ConcernTag`로 횡단 추적한다.

```typescript
registry.query({ tags: ["security"] });  // 보안 관련 문서 전체
```

### C4. aspect 추가 시 — 기존 동류와 성격 비교

새 aspect가 필요할 때:
1. "주 독자/성격"이 기존 scope의 aspect들과 동류인가?
2. 동류면 해당 scope에 추가 (def_aspect headroom 44칸 내)
3. 아니면 다른 scope를 검토하거나 신규 scope 후보

### C5. aspect 이동은 파괴적 — 마이그레이션 프로토콜

scope 간 aspect 이동이 필요할 때:
1. 기존 aspect는 유지 (주소 안정성)
2. 새 aspect를 대상 scope에 추가
3. 기존 문서를 새 좌표로 마이그레이션 (새 entry + 구 entry deprecated)
4. `traces_to` 링크로 이전↔이후 추적

### C6. cross-scope 3개 이상이면 분리 후보

`detectCrossScope()`로 자동 감지. tags에 scope 이름이 3개 이상이면
이 문서는 너무 많은 관심사를 다루고 있다 → 분리하면 각각 더 명확한 좌표를 가진다.

---

## 12. 구현 현황

| 구현 | 파일 |
|------|------|
| 핵심 타입 | `types.ts` |
| 5축 정의 + AXIS_META | `vocabulary.ts` |
| 분류 체계 트리 + 제약 맵 | `taxonomy.ts` |
| 카탈로그 (axes + 2 prefixes) | `catalog.ts` |
| 좌표 인코딩/디코딩 | `observe.ts` |
| 인메모리 레지스트리 | `registry.ts` |
| decision-flow 브릿지 | `bridge.ts` |
| public exports | `index.ts` |

---

## 13. Quality Gates

```
pnpm --filter definition-catalog typecheck   # 타입 체크
pnpm --filter definition-catalog test        # 62 tests (3 files)
pnpm --filter definition-catalog build       # ESM + CJS 빌드
```

---

## 14. 후속 과제

| 과제 | 설명 |
|------|------|
| DEMO_CATALOG 통합 | definition 축/prefix를 DEMO_CATALOG에 추가 |
| DKG 노드 생성 | DefinitionNode 타입 + bootstrapDkg 자동 등록 |
| CLI 연동 | `qa-sdk def register/query/stats` 명령 |
| 영속 레지스트리 | D1/SQLite 기반 DefinitionStore |
| 커버리지 분석 | scope × aspect별 문서 존재 여부 히트맵 |
