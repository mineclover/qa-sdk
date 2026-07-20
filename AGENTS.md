# AGENTS.md — 멀티 에이전트 공용 작업 지침

> 이 파일은 qa-sdk 모노레포에서 작업하는 모든 에이전트(Claude Code, ralph-tui, Codex 등)가 따라야 할 공통 규칙을 정의한다.
> 프로젝트별 규칙은 `CLAUDE.md`, 아키텍처 상세는 `docs/`를 참조.

## 시스템 정체성

qa-sdk는 **차원 압축 기반 관측 시스템**이다. 두 가지 좌표 세계가 공존한다:

| 좌표 세계 | 대상 | 패키지 |
|-----------|------|--------|
| **공간의 좌표** | 서비스, 이벤트, 권한, 상태 | weighted-index, index-meta, @qa-sdk/core |
| **사고의 좌표** | 의사결정, 인지 모델, 에스컬레이션 | decision-flow |

두 세계는 동일한 인코딩 엔진(WeightedIndex)을 공유하며, `address_context` 형식으로 ingest 파이프라인에서 합류한다.

## 기존 연합형 연결 방향

qa-sdk는 ERP/CRM 등 원본 업무 시스템을 재구현하는 제품이 아니다. 기존 방향성은 원본 시스템이 데이터·업무 상태·local ID·권한을 계속 소유하고, qa-sdk가 그 사이의 식별자 규칙과 연결 상태를 보조하는 중간 연결 시스템으로 동작하는 것이다.

- `SourceRef`는 source namespace, entity type, local ID, revision을 보존한다.
- `ConnectionRef`는 qa-sdk의 연결 식별자이며 source local ID의 대체가 아니다.
- `Mapping`, `TypedRelation`, lineage, impact/evidence는 source identity와 분리해 관리한다.
- definition graph는 정의·문서 구조, DKG는 설계·결정 지식을 소유하며 federation relation graph와 합치지 않는다.
- 연결 identity/crosswalk를 `definition-catalog`, `dkg`, `engine` 중 한 곳의 부가 기능으로 임의 소유하지 않는다.

상세 운영 원칙: `docs/specs/system/federated-architecture-governance.rule.md`

## 의사결정 흐름 (decision-flow)

### 핵심 개념

```
FlowSchema  ≡ PrefixDef   (N차원 주소 공간)
GateSchema  ≡ Axis         (차원 = 분기점)
Branch      ≡ Entry        (선택지)
Path        ≡ 1D Address   (결정 경로 → 정수)
subFlowId   ≡ prefix_ref   (하위 플로우 참조)
```

### 계층 규칙

```
Level 0: strategic   ← office-hours, ceo-review
Level 1: tactical    ← eng-review, design-review, coordinate-design
Level 2: operational ← code-review, investigation
Level 3: execution   ← ship
```

- 상위 → 하위 제약 전파 허용
- 하위 → 상위 변경 금지 (에스컬레이션 필요)
- 계층 건너뛰기 금지 (중간 경유 필요)

### 컨텍스트 바운더리

| 컨텍스트 | 소유 | 역할 |
|----------|------|------|
| coordinate-design | 축/prefix/capacity 결정 | 루트 (import 없음) |
| sprint-execution | office-hours~ship | 스프린트 사이클 |
| dkg-governance | DKG 관측/수렴 | 설계 지식 관리 |
| platform-runtime | investigation | 서비스 운영 |

- 경계 횡단은 import/export 프로토콜로만
- import 없이 다른 컨텍스트 참조 → `boundary-crossing` 위반

### 코어 gate 규칙

- `weight: "core"` gate 변경 시 반드시 `flow analyze --impact` 실행
- `invalidatesCore: true` → 전체 재설계 필요. 단독 판단 금지, 에스컬레이션
- 코어 gate 3종: `axis-definition`, `prefix-design`, `merge-split`

### Autoplan 6원칙 (자동 판정 기준)

| 원칙 | 판정 |
|------|------|
| 확립된 표준 패턴 | 자동 채택 |
| 완전 구현 (boil the lake) | 자동 채택 |
| 테스트 추가 | 자동 승인 |
| 관측성 추가 | 자동 승인 |
| 보안 강화 | 자동 승인 |
| **위 5개에 해당 안 됨** | **인간 결정 (taste decision)** |

## 축 정의 규칙 (5Q Checklist)

새 축을 추가하려면 5가지 질문을 모두 통과해야 한다:

