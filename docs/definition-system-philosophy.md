---
def:
  id: definition-system-philosophy
  address: def_document:v2:137217
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, entry-point]
  links:
    - target: definition-catalog-spec
      type: refines
---
# Definition System — 문서화 철학

## 목적 ^purpose

소프트웨어를 구성하는 모든 정의를 **좌표계의 소비 방식**으로 분류하여, 체계적이고 반복 가능한 문서화 시스템을 구축한다. 하나의 서비스/모듈을 여러 관점(상수, 구현, 분기, UX, 비즈니스)으로 분해하되, 각 관점이 좌표 공간에서 고유한 위치를 가지게 하여 중복 없이 식별 가능하게 만든다.

## 동기 — 왜 이 시스템이 필요한가 ^intent

코드는 주소를 가지고, 그 주소에는 scope와 구현 의도가 있고, 연결에 대한 분석이 있다. 주제를 하나씩 분리하고, 트랜잭션을 하나씩 나눠서 보면, 그 상호작용은 결국 코드를 통해 발생한다. 이 단위들을 이해하고, 유도하고, 설계함으로써 **특정 좌표에 연관된 것들만 빠르게 조회할 수 있는 인프라**를 만드는 것이 핵심이다.

### 전체를 볼 필요는 없다

모든 영향을 볼 필요는 없다. 해당 좌표는 해당 좌표가 맡은 **고유한 역할**이 있다. 변경이 발생했을 때:

- **소규모 변경**: 고유 역할이 깨지지 않게 우회로를 마련한다
- **대규모 변경**: 해당 scope에 속하는 것들을 함께 변경한다

이 판단을 빠르게 내리려면, 좌표별로 "이 노드가 맡은 것"과 "이 노드를 경유하는 것"이 분리되어 있어야 한다.

### 주 기능과 경유 기능의 구분

좌표 속 모든 노드는 두 가지 역할을 가진다:

| 역할 | 설명 | 변경 시 영향 |
|------|------|------------|
| **주 기능** | 이 노드가 존재하는 이유. 삭제하면 기능이 소멸한다 | 직접 의존자 전체에 영향 (blast radius) |
| **경유 기능** | 다른 노드가 이 노드를 통과하여 사용하는 보조 경로 | 경유 경로를 우회시키면 영향 없음 |

예시: `DecoderPool`의 주 기능은 **디코더 캐싱**이다. 경유 기능은 **health 엔드포인트가 pool 크기를 보고하는 것**이다. DecoderPool의 TTL 로직을 변경하면 디코딩 전체에 영향이 가지만, health 보고 형식을 바꿔도 디코딩에는 영향이 없다.

이 구분이 문서에 반영되어 있으면:
- `qa-sdk def incoming DecoderPool` → 주 기능 의존자만 조회
- `qa-sdk def children decode-service-system` → 관점별 분해로 경유 기능 식별
- `POST /graph/:id/impact` → blast radius 계산 시 주/경유 구분

### 좌표 기반 작업 흐름

```
변경 발생
  ↓
1. 해당 좌표 조회: qa-sdk def get <id>
   → scope, layer, tags, links 확인
  ↓
2. 주 기능 확인: purpose + outgoing links
   → "이 노드가 무엇을 하는가"
  ↓
3. 경유 파악: incoming links
   → "누가 이 노드를 경유하는가"
  ↓
4. 영향 판단: POST /graph/:id/impact
   → blast radius, layer 경계 넘는지
  ↓
5. 결정
   ├── 소규모: 우회로 마련 → 기존 노드 유지
   └── 대규모: scope 내 함께 변경 → 관련 문서 일괄 갱신
```

## 핵심 원리 ^overview

### 1. 좌표계가 기본 분류 체계다

모든 문서는 3차원 좌표를 가진다:

```
scope(7) × aspect(22) × depth(4) → def_document:v1:<address>
```

