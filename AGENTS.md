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

모든 스펙 문서는 frontmatter + `## 목적 ^purpose`로 관리된다. 5개 스킬로 조회/생성/분할:

| 스킬 | 용도 | 트리거 예시 |
|------|------|-----------|
| `/def-topdown <그룹ID>` | 시스템 탑다운 조립 | "gate 시스템 설명해줘" |
| `/def-bottomup <문서ID>` | 변경 시 영향 역추적 | "이거 바꾸면 뭐가 깨져?" |
| `/def-context <문서ID>` | 작업 전 컨텍스트 수집 | "gate-api 컨텍스트 줘" |
| `/def-split` | 대형 문서(150줄+) 분할 | "이 문서 분할해줘" |
| `/def-new` | 새 스펙 문서 생성 | "새 문서 만들어줘" |

### 문서 frontmatter 형식

```yaml
---
def:
  id: <고유 ID>
  scope: <ui|feature|flow|state|constraint|data|interface>
  aspect: <세부 유형>
  depth: <overview|specification|implementation|validation>
  lifecycle: approved
  svc: <serviceId>      # 선택 — 서비스 레지스트리 연결
  tags: [<태그들>]      # 선택
  links:                # 선택
    - target: <대상 ID>
      type: <depends_on|implements|refines|constrains|traces_to|contains>
---
```

### 핵심 규칙

- 모든 approved 문서에 `## 목적 ^purpose` 필수
- 그룹 문서 = `depth: overview` + `type: contains` 링크
- 150줄 이상이면 `/def-split`으로 분할
- `svc:` 필드로 서비스 레지스트리와 연결
- `tags: [tier-infra]` 등으로 서비스 기획 단위 분류

## 작업 시 필수 확인

- [ ] 축 추가 → 5Q Checklist 통과 확인
- [ ] prefix 추가 → DEMO_CATALOG + DKG decision-domain에 등록
- [ ] 코어 gate 관련 변경 → `flow analyze --impact` 실행
- [ ] 계층 횡단 → 에스컬레이션 요청 생성 (직접 변경 금지)
- [ ] 경계 횡단 → import/export 프로토콜 확인
- [ ] address_context → `buildSelectionContext()` 등으로 생성 (하드코딩 금지)

## 참조

| 문서 | 위치 |
|------|------|
| decision-flow 스펙 | `docs/specs/decision-flow/decision-flow.spec.md` |
| 프로젝트 규칙 | `CLAUDE.md` |
| gstack 레퍼런스 | [garrytan/gstack](https://github.com/garrytan/gstack) |
| P4 PRD | `tasks/prd-decision-flow-p4.md` |
| P4 JSON | `tasks/prd-decision-flow-p4.json` |