1. **Q1 유한?** — 값이 열거 가능하고 유한한가?
2. **Q2 의사결정?** — 이 차원이 의사결정이나 행동에 영향을 주는가?
3. **Q3 공유?** — 2개 이상의 prefix에서 사용되는가? (△도 허용하되 근거 필수)
4. **Q4 안정?** — 엔트리가 자주 변하지 않는가?
5. **Q5 capacity?** — `nextPowerOf2(entries.length × 2)` 이상으로 설정 가능한가?

## Prefix 정의 규칙

- prefix = 의사결정의 결과 단위
- 새 prefix → `PrefixMeta.category` 필수 (entity/event/relation/state/policy/observation)
- dims의 모든 axisId가 catalog.axes에 존재해야 함
- decision 도메인 prefix 5종: `decision_event`, `decision_path`, `escalation_event`, `model_apply`, `forcing_response`

## CLI 명령 체계

### flow (범용 의사결정)

```bash
qa-sdk flow list                           # 스키마 목록
qa-sdk flow start <schema-id>              # 플로우 시작
qa-sdk flow select <branch-id>             # 분기 선택
qa-sdk flow status [instance-id]           # 상태 조회
qa-sdk flow trace <instance-id>            # 코어 결정 추적
qa-sdk flow analyze <schema-id>            # 구조적 분석
qa-sdk flow analyze <id> --impact <gate>   # 영향 범위 분석
```

### arch (아키텍처 거버넌스)

```bash
corepack pnpm arch:feedback                # (권장) 통합 피드백 루프
corepack pnpm arch:check                   # 5계층 의존성 경계 검사
corepack pnpm arch:impact                  # API 및 소비자 영향도 분석
corepack pnpm arch:usage                   # 패키지 사용량 및 건강 상태
corepack pnpm arch:signals                 # 이벤트 신호 연결망 분석
```

### dkg decide (좌표계 설계 결정)

```bash
qa-sdk dkg decide --type new-axis          # 새 축 결정
qa-sdk dkg decide --type capacity          # capacity 변경
qa-sdk dkg decide --type merge             # merge/split 판정
```

`dkg decide`와 `flow`는 독립. 향후 `dkg decide`가 내부적으로 `coordinate-design` 플로우를 실행하여 통합 예정 (P4).

## 관찰 좌표 (address_context)

의사결정 이벤트는 기존 ingest 파이프라인과 동일한 형식으로 전송:

```json
{
  "decision_event": "decision_event:v1:1234",
  "model_apply": "model_apply:v1:7"
}
```

- `buildSelectionContext()`, `buildFlowCompletionContext()` 등으로 생성
- `EventRecord.address_context`에 머지
- convergence pipeline이 자동 집계 (DEMO_CATALOG에 등록됨)

## 인지 프레임워크 (Mental Models)

에이전트가 의사결정 시 적용할 수 있는 13개 인지 모델:

| 모델 | 핵심 질문 | 적용 시점 |
|------|----------|----------|
| bezos-doors | 되돌릴 수 있는가? | 모든 코어 gate |
| munger-inversion | 무엇이 실패를 만드나? | 아키텍처 결정 |
| jobs-subtraction | 빼면 핵심이 더 강해지는가? | 스코프 결정 |
| speed-calibration | 70% 정보로 충분한가? | 일정 판정 |
| boil-the-lake | AI가 완전 구현 비용을 제거했는가? | 구현 범위 결정 |
| three-layer | L1/L2/L3 중 어디서 판단하는가? | 기술 선택 |
| proxy-skepticism | 이 지표가 사용자 가치를 대변하는가? | 메트릭 결정 |
| edge-paranoia | 47글자 이름? 0개 결과? 네트워크 끊김? | 설계 리뷰 |
| design-trust | 사용자 신뢰를 쌓는가 허무는가? | UI 결정 |
| temporal-depth | 12개월 뒤 이 결정을 어떻게 평가할 것인가? | 전략 결정 |

## 6 Forcing Questions (Office Hours)

제품/기능의 근본적 타당성을 검증하는 질문. 새 기능 제안 시 활용:

1. **수요 현실** — 사라지면 화가 날 증거는?
2. **현재 상태** — 지금 어떻게 해결하는가?
3. **절박한 구체성** — 가장 필요한 실제 사람은?
4. **최소 쐐기** — 이번 주 유료화 가능한 최소 버전은?
5. **관찰** — 도움 없이 사용하는 걸 본 적 있는가?
6. **미래 적합성** — 3년 뒤 더 필수적인가?

## 문서 시스템 (definition-catalog)