**address는 분류 좌표이지 고유 식별자가 아니다.** 같은 scope×aspect×depth 조합이면 같은 address가 나온다 (예: feature/func_def/specification → 537에 77건). 문서의 유일한 식별자는 `doc_id`이며, address는 "이 문서가 어떤 종류인가"를 숫자로 표현한 것이다.

- **scope**: 이 정의가 소프트웨어의 **무엇**인가 (UI, 기능, 흐름, 상태, 제약, 데이터, 인터페이스)
- **aspect**: 그 중에서 **어떤 측면**인가 (레이아웃, 기능정의, 프로세스흐름, 도메인상태, API계약 ...)
- **depth**: **얼마나 깊이** 다루는가 (개요 → 명세 → 구현 → 검증)

같은 대상이라도 scope×aspect가 다르면 다른 문서다. `gate-engine`이라는 하나의 모듈에 대해:

| 문서 | scope | aspect | 보는 관점 |
|------|-------|--------|----------|
| gate-state-model | state | domain_state | 4-state 모델 정의 (active/inactive/open/reserved) |
| gate-engine-core | feature | func_def | recompute/cascade 구현 로직 |
| gate-flow | flow | process_flow | encode→check→propagate 흐름 |
| gate-constraint | constraint | tech_constraint | 불변 조건과 보안 제약 |
| gate-api | interface | api_contract | RPC 엔드포인트 명세 |
| gate-scenario | feature | scenario | 검증 시나리오와 기대 결과 |

이것이 **하나의 서비스를 다각도로 해석하는 것**이다.

### 2. 소비 방식이 분류를 결정한다

좌표계의 축은 정보의 **정의**이고, 소비 방식은 소비자의 **책임**이다 (Axis 원칙). 문서 분류에서도 같은 원리가 적용된다:

| 소비 방식 | 문서에서의 역할 | 해당 scope/aspect |
|-----------|---------------|------------------|
| **상수** — 시스템이 사용하는 고정값 | enum 값, capacity, 포트 번호, 유효 조합 | data/domain_data, constraint/tech_constraint |
| **구현** — 코드가 실제로 하는 일 | 함수 시그니처, 알고리즘, 상태 전이 | feature/func_def, state/domain_state |
| **분기** — 시스템의 조건부 경로 | if/switch, 플래그, 모드, 게이트 | flow/process_flow, state/system_state |
| **UX** — 사용자 경험 설계 | 레이아웃, 인터랙션, 위자드 | ui/layout, ui/interaction, ui/component |
| **비즈니스 핵심** — 도메인 규칙 | 정책, 권한, 검증 규칙 | constraint/biz_constraint, feature/scenario |

하나의 서비스에서 이 5가지 관점을 분리하면:
- 상수가 바뀌면 data 문서만 수정
- 구현이 바뀌면 feature 문서만 수정
- UX가 바뀌면 ui 문서만 수정
- **중복이 없고, 영향 범위가 명확하다**

### 3. layer는 존재 이유를 분류한다

scope×aspect가 "무엇에 대한 어떤 측면"이라면, layer는 "왜 이것이 존재하는가"를 표현한다:

| layer | 질문 | 삭제하면 |
|-------|------|---------|
| domain | "이것이 참인가?" | 비즈니스 진실 소멸 |
| operation | "시스템이 돌아가는가?" | 성능 저하 |
| mediation | "소비자가 쓸 수 있는가?" | 유저 불편 |
| experience | "행동을 유도하는가?" | 유도 소멸 |

scope(구조)와 layer(존재 이유)는 **직교**한다. 같은 `feature/func_def`라도 domain(비즈니스 핵심)과 operation(인프라)은 영향 전파 경로가 다르다.

### 4. 관계형 링크가 문서 간 구조를 만든다

6종 링크로 문서 그래프를 구성한다:

| 링크 | 의미 | 예 |
|------|------|-----|
| contains | 그룹 → 멤버 | gate-system → gate-engine-core |
| depends_on | 이것 없이 동작 불가 | gate-api → gate-state-model |
| refines | 상위 개념의 구체화 | gate-engine-core → gate-system |
| constrains | 불변 조건 부과 | gate-constraint → gate-engine-core |
| implements | 명세의 구현 | gate-engine-spec → gate-api |
| traces_to | 추적 가능한 연결 | gate-scenario → gate-flow |

이 링크 구조가 제공하는 것:
- **역추적(bottomup)**: "이 문서를 바꾸면 어디에 영향?"
- **탑다운(topdown)**: "이 시스템의 멤버 목록과 각각의 목적"
- **concern 전파**: security 태그가 depends_on 링크를 따라 하위로 전파
- **검증**: 깨진 링크, 순환 참조, 고아 문서 자동 탐지

### 5. DB가 메타데이터 SSOT, 파일이 본문 SSOT

```
파일 소유: id, address, body (purpose/intent/context/caveat)
DB 소유:  scope, aspect, depth, lifecycle, layer, tags, links, svc
```

- 메타데이터 변경 → `PATCH /docs/:id` → DB 업데이트 → `POST /sync/to-files` → frontmatter 갱신
- 본문 변경 → 마크다운 편집 → `POST /sync` → DB에 body/markers 반영
- 양방향 동기화로 git 가독성과 DB 정합성을 동시에 보장

### 6. 반복 가능한 문서화 패턴

새 서비스/모듈을 문서화할 때의 표준 패턴:

```
1. 그룹 문서 생성 (scope: feature, depth: overview, contains 링크)
2. 관점별 분해:
   - 상태 모델      → state/domain_state
   - 핵심 기능      → feature/func_def
   - 처리 흐름      → flow/process_flow
   - 기술 제약      → constraint/tech_constraint
   - API 계약       → interface/api_contract
   - 검증 시나리오  → feature/scenario
3. 링크 연결: contains(그룹→멤버), depends_on, constrains
4. 메타데이터: layer, svc, tags 부여
5. address 자동 계산: scope × aspect × depth → def_document:v1:<N>
```

이 패턴을 반복하면:
- 어떤 서비스든 **같은 구조로** 문서화된다
- 새 관점이 필요하면 **aspect 추가**로 확장된다
- 기존 문서와 **자동으로 비교 가능**해진다 (같은 좌표 공간)

### 7. 식별자가 참조의 단위다

소프트웨어의 모든 역할 있는 단위는 식별자를 가지며, 문서는 그 식별자를 통해 대상에 연결된다.

| 식별자 유형 | 예시 | 문서 연결 방식 |
|------------|------|--------------|
| prefix ID | `order_event`, `rbac` | `target_prefix` 컬럼 → prefix_registry |
| 서비스명 | `decode-service` | `svc` 컬럼 → 서비스별 문서 필터 |
| 문서 ID | `gate-state-model` | `doc_id` PK + `document_links` edge |
| 함수/클래스 | `resolveDecoder()` | 문서 본문에서 참조, purpose에 명시 |
| 상수/enum | `GateWeight.core` | constraint 문서에서 정의, feature 문서에서 소비 |
| 환경변수 | `CACHE_TTL_MS` | config 섹션에서 정의, constraint에서 제약 |

이 구조의 핵심: **코드에서 식별자가 추가/변경되면, 문서에서도 해당 식별자가 추적 가능해야 한다.** `target_prefix`는 이 원리의 첫 구현 — prefix라는 대상 식별자를 문서가 명시적으로 참조한다.

```
코드: export const CACHE_TTL_MS = 60_000;
  ↕ 식별자 참조
문서: dec-svc-constraints (constraint/tech_constraint)
  "CACHE_TTL_MS: 캐시 TTL 60초"
  ↕ doc_id 참조
DB: documents.doc_id = 'dec-svc-constraints', target_prefix = null, svc = 'decode-service'
```

### 8. 의사결정이 문서를 만들고, 문서가 DB를 업데이트한다

