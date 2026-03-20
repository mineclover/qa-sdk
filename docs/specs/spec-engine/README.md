# Spec Engine — 작은 세계의 구조 정의 도구

> **Status: DESIGN**
>
> indexing 레이어가 "작은 세계를 수학적으로 운용하는 원시 도구"라면,
> spec-engine은 "그 세계를 왜 이렇게 구성했고, 밖에서 어떻게 보이는지 정의하는 도구"이다.
>
> NestJS를 호스트 런타임으로 사용하되, 코어 모델은 framework-agnostic 독립 커널로 유지한다.

기반: [../indexing/README.md](../indexing/README.md) · [../indexing/schema-layer.md](../indexing/schema-layer.md) · [../indexing/coordinate-states.md](../indexing/coordinate-states.md)

---

## 프로젝트 정체성

```
정체성: 차원 압축 기반 DSL DB

enum, 이벤트 유형, 권한 유형 같은 고정 조합을 전문으로 다루는 시스템.
비즈니스 로직의 경우의 수를 차원 교차로 제어하고,
그 경우의 수의 스펙 메타데이터를 전문적으로 관리한다.

핵심 능력: 차원 압축
  { role: "admin", action: "write", resource: "dashboard" } → 정수 42
  정수 42가 다른 prefix의 차원이 된다 → 재귀 합성
  DB에서는 3개 컬럼 JOIN. 여기서는 정수 하나에 전체 트리.

prefix = 의사결정의 결과 단위
  의사결정이 DSL(prefix)을 결정한다
  각 prefix는 "이 차원들의 교차를 추적하기로 결정했다"의 산출물
  축을 비대하게 만들지 않고 새 의사결정 단위(prefix)를 만든다

· 스펙이 추적되고 의사결정도 추적된다
· 같은 의미가 수렴하고 타입이 공유된다
· 이미 있는 것이 닫힌 조합의 숫자가 된다
· 관측을 유지하여 관측 밖의 상황을 탐색한다
```

---

## indexing 레이어와의 경계

```
indexing 레이어 (기존, 변경 없음)
  "작은 세계 하나를 수학적으로 정의하고 운용하는 원시 도구"
  = 수학 + 어휘 + 버전 + 프로토콜
  → weighted-index, bit-index, permission-engine, index-meta, demo-snapshot

spec-engine (이 문서)
  "그 세계를 왜 이렇게 구성했고, 밖에서 어떻게 보이는지 정의하는 도구"
  = export surface + 구조 검증 + 설계 근거

의존 방향:
  spec-engine → indexing 레이어 (소비자)
  indexing 레이어 → spec-engine (역방향 금지)
```

| 관심사 | indexing 레이어 | spec-engine |
|--------|----------------|-------------|
| **핵심 질문** | 어떻게 인코딩하는가 | 왜 이 조합인가, 밖에서 뭘 보는가 |
| **소유** | shape, stride, encode/decode, version | export surface, schema, spec document |
| **prefix에 대해** | dims + capacity + encode | export pattern + schema binding + rationale |
| **검증** | 좌표 유효성 (range, position) | 구조 유효성 (required, cardinality, category) |
| **버전** | draft/sealed + headroom + migration | spec lifecycle (draft/active/deprecated) |

---

## 핵심 개념: prefix = 정보 은닉 모듈

### 모듈 구조

prefix는 내부 차원을 숨기고 외부에는 축약된 식별자만 노출한다.
NestJS의 `@Module({ providers, exports })`와 구조적으로 동형.

```
NestJS Module                    prefix
─────────────                    ──────
@Module({                        PrefixSpec("permission", {
  providers: [내부 서비스],        dims: { action, role, env, svc },  // 내부
  exports: [공개 서비스],          export: "{action}.{role}",         // 외부 노출
})                               })

import OtherModule              prefix_ref → 다른 prefix 참조
  → 내부 구현 모름                → 참조된 prefix 내부를 몰라도 동작
  → 필요하면 inject               → resolveAddress로 열어볼 수 있음
```

### 3단계 해상도 (선택적 계층 분해)

```
key:    permission:v1:42
value:  "add.admin"                         ← 제목 (export surface, 항상 key와 쌍)
          ↓ 열어보면
        { action: "add", role: "admin" }    ← 내부 분해 (entries lookup)
          ↓ 더 열어보면
        { action: 10, role: 20 }            ← position (decode, 수학)
```

위로 올라갈수록 은닉, 아래로 내려갈수록 분해. 관측 전까지는 평범한 정수+제목.

### decode ≠ value lookup ≠ export title

| 연산 | 결과 | 담당 | 성격 |
|------|------|------|------|
| decode(42) | `{ action: 10, role: 20 }` | weighted-index | position 쌍 (수학) |
| entries lookup | `{ action: "add", role: "admin" }` | LabelRegistry | value (key→value) |
| export resolve | `"add.admin"` | spec-engine | 제목 (모듈의 공개 식별자) |

세 연산은 독립적이다. indexing 레이어가 처음 두 개를, spec-engine이 마지막을 담당한다.

---

## spec-engine이 정의하는 것

### 1. Export Surface — 모듈의 공개 식별자

prefix가 외부에 노출하는 제목(title) 패턴.

- **export에 포함되는 차원** = 좌표의 정체성을 결정하는 차원
- **export에서 빠지는 차원** = 컨텍스트 또는 런타임 데이터