모든 문서는 **좌표 체계**(tier × scope × aspect × depth)로 식별되고, authoring 기준은 **E/C/I/S + L/P 책임 분리**다.

**원칙: 모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다.**

### 문서 책임 (E/C/I/S + L/P)

| 책임 | 정의하는 것 | 문서화 규칙 |
|------|-----------|------------|
| **Entry / Identity (E)** | 안정 ID, 유한 값, singleton identity | 상태와 행위를 넣지 않는다 |
| **Component (C)** | data/state/evidence shape, validation vocabulary | data-only read model로 둔다 |
| **Interface / DSL (I)** | API/CLI/event/rule 소비 계약 | 별도 tier가 아니라 `scope: interface` 또는 rule/spec 계약으로 표현한다 |
| **System (S)** | 독립 behavior/runtime/transform boundary | behavior ownership과 source/test boundary를 닫는다 |
| **Layout / Pack (L/P)** | 여러 System/Interface의 조망, 배치, pack | `tier: layout` + `refs`; behavior/data ownership을 갖지 않는다 |

### 보조 검증 메타데이터 (DefLevel 3단계)

`level`은 contains 그래프 검증을 위한 보조 메타데이터다. 새 문서 분할과 책임 판정은 E/C/I/S + L/P를 먼저 사용한다.

| level | 질문 | 정의하는 것 | contains |
|-------|------|-----------|----------|
| **group** | "왜 함께 있는가" | 묶임의 이유 | → group \| module |
| **module** | "이 개념은 무엇인가" | 단일 개념 + 구성 참조 | → module \| leaf |
| **leaf** | "어떻게 동작하는가" | 최종 명세 (기본값) | → (없음) |

- group은 재귀 가능 (group → group → module → leaf)
- `level: group|module`: contains 자식 1건 이상 필수 (`validateGraph` 검증)
- leaf: contains 자식 금지. 150줄 초과 시 분할 경고

### 문서 유형 (DocType)

| type | 기록하는 것 |
|------|-----------|
| **spec** (기본) | 코드에서 파생 가능한 사실 — "시스템이 무엇으로 구성되어 있는가" |
| **knowledge** | 사람만이 기록할 수 있는 판단 — "왜 이렇게 설계했는가" |

knowledge 문서는 `knowledge_kind`로 세분화: philosophy, adr, guide, narrative, convention, pattern

### Markdown navigation health (Hyalo)

Hyalo는 Markdown 본문의 물리적 navigation link와 backlinks를 보조 점검하는 도구다. `def:` frontmatter, `def.links`, link type, owner/root, `sources`, `@def.*` 경계는 계속 qa-sdk `def sync`/`def validate`가 소유한다.

- 적용 범위는 정규 spec의 navigation health와 문서 이동 검토로 한정한다.
- 문서 본문의 내부 링크는 source 파일 기준 상대경로를 사용하고, `/Users/...`, `/docs/...` 같은 환경·vault 기준 absolute link를 새로 만들지 않는다.
- `docs/proposals/**`는 dry-run 보고만 허용하고, `docs/superpowers/**`와 archive는 신규 gate에 포함하지 않는다.
- 전체 문서군에 `hyalo lint --strict`를 적용하지 않으며, `links auto`, fuzzy 자동 수정, 대량 `mv`를 기본 실행하지 않는다.
- 상세 운영 기준: `docs/specs/system/markdown-navigation-health.rule.md`

### 스킬 관리

**SSOT**: `skills/` 디렉토리가 스킬 원본. 수정은 항상 repo에서 하고 동기화 스크립트로 전파.

```bash
# 동기화 (repo → 실행 환경)
./scripts/sync-skills.sh

# Claude Code 실행 환경
~/.claude/skills/

# Codex 실행 환경
~/.codex/skills/
```

스킬 수정 흐름: `skills/<name>/SKILL.md` 수정 → git commit → `./scripts/sync-skills.sh` → `~/.claude/skills/`, `~/.codex/skills/` 반영

### 주요 스킬

| 스킬 | 용도 |
|------|------|
| `/def-topdown <그룹ID>` | 시스템 탑다운 조립 |
| `/def-bottomup <문서ID>` | 변경 시 영향 역추적 |
| `/def-context <문서ID>` | 작업 전 컨텍스트 수집 |
| `/def-split` | 대형/혼합 책임 문서 분할 → E/C/I/S + L/P |
| `/def-new` | 새 스펙 문서 생성 |
| `/def-link` | 문서 간 링크 연결 |
| `/def-audit` | 문서 품질 감사 (level 검증 포함) |
| `/def-level` | contains 검증용 level 판별 |
| `/def-state` | 11개 상태 머신 + 게이트 + Cross-Loop |
| `/def-knowledge` | 지식 문서 조회/생성 유도 |
| `/def-explore` | 시스템 구조 탐색 |
| `/arch-governance` | 패키지 및 시그널 계층 거버넌스 |