문서는 자연 발생하지 않는다. 의사결정의 산출물이며, DB에 기록되어 다음 의사결정의 입력이 된다.

```
① 의사결정 발생
   decision-service: FlowInstance 생성
   gate 선택 + evidence 기록

② 산출물 결정
   outcome.artifactType → suggestScopeFromArtifact() → scope 추론
   verdict → suggestLifecycleFromVerdict() → lifecycle 결정

③ 문서 생성/변경
   frontmatter: id + address (파일 소유)
   본문: purpose/intent/context (파일 소유)

④ DB 동기화
   POST /sync → 문서 → DB (body, markers, address 계산)
   POST /sync/to-files → DB → 문서 (메타데이터 역동기화)

⑤ 연결 기록
   decision-service: flow_links (instance_id → doc_id, link_type)
   definition-service: document_links (doc → doc, 6종 관계)

⑥ 다음 의사결정의 컨텍스트
   ContextProvider.provide(schemaId, { existingDocs, constraints, concerns })
   → 기존 문서가 새 결정의 입력이 됨
```

이 순환이 반복될수록:
- 문서가 쌓인다 → DB의 검색/분석 역량이 강화된다
- 의사결정 이력이 쌓인다 → 패턴 감지 → 정책 자동화
- 식별자 참조가 촘촘해진다 → 영향 분석(blast radius)이 정확해진다
- **시스템이 자기 자신을 문서화하는 구조가 된다**

### 9. 관측 가능하고 설명 가능한 상위 레이어

이 시스템의 최종 목표는 **적절한 지침 없이는 변경이 일어나지 않는 구조**를 만드는 것이다. 변경 자체를 막는 것이 아니라, 영향 범위를 명확하게 보여주어 자연스럽게 검토와 의사결정이 따라오게 한다.

#### 경고 수준

| 의존자 수 | 수준 | 시스템 반응 |
|-----------|------|-----------|
| 0건 | 안전 | 자유 변경 — 리프 노드 |
| 1~2건 | 주의 | 개별 확인으로 충분 |
| 3건+ | 경고 | scope 내 형제 일괄 표시 + 의사결정 기록 권장 |
| 제약 존재 | 필수 검토 | constraint 문서의 purpose 표시 + 위반 여부 확인 |

#### CLI 도구

```bash
# 영향 분석 — 주 기능/경유 구분 + blast radius + 변경 규모 판단
qa-sdk def impact gate-state-model
  → ⚠ 대규모 변경 (의존자 4건) — scope 내 일괄 검토 필요
  → scope: gate-system (7 members) 표시

# 변경 전 체크 — 경고/에러 요약
qa-sdk def check gate-state-model
  → ⚠ 의존자 4건 — 의사결정 기록 권장 (qa-sdk flow start scope-expansion)
```

#### 왜 "관측 가능"이어야 하는가

변경의 영향을 **사후에 추적**하는 것이 아니라, **사전에 보여주는** 것이 핵심이다. 코드를 변경하기 전에 `def impact`를 실행하면 blast radius가 보이고, 그 결과를 보고 변경 전략(소규모 우회 vs 대규모 일괄)을 결정한다. 이 판단 과정 자체가 `decision-service`에 기록되고, 문서에 반영되고, 다음 변경의 컨텍스트가 된다.

```
코드 변경 의도
  → def impact (blast radius 확인)
    → def check (경고/제약 확인)
      → flow start (의사결정 기록, 3건+ 의존자 시)
        → 코드 변경 실행
          → def sync (문서 갱신)
            → flow links (결정→문서 연결)
              → 다음 변경 시 이 모든 이력이 컨텍스트
```

### 10. 에이전트 하네스로서의 좌표 시스템

이 시스템은 장기 실행 에이전트의 **하네스(harness)** — 확률론적 모델을 감싸는 결정론적 레이어 — 로 동작한다.

#### 하네스 설계 원리와의 대응