```
permission: export "{action}.{role}"     → "add.admin"     (env, svc는 내부)
service:    export "{env}/{svc_name}"    → "prod/shopping"  (region은 내부)
cart_event: export "{action}"            → "add"           (actor, target는 table_ref)
```

### 2. Schema — 구조 검증 (Layer 2)

6 기본 카테고리 + 구조적 제약. 의미 추론(Layer 3)은 범위 밖.

| 카테고리 | 정의 |
|----------|------|
| entity | 정체성을 가진 것 |
| event | 발생한 것 |
| relation | 둘 이상의 객체 간 연결 |
| state | 상태 스냅샷 |
| policy | 권한/적용 범위/판정 구조 |
| observation | 관측/로깅/추적 |

### 3. Spec Document — 설계 근거

prefix의 존재 이유를 문서화. c4-doc 참조하되 독립 재작성.

- prefix의 존재 이유 (왜 이 차원 조합인가)
- 차원 선택의 근거 (왜 env × svc × role이지, env × role이 아닌지)
- 좌표 간 관계 (prefix 간 인과/의존)
- spec 연결은 강제 게이트가 아니라 자연 인센티브

## spec-engine이 하지 않는 것

- **좌표 연산** — encode/decode, stride, shape → indexing 레이어
- **합성 레이블 렌더링** — 소비자가 export title을 어떻게 표시할지는 소비자 책임
- **의미 추론** — Layer 3 semantic 규칙 → 외부 플러그인
- **데이터 저장** — 저장 계층의 책임
- **런타임 관측** — QA/observation 시스템의 책임

---

## 아키텍처

### 런타임 계층

```
┌─────────────────────────────────────────────┐
│  NestJS App Layer (호스트)                    │
│  Module · Controller · Interceptor · Guard   │
│  └─ binding, wiring, transport, lifecycle    │
├─────────────────────────────────────────────┤
│  Spec Engine Core (커널, framework-agnostic) │
│  ExportSurface · Schema · Spec · Identifier  │
│  └─ 타입, 레지스트리, 검증, 순수 TS          │
├─────────────────────────────────────────────┤
│  Indexing Layer (변경 없음)                   │
│  weighted-index · demo-snapshot · index-meta  │
│  └─ 수학, 어휘, 버전 관리, 프로토콜          │
├─────────────────────────────────────────────┤
│  External Semantic Layer (플러그인)           │
│  Policy · Ontology · Transition              │
│  └─ custom provider로 교체 가능              │
└─────────────────────────────────────────────┘
```

### 핵심 원칙

1. **NestJS는 호스트, 코어는 커널**: Nest의 Module/Provider는 조립 단위. 코어 타입은 Nest 없이도 동작해야 한다.
2. **decorator는 binding metadata**: source of truth는 spec/registry. decorator는 연결 수단.
3. **코어에 @nestjs/* import 금지**: core/ 디렉토리는 순수 TypeScript.
4. **indexing 레이어 변경 없음**: weighted-index, demo-snapshot 등 그대로. spec-engine이 소비자로 참조.

---

## 스펙 문서 목록

| 문서 | 내용 |
|------|------|
| [core-types.md](core-types.md) | ExportSurface, Schema(6종), PrefixSpec, SpecDocument, Registry API |
| [architecture.md](architecture.md) | NestJS 모듈 매핑, 계층 분리, decorator/interceptor 설계, 함정 방지 |
| [phases.md](phases.md) | 5단계 구현 계획 + 검증 기준 + 기술 스택 |
| [design-knowledge-graph.md](design-knowledge-graph.md) | Design Knowledge Graph — 설계 시점 메타데이터 그래프 (노드 12종, 엣지 18종, 성장 나선 모델) |
| [dkg-skills.md](dkg-skills.md) | DKG Skills — 종단 파이프라인, migrator 추론, VersionEvent 파생, Decision 템플릿, 8개 skill 카탈로그 |
| [spec-propagation.md](spec-propagation.md) | Spec Propagation — PrefixSpec 작성 → registry 고정 → 소비자 전파 → codegen → DKG 기록 종단 파이프라인 |
| [convergence-layer.md](convergence-layer.md) | Convergence Layer — 심볼 비교, 결정 비교, 인과 발견, 최소 가짓수, 경계 추천. 신경기호 검증 |
| [decision-standard.md](decision-standard.md) | 의사결정 표준 프로세스 — 새 요구 시 prefix 평가/생성 표준 경로, 7개 체크리스트, skill 매핑 |
| [prefix-guide.md](prefix-guide.md) | Prefix 실용 가이드 — 페이지/API/이벤트/권한이 모두 prefix, 환경 오버라이드 패턴, 관측 포인트 정의 |
| [axis-boundary.md](axis-boundary.md) | Axis Boundary — 축에 넣을 것과 넣지 않을 것. endpoint prefix 재설계. 미들웨어 자동 태깅 |
| [spec-linking-standard.md](spec-linking-standard.md) | Spec Linking Standard — 문서 간 참조 규칙. prefix↔spec↔decision 연결 형식 표준화 |
| [system-architecture.md](system-architecture.md) | System Architecture — 전체 구현 구조 (12모듈, 12노드, 18엣지, 11skill, 14수렴도구) |
| [temporal-relations.md](temporal-relations.md) | Temporal Relations — 시간 순서(trace 내 선후)와 데이터 흐름(prefix_ref 동적 추적) 수집 정의 |
| [next-phase-plan.md](next-phase-plan.md) | Next Phase — prefix 3가지 사용 모드(enum/로깅/권한), skills prefix화, 이벤트 수집 E2E, PartialBinder 통합 |