### 문서 frontmatter 형식

```yaml
---
def:
  id: <고유 ID>
  type: <spec|knowledge>              # 선택 (기본: spec)
  knowledge_kind: <philosophy|adr|guide|narrative|convention|pattern>  # knowledge만
  level: <group|module|leaf>          # 선택 (기본: leaf)
  scope: <ui|feature|flow|state|constraint|data|interface>
  aspect: <세부 유형>
  depth: <overview|specification|implementation|validation>
  lifecycle: approved
  layer: <domain|operation|mediation|experience>  # 선택
  svc: <serviceId>      # 선택 — 서비스 레지스트리 연결
  tags: [<태그들>]      # 선택
  links:                # 선택
    - target: <대상 ID>
      type: <depends_on|implements|refines|constrains|traces_to|contains>
---
```

### 핵심 규칙

- 모든 approved 문서에 `## 목적 ^purpose` 필수
- 새 문서/분할은 E/C/I/S + L/P 책임을 먼저 정한다
- contains parent 문서는 `^overview` + `contains` 링크 필수
- 150줄 이상이거나 책임이 섞이면 `/def-split`으로 E/C/I/S + L/P 기준 분할
- `svc:` 필드로 서비스 레지스트리와 연결
- concern 태그(7종)만 BFS 전파. structural 태그(4종)는 비전파

### Cross-Loop 피드백 (하네스)

```
③ Gate complete → ② Harness compliant → ⑤ Decision context → ⑥ Doc lifecycle
```

초기화: `createDefinitionRuntime({ logger })` — 1호출로 전체 브릿지 연결.
상세: `docs/guides/definition-runtime-guide.md`

## 작업 시 필수 확인

- [ ] 작업 시작 시 변경 유형, owner, non-goal, baseline을 먼저 기록한다. 참조: `docs/specs/system/work-lifecycle.spec.md`
- [ ] behavior 변경은 `plan → cases → todo → test → implementation → spec` 순서를 지키고, 문서 정리는 semantic graph와 Markdown navigation을 분리한다.
- [ ] focused 검증 후 영향도 검증을 수행한다. 기존 baseline error/warning과 새 결과를 합산하지 않는다.
- [ ] 축 추가 → 5Q Checklist 통과 확인
- [ ] prefix 추가 → DEMO_CATALOG + DKG decision-domain에 등록
- [ ] 코어 gate 관련 변경 → `flow analyze --impact` 실행
- [ ] 계층 횡단 → 에스컬레이션 요청 생성 (직접 변경 금지)
- [ ] 경계 횡단 → import/export 프로토콜 확인
- [ ] address_context → `buildSelectionContext()` 등으로 생성 (하드코딩 금지)
- [ ] 문서 생성 → E/C/I/S + L/P 책임, tier, scope, aspect 결정. 참조: `definition-management.spec.md`
- [ ] group/module level 메타데이터가 있으면 contains 자식 1건 이상 확인
- [ ] 종단 문서가 150줄 초과 또는 혼합 책임이면 `/def-split`으로 분할
- [ ] 품질 게이트 → `createGateTracker({ listener: runtime.gateListener })` 패턴 사용
- [ ] 스킬 수정 → `skills/` 디렉토리에서 수정 후 `sync-skills.sh`로 전파 (실행 환경 직접 수정 금지)
- [ ] 작업 종료 → diff 범위, 잔여 todo/blocker, 검증 결과, 커밋 또는 미커밋 사유를 closure 기록으로 남긴다.

## 참조

| 문서 | 위치 |
|------|------|
| 좌표 체계 관리 가이드 | `docs/specs/definition-catalog/definition-management.spec.md` |
| 런타임 초기화 가이드 | `docs/guides/definition-runtime-guide.md` |
| Markdown navigation health 규칙 | `docs/specs/system/markdown-navigation-health.rule.md` |
| 하네스 아키텍처 | `docs/specs/definition-catalog/definition-harness-architecture.spec.md` |
| decision-flow 스펙 | `docs/specs/decision-flow/decision-flow.spec.md` |
| 프로젝트 규칙 | `CLAUDE.md` |
| gstack 레퍼런스 | [garrytan/gstack](https://github.com/garrytan/gstack) |