| 하네스 원리 | 이 시스템의 구현 |
|------------|----------------|
| **SSOT (타입 안전 스키마)** | DEMO_CATALOG → codegen → demo-types. prefix가 enum/타입의 SSOT. 에이전트는 하드코딩 대신 prefix SDK로 값을 조회 |
| **결정론적 검증** | `def validate` (깨진 링크/순환), `def check` (경고 임계), tsc --noEmit, vitest |
| **컨텍스트 관리** | CLAUDE.md(346줄, 매 세션 자동 로드) + memory(34파일) + DB(500건 문서). 세션 간 연속성 |
| **구조화된 인수인계** | frontmatter(id+address) + DB sync + document_history(버전 이력). 에이전트가 바뀌어도 문서 상태는 DB에 |
| **자기 치유 루프** | `def impact` → `def check` → 경고 시 의사결정 강제 → 문서 갱신 → 재검증 |
| **적대적 평가** | decision-flow의 evaluator phase. constraint 문서가 변경을 제한. `def check`가 위반 감지 |
| **에이전트 가독성** | 좌표 기반 문서 분류 → `def get/children/search`로 즉시 탐색. entry-point 태그로 진입점 표시 |

#### 변수를 제어하는 SDK

이 시스템이 prefix SDK, codegen, enum 타입을 제공하는 이유:

```
prefix 정의 (DEMO_CATALOG)
  → codegen → TypeScript 타입 (demo-types)
    → 에이전트/코드가 타입을 import하여 사용
      → 하드코딩 대신 prefix SDK 조회 (encodePrefix, decodePrefix)
        → 시스템이 변수 공간을 제어
```

에이전트(LLM)가 이벤트 이름을 "자유 문자열"로 생성하면 통제 불가능하다. prefix가 이벤트 이름의 SSOT이고, SDK가 유일한 접근 경로이므로, **시스템이 변수를 제어**한다. 에이전트가 새 이벤트를 만들려면 prefix를 먼저 등록해야 하고, 등록은 의사결정을 거치고, 의사결정은 문서를 만들고, 문서는 DB에 기록된다.

#### 컨텍스트 불안 대응

| 문제 | 하네스의 해결 |
|------|------------|
| 컨텍스트 창이 채워지면 정밀도 저하 | CLAUDE.md 346줄로 압축. 상세는 `def get`으로 필요 시 조회 |
| 세션 간 기억 없음 | DB SSOT + memory 파일 + document_history |
| 자기 평가 실패 (자신의 출력에 관대) | `def check` 경고 + constraint 문서 + decision-flow evaluator |
| 범위 확산 | scope 분류 + `def impact` blast radius + 임계값 경고 |

#### 보완이 필요한 영역

| 영역 | 현재 | 필요 |
|------|------|------|
| 적대적 평가 자동화 | decision-flow에 evaluator phase 존재, 수동 | CI/CD에서 `def validate` + `def check` 자동 실행 |
| 스프린트 계약 | decision-flow의 gate 시스템 | gate 완료 시 자동으로 문서 생성 트리거 |
| 소형 모델 QA | 미구현 | 별도 검토 에이전트가 `def check` 결과를 평가 |
| OTEL 연동 | prefix가 이벤트명 SSOT이지만 런타임 연결 미구현 | ingest-server에서 prefix→definition 참조 |

## 요약

```
좌표계 (scope × aspect × depth)
  └── 소비 방식 (상수/구현/분기/UX/비즈니스)으로 관점 분해
        └── layer (domain/operation/mediation/experience)로 존재 이유 분류
              └── links (6종)로 관계 구조화
                    └── 식별자 (prefix, svc, doc_id)로 대상 참조
                          └── DB가 메타데이터 SSOT
                                └── 의사결정 → 문서 → DB → 다음 의사결정 (순환)
                                      └── 관측 + 경고 → 지침 없는 변경 방지
                                            └── 에이전트 하네스: 변수 제어 + 컨텍스트 관리 + 자기 치유
```
