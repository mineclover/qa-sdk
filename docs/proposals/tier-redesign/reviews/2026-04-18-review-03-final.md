---
status: superseded-by-d17
superseded_note: "D-16 관련 내용은 D-17 Pivot(FSM tier 제거)으로 무효화됨. 본 리뷰의 D-16 검증 항목은 역사 기록으로만 보관. 4층 정합 / Hybrid absorb / Form 1/2 개념은 D-17 이후 소멸."
date: 2026-04-19
reviewer: subagent (3rd / final)
target: STC proposal post-D-16 (superseded by D-17)
focus: [d-16-integration, cross-file-consistency, new-tensions, under-review-readiness]
previous_reviews: [review-01.md, facet-flow-simulation-review.md]
---

# STC Proposal — 3차 최종 리뷰 (D-17 Pivot 전)

> **⚠️ D-17 Pivot으로 무효화된 리뷰**: 본 리뷰는 D-16 Hybrid absorb를 전제로 한 검증이었음. 이후 사용자가 Pivot 방향을 택해 FSM tier 자체가 제거됨. 본 리뷰의 D-16 관련 검증 항목은 현재 proposal 상태와 일치하지 않음.

## 요약 (Executive Summary)

STC 제안은 1차 리뷰의 blocker 2 + important 7 + minor 10을 **문서에 추적 가능한 형태로** 반영했고, 2차 리뷰가 식별한 FSM Transition ↔ PipeTransitionScope 어휘 충돌은 D-16 "Hybrid absorb"로 정리되어 `scope_ref`를 통한 4층 정합 경로가 생겼다. Cross-file 일관성은 대부분 양호하다 — tiers/fsm.md, 02-fsm-composition.md, 03-decisions.md, rules/system-independence.md, examples/deterministic-label-record-fsm.md, mental-models.md, README 변경 이력이 D-16의 Form 1 / Form 2 + `transitionId` 공유 키 ﻿/ `implements` 잠정 LinkType 서술을 정합적으로 공유한다. 단 **네 곳의 잔존 drift**(01-migration.md §Phase 0 FSM schema 목록이 `states/events/gates/...`로 옛 어휘 유지, tiers/fsm.md Frontmatter spine 예시와 Marker 세트가 D-16 Form 2를 시각적으로 반영하지 않음, tiers/README.md 관계도가 4층 정합을 반영하지 않음, `^transition:<id>` 마커가 Form 2 (`scope_ref`)에도 동일하게 걸릴 때의 동기 검증 규칙 미명시)이 발견되었다. 이들은 모두 minor polish이며 under-review 전환을 차단하지 않는다. **Verdict: `yes-with-minor-polish`** — 승격은 가능하되 다음 업데이트 라운드에서 4개 잔존 drift를 정리 권장.

## Verdict

- **Ready for under-review**: `yes-with-minor-polish`
- 핵심 근거:
  1. 1차 리뷰 blocker 2건(R-2 결정 회피 + "해소 완료" 표기)은 `03-decisions.md:527~539` (정량 trigger 박제) + `README.md:186` ("Phase 0 결정 완료 (Pilot 실증 남음)" 표기)로 명시적 해소 확인.
  2. 2차 리뷰의 핵심 긴장점(FSM Transition ↔ PipeTransitionScope)은 D-16 + 6 파일 cross-ref (fsm.md / 02 / 03 / rules / pilot FSM / mental-models)로 정리되어 동일 진술 공유. Form 1/2 선택 기준표(`tiers/fsm.md:184~192`), 공존 금지 규칙, `transitionId` 공유 키가 세 곳 이상에서 일관 표현.
  3. 남은 drift 4건 모두 polish 수준 — 의미 충돌 아니며 Phase 1.B 구현 시점까지 자연 정리 가능.

## Target 1: D-16 통합 품질

### 1.1 경계 명확성

**평가**: 중상. Form 1 (inline) vs Form 2 (`scope_ref`) 선택 기준표가 `tiers/fsm.md:184~192`에 6행으로 정리되어 있다. 각 행이 "단순 상태 변경 / 여러 step 원자 경계 / compensate / 이벤트 카탈로그 연결 / read-only / write-mode"의 질문에 ✓ 또는 × 또는 "과도"로 명확 답변. 저자가 체크리스트로 직접 적용 가능.

**잔존 긴장**: 모호 케이스의 처리 규정이 없다. 예컨대 **"단순 write-mode execution이지만 compensate는 불필요한 전이"**는 기준표에서 Form 1의 "Write-mode execution → inline으로는 표현 한계"와 Form 2의 "compensate 필요 → ✓"가 교차. 두 행이 독립 조건이지 AND 조건이 아니라는 명시가 부재. `03-decisions.md:483` "Form 1/Form 2 경계 명확화 — 언제 Form 2로 승격할지 복잡도 기준 (현재는 저자 판단)"이 이 문제를 **미결**로 박제하므로 Phase 1.B까지 공식 경계 기준 미확정. Under-review 전환 자체는 차단하지 않으나 Pilot 저자가 직접 마주할 질문.

**권장**: Pilot 저자가 실제로 마주치면 `examples/deterministic-label-record-fsm.md § Pilot 관찰 사항`의 D-16 체크박스 근처에 관찰 기록 추가.

### 1.2 제약 일관성

"Form 1과 Form 2 공존 금지" 규칙은 3곳에서 동일 표현 공유:

- `tiers/fsm.md:193`: "**규칙**: `scope_ref`가 있을 때 같은 transition에 `<from>-<to>` inline 형태 **공존 금지**. 둘 중 하나만 사용."
- `03-decisions.md:466`: "`scope_ref`가 있을 때 같은 transition에 inline `<from>-<to>` id 공존 **금지** (둘 중 하나만)"
- `examples/deterministic-label-record-fsm.md:361`: 간접 — Pilot FSM 자체는 "모든 transition이 Form 1"이라 공존 문제가 발생하지 않는 쪽으로 회피.

**평가**: OK. 2곳의 규칙 진술이 동일 의미이며 3번째는 회피 사례로 정합. 유효한 cross-file 일관성.

**잔존 긴장**: `rules/system-independence.md:130` LinkType 표 "FSM Transition → PipeTransitionScope — 실행 위임 — `implements` (잠정)"은 공존 금지 규칙을 재천명하지 않음 — 규칙 면의 Consistency 관점에서는 이중 표기가 있어야 하나 rule 문서에 누락. 다만 D-16 본문이 rule 문서를 참조(`03-decisions.md:473`)하므로 간접 정합.

### 1.3 LinkType 선택

`rules/system-independence.md:130`은 "`implements` (잠정)"으로 D-16을 반영. `03-decisions.md:468` + `:482`는 "현재 `implements` 재사용 제안, Phase 1.B에서 결정"으로 동일하게 잠정 표기.

**평가**: 
- **장점**: 기존 LinkType 재사용은 스키마 변경 없이 D-16 흡수 가능 — `implements`의 의미 "계약 구현"을 "FSM transition이 실행 흐름을 PipeTransitionScope에 위임"으로 일반화하는 것은 자연스러운 확장.
- **위험**: `implements`의 기존 용법은 **System → FSM 계약 구현** (즉 "System이 FSM의 consumer contract를 실현"). D-16의 용법은 **FSM Transition → PipeTransitionScope 실행 흐름 위임** (즉 "FSM의 개별 transition이 하나의 원자 경계 실행 scope에 바인딩"). 의미 층위가 다름:
  - 전자: System이 FSM 전체를 구현 (tier-to-tier)
  - 후자: FSM 항목(transition)이 pipe 항목(scope)에 결속 (intra-tier element binding)
- `implements`의 semantics가 이중화되어 `def validate`가 두 용법의 허용/금지를 어떻게 판별할지 불명확.

**권장**: 별도 LinkType `delegates_to` 또는 `scoped_by` 도입이 개념적으로 더 깔끔. 다만 `03-decisions.md:482`에서 Phase 1.B 결정 대상으로 이미 open이므로 under-review 승격 차단 아님. 단 **mental-models.md § Model 4 교차 단위**에서 LinkType 축을 언급하지 않으므로 리뷰어가 이 선택의 결과를 놓치기 쉬움 — Phase 1.B 시점 결정 전까지 "잠정" 마크가 그대로 유지되어야 한다.

### 1.4 4층 정합 주장

`tiers/fsm.md:195~210` + `03-decisions.md:477`의 "4층 정합" 주장:

```
FSM tier (STC)          ──┐ (신규 층)
  state transition         │ transitionId
좌표 (PathSegment)       ──┤
  eventKey                 │  공유
PipeTransitionScope      ──┤
  body 원자 실행            │
TransitionDef            ──┘
  event catalog
```

**검증**:
- `docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md:77~110`의 3층 정합 원본이 이미 `좌표(PathSegment.transition.eventKey) ↔ PipeTransitionScope.transitionId ↔ TransitionDef.transitionId`로 공유 키 구조를 갖고 있다. STC는 여기에 "FSM tier"를 4번째 층으로 추가.
- **각 층의 역할이 실제로 구별되는가?**
  - FSM tier: 개념 계약 (consumer-facing "어떤 state가 있고 어떤 transition이 가능한가")
  - 좌표(PathSegment): 주소 공간에서의 전이 위치
  - PipeTransitionScope: 실행 흐름의 원자 경계
  - TransitionDef: 이벤트 카탈로그 등록
  - **4층이 실제로 직교**. 어느 하나 빠지면 정보 손실 — FSM 없이는 state/guard가 부재, 좌표 없이는 주소 decoding 불가, PipeTransitionScope 없이는 원자 경계 부재, TransitionDef 없이는 이벤트 카탈로그 연결 끊김.

**"어느 한 층 빠지면?"** 시나리오:
- **FSM 없음**: 기존 3층 정합 체계 그대로 (meta-semantic 독립 운용). D-16 이전 상태.
- **좌표 없음**: FSM + Pipe만 존재. 주소 공간 연결 안 됨 — FSM 문서가 있어도 실제 이벤트가 어느 coord에 해당하는지 모름.
- **PipeTransitionScope 없음**: Form 1 (inline) 전용. Pilot FSM이 정확히 이 상태. 단순 FSM에 충분.
- **TransitionDef 없음**: PipeTransitionScope만으로 원자 실행은 가능하나 이벤트 카탈로그 타입 추론 불가.

→ 각 층이 독립 가치를 가진다는 것이 형식적으로 검증됨. "4층 정합" 주장은 **개념적으로 성립**.

**잔존 긴장**: 4층 정합이 **실제로 작동**하려면 Form 2 사용 예시가 있어야 한다. 현재 Pilot FSM은 전부 Form 1이라 4층 정합의 실증은 없다(`examples/deterministic-label-record-fsm.md:361`의 D-16 체크박스 — "Write-mode transition controller가 구현되면 그 시점에 Form 2 사용 검토"). **Phase 3 Pilot 시점까지 4층 정합은 설계 수준 주장에 머문다**. 이것이 blocker는 아니나 Target 3의 새 긴장과 연결.

### 1.5 `transitionId` 공유 키 일관성

`tiers/fsm.md:179`의 Form 2 예시:
```yaml
scope_ref: pipe-transition-scope:approval-dispatch  # 외부 pipe 문서의 transitionId
```

주석이 "외부 pipe 문서의 transitionId"임을 명시. `03-decisions.md:467`은 "`scope_ref` 값은 기존 PipeTransitionScope 문서의 `transitionId`와 일치해야 함 (3층 → 4층 정합)"으로 규정.

**검증**: `docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md:43` 원본 타입 정의:
```ts
interface PipeTransitionScope {
  kind: "transition-scope";
  transitionId: string;
  ...
}
```

D-16 Form 2의 `scope_ref: pipe-transition-scope:<id>` 형식에서 `<id>`는 원본 타입의 `transitionId`에 해당. **Naming convention 일치**.

**잔존 긴장**: `pipe-transition-scope:` prefix는 D-16에 새로 등장한 URN-like 형식. meta-semantic 측에는 이런 prefix가 공식 정의되어 있지 않음 — `docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md`에는 URN 프리픽스 convention 없음. D-16이 `pipe-transition-scope:<transitionId>` 형태를 **단방향으로** 정의한 것인지, 기존 meta-semantic 어딘가에 존재하는 URN과 맞닿는지 불명확. URN 규칙의 소유자(STC인지 meta-semantic인지)가 Phase 1.B 결정 대상으로 남음.

### 1.6 Reversibility "high" 주장 검증

`03-decisions.md:479`: "가역성: high (각 FSM 문서에서 Form 1/Form 2 선택이 독립적 — Form 2 사용한 전이를 Form 1으로 내재화하거나 그 반대 변환 용이)"

**평가**: 
- **Form 2 → Form 1 (내재화)**: Form 2의 `scope_ref`가 참조하는 PipeTransitionScope의 `body`를 FSM 문서 내에 inline transition mapping으로 옮기면 됨 — **단, body가 단순 "from-state → to-state" 매핑이 아닌 복잡 실행 흐름이면 정보 손실 발생**. PipeFlow의 compensate / branch / retry 등은 inline Transition으로 표현 불가. 즉 Form 2 → Form 1 변환은 **lossy**.
- **Form 1 → Form 2**: 기존 inline transition에 대해 PipeTransitionScope 문서를 신규 작성 + FSM의 해당 transition에 `scope_ref` 부여. 신규 파일 작성이 필요하지만 복잡도는 낮음 — **lossless**.

**"high" 주장은 절반만 참**. Form 1 → Form 2는 high이나, Form 2 → Form 1은 정보 손실 가능. 단 D-16 문맥에서 "가역성"은 **FSM 문서 한 개만 보는 저자 관점**이면 각 transition 단위로 scope_ref 제거/추가가 독립적이라는 의미로 읽을 수 있고, 그 해석에서는 high가 맞음.

**권장**: `03-decisions.md:479`에 "단 Form 2의 PipeFlow body가 복잡(compensate/branch/retry)하면 Form 1으로 변환 시 정보 손실 — 실질적 일방향"이라는 주석 추가 권장. under-review 승격 차단 수준은 아님.

## Target 2: Cross-file 일관성

### tiers/fsm.md 의 Transition 섹션 vs 02-fsm-composition.md 5관심사 표현

- `tiers/fsm.md:35~42` "5가지 관심사 (ECS 분해 + 도메인 확장)"에서 4번 Transition을 "(from-state, event, guard) → to-state 매핑 + 실행 System/PipeTransitionScope 참조 (D-16)"로 정의.
- `02-fsm-composition.md:27~32`는 동일 5관심사를 "Transition (from, event, guard) → to 매핑 **또는** PipeTransitionScope 참조 (D-16)"로 정의.

**차이**: 미세. `tiers/fsm.md`는 "매핑 + 참조"(둘 다), `02-fsm-composition.md`는 "매핑 **또는** 참조"(둘 중 하나). D-16 본문(`03-decisions.md:466`의 공존 금지 규칙)은 후자가 정확. `tiers/fsm.md:40`의 "매핑 + 실행 System/PipeTransitionScope 참조"는 "+"가 "또는"으로 해석되어야 하나 표현이 약간 모호 (단순 read: "매핑과 참조를 동시에"로 읽힐 여지).

**Polish 필요**: `tiers/fsm.md:40`의 "+"를 "또는"으로 교체 또는 주석 추가. Under-review 전환 차단 수준은 아님.

### 03-decisions.md D-16 섹션 vs rules/system-independence.md LinkType 표

- `03-decisions.md:468`: "FSM transition → pipe-transition-scope 링크는 `implements` 또는 신규 LinkType (rules/system-independence.md에 반영)"
- `rules/system-independence.md:130`: "**FSM Transition → PipeTransitionScope** | **실행 위임** | `implements` (잠정)"

**평가**: OK. 두 진술이 동일 의미 ("`implements` 재사용은 잠정")이며, D-16 본문이 rules 문서를 참조하고 rules 문서가 해당 행을 표에 박아 넣었다. Round-trip 일관.

### examples/deterministic-label-record-fsm.md Pilot 관찰의 D-16 항목 vs 실제 FSM frontmatter 구조

- Pilot 관찰 `[x] D-16 적용 상태` (`:361`): "모든 transition이 Form 1 (inline 매핑). `scope_ref` 불필요."
- 실제 frontmatter `:38~49`의 `transitions` 배열: `draft-linted`, `linted-resolved`, `resolved-active`는 Form 1 inline 문자열. `non-terminal-deprecated`와 `any-archived`는 object form (`id:`, `from:`, `to:`, `event:` 필드). **모두 Form 1** (scope_ref 없음) — Pilot 관찰과 일치.

**평가**: OK.

### mental-models.md Model 2의 transition 설명 vs tiers/fsm.md 정의

- `mental-models.md:67~73`: "Transition — `(from, event, guard) → to` **또는** PipeTransitionScope 참조 (D-16)". Form 1 (inline) + Form 2 (scope_ref) + 4층 정합 간단 설명.
- `tiers/fsm.md:40` + `:152~210` 상세 정의.

**평가**: OK. mental-models.md가 tiers/fsm.md의 요약이고, 표현이 정합. `mental-models.md:71~73`의 두 Form 설명이 tiers/fsm.md의 선택 기준표(`:184~192`)의 "고수준 요약"이 됨.

### README 변경 이력의 D-16 기술 vs 실제 반영 범위

- `README.md:195`: "D-16 추가: FSM Transition ↔ PipeTransitionScope **Hybrid absorb**. Form 1 (inline) 또는 Form 2 (`scope_ref`) 선택. 4층 정합(좌표/흐름/이벤트/FSM) 공유 키 `transitionId`. meta-semantic 측 변경 없음. tiers/fsm.md + 02/03 + rules/system-independence.md + pilot FSM + mental-models.md 전원 반영"
- **실제 반영 확인**:
  - `tiers/fsm.md` ✓ (§ Transitions — 두 형태)
  - `02-fsm-composition.md` ✓ (`:27~32` 5관심사 중 Transition 갱신)
  - `03-decisions.md` ✓ (D-16 신규 섹션)
  - `rules/system-independence.md` ✓ (LinkType 표 `:130`)
  - Pilot FSM ✓ (`:361` D-16 체크박스)
  - `mental-models.md` ✓ (`:67~73` Model 2 Transition 설명)

**평가**: OK. README 변경 이력 6곳 주장과 실제 반영 6곳 일치 — 6/6 match.

### 잔존 drift 1: 01-migration.md §Phase 0의 FSM schema 목록

`01-migration.md:65`:
> "FSM tier schema 카테고리 세트: `states / events / gates / transitions / invariants` (+ evidence-shape 필요 시)"

**`gates`는 구식 어휘**. 다른 모든 문서에서 `guards`로 교체된 상태. 1차 리뷰 F-2가 `^gate:` 잔존분을 지적해 `^guard:`로 교체했으나 **이 문장의 `gates / transitions` 표현은 교체되지 않았음**. README 변경 이력의 "용어 정정: FSM의 `Gate` → `Guard`"(`:185`)가 "tiers/fsm.md + 02/03/FSM example에 일괄 반영"이라 선언했으나 **01-migration.md가 목록 밖**에 있어 누락.

**Severity**: Minor. Under-review 승격을 차단하지 않으나, Phase 0 산출물 명세 일관성을 해침. 0.5줄 수정으로 해결 가능.

### 잔존 drift 2: tiers/fsm.md Frontmatter spine 예시가 D-16 Form 2를 반영 안 함

`tiers/fsm.md:54~62`:
```yaml
# Frontmatter spine
tier: fsm
states:       [<id>, ...]
events:       [<id>, ...]
guards:       [<id>, ...]
transitions:  [<id>, ...]
invariants:   [<id>, ...]
```

**문제**: Form 2의 `scope_ref` 필드를 포함한 object form이 spine 예시에 없음. Spine은 "frontmatter의 기계 SSOT 모양"을 보여주는 곳이므로 D-16의 Form 2도 spine에 나타나야 한다. Form 2 예시는 `:169~180`에 별도 섹션으로 나오지만 **"Frontmatter spine" 섹션 자체**는 전통 5 필드만 보여줌.

**Severity**: Minor. 독자가 §"문서 구조 — Spine + Mirrored Sections"만 읽고 spine 필드 셋이 Form 1/2 공통이라고 오해할 여지.

### 잔존 drift 3: tiers/README.md 관계도가 4층 정합 반영 안 함

`tiers/README.md:23~36`:
```
Component ─┐
Entry ─────┘ (Component의 instance)
               ↑
               │ observes
FSM ───────────┘
  ↑
  │ implements
System ─────────→ Entry CRUD / compute
  ↑
  │ refs
Layout ─────────→ Systems 조직
```

**문제**: "FSM Transition → PipeTransitionScope" 4층 정합 관계가 관계도에 없음. D-16 이전 상태 그대로. README 변경 이력 "D-16 ... 전원 반영"이 tiers/README.md를 포함하지 않음.

**Severity**: Minor. tiers/README.md는 tier index 문서이므로 4층 정합은 범위 밖이라는 해석도 가능(4층 중 하나인 PipeTransitionScope는 STC tier가 아니니까). 단 FSM과 외부 meta-semantic 체계의 연결을 인덱스 레벨에서도 노출할 가치가 있어 Polish 대상.

### 잔존 drift 4: `^transition:<id>` 마커의 Form 2 처리 규정 부재

`tiers/fsm.md:80` Marker 세트: "`^state:` / `^event:` / `^guard:` / `^transition:` / `^invariant:` / `^evidence-shape:`"

`02-fsm-composition.md:91`: "`^transition:<from>-<to>` (또는 `<id>` alias 허용)"

**문제**: Form 2에서 transition이 `id: transition-approve-request` 형태로 선언되면 본문 마커는 `^transition:transition-approve-request` 이어야 할 것인데, D-7.4 "frontmatter↔본문 동기 검증 승격"이 Form 1/Form 2의 ID resolution 차이를 다루지 않음. Form 2 예시(`tiers/fsm.md:174~180`)의 transition id는 `transition-approve-request`이지만, 이 id가 마커에 어떻게 매핑되는지 본문에 명시 없음.

**Severity**: Minor. `def validate` 구현(Phase 1.B) 시 자연스럽게 드러나고 Pilot이 작동 시 관찰 가능. D-10 object form 명명이 이미 `id:` 필드를 허용하므로 일관성 있게 처리 가능. 단 under-review 전환 전 명시적 한 줄 추가("Form 2의 transition id도 `^transition:<id>` 마커로 앵커")가 권장됨.

## Target 3: D-16이 낳은 새 긴장점

### 긴장 3.1: FSM tier 단독 사용자 vs 4층 정합 체계 전체 따르는 사용자 간 학습 부담 격차

**문제**: Pilot FSM 예시는 Form 1만 쓰는 read-only projection이라 meta-semantic 이해 불필요. 반면 Form 2 사용자는 meta-semantic의 9 원자 개념 + pipe-impl 22+ leaf 체계를 이해해야 함. **난이도 단차가 크다**. 

- Form 1 사용자: FSM tier 문서만 읽으면 됨 (~250 lines)
- Form 2 사용자: FSM tier + `docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md` + PipeFlow 30종 (`pipe-flow-catalog.spec.md`) + ConnectionKind 8종 + (compensate 쓴다면) 추가로 compensate 원칙 (~수천 줄)

**관점**: D-16은 "필요할 때만 Form 2" 원칙으로 이 학습 부담을 opt-in으로 만들지만, Phase 3 Pilot이 Form 1만 다루면 **Form 2 경로의 실효성이 실증되지 않는다**. "필요할 때 쓸 수 있다"가 "실제로 쓸 수 있는지" 증명되지 않은 상태.

**권장**: 01-migration.md Phase 3 Pilot 선정 기준(`:177~184`)에 "Form 2 사용 예시 최소 1건 포함"을 추가 검토. 또는 Pilot 이후 Phase 4 초기에 별도 Form 2 실증 Pilot을 계획.

### 긴장 3.2: Form 2 선택 시 meta-semantic 전체 체계 이해 필요성

상세는 긴장 3.1 연장. Form 2는 `scope_ref`만 가볍게 두는 것처럼 보이나 **body PipeFlow 내부가 복잡**하면 compensate/branch/retry/enrich 등 PipeFlow 30종 중 대부분을 이해해야 함. 특히 FSM tier 저자가 "FSM만 쓰는 사람"이라면 이 깊이는 learning curve cliff가 된다.

**결론**: D-16의 Hybrid absorb는 STC에게는 싼 해법이지만(스펙 건드리지 않음), Form 2 사용 문서 저자에게는 **implicit dependency가 큰 해법**. 이 비용이 현재 proposal에 명시 안 됨.

### 긴장 3.3: PipeTransitionScope 변경 시 FSM 문서 추적 문제

`docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md`가 미래에 변경되면(예: `transitionId` 네이밍 convention 변경, 새 required 필드 추가) **FSM 문서의 `scope_ref` 값은 어떻게 추적되나?**

현재 상황:
- FSM tier는 **proposal 영역** (`docs/proposals/tier-redesign/`)에서 meta-semantic **정규 docs** (`docs/specs/meta-semantic/`)를 prose-ref로만 참조.
- Proposal은 `def sync` 그래프 밖이므로 meta-semantic이 `depends_on`/`implements` 엣지로 FSM 문서를 pull할 수 없음.
- 역으로 meta-semantic이 변경되어도 STC 제안은 trigger되지 않음.

**Accepted 이후 시나리오**: STC가 정규 spec으로 이식된 뒤에는 `def sync`가 FSM ↔ PipeTransitionScope 엣지(ScopedBy 또는 implements)를 추적 가능. 그러나 **현재 under-review 단계에서는 추적 메커니즘이 없음**.

**권장**: `03-decisions.md § D-16 관련 미결`에 "PipeTransitionScope breaking change 파급 메커니즘 — accepted 후 `def sync` 엣지로 해결"을 명시적으로 박제. 현재 "관련 미결"은 LinkType 이름과 경계 기준 2건만 있음.

### 긴장 3.4: FSM tier 문서가 격리된 proposal에서 정규 meta-semantic을 prose-ref하는 것의 READY 작동성

`tiers/fsm.md:171` + `:210`:
```markdown
[PipeTransitionScope](../../../specs/meta-semantic/pipe-impl/transition-scope.spec.md)
```

**현재 상태**: 상대 경로 prose 링크. Proposal 영역의 frontmatter `def:` 부재로 `def sync` 그래프 구성 안 됨. 그러나 링크 자체는 GitHub 렌더링 또는 local 뷰에서 작동.

**READY(under-review) 시나리오**: 리뷰어가 이 링크를 클릭해 meta-semantic 문서 읽기 → 이해 → STC 제안 평가. 작동 가능. 리뷰어의 meta-semantic 지식 수준이 전제이나, 이건 독자의 배경 이슈이지 proposal 설계 이슈는 아님.

**결론**: 현재 구조 READY에는 충분. 다만 **accepted 이후** 정규 spec 이식 시 이 prose-ref를 def 엣지로 변환해야 함 — 이는 `README.md § 수락 후 예상 산출물` 섹션이 담당할 미래 작업. 긴장이지만 proposal 범위 밖.

### 긴장 3.5: Write-mode transition controller 부재로 Form 2 예시 Pilot 검증 불가능성

**확인**: `examples/deterministic-label-record-fsm.md:361` Pilot 관찰의 D-16 항목이 명시적으로 "Write-mode transition controller가 구현되면 그 시점에 Form 2 사용 검토"라고 기록. 현재 read-only projection이므로 Form 2 필요 없음.

**Pilot 검증 가능 여부**:
- Phase 3 Pilot에서 Form 1 검증: ✓ (Pilot FSM이 Form 1)
- Phase 3 Pilot에서 Form 2 검증: **× (불가능 — 대상 write-mode controller 부재)**

**D-16이 새로 만든 긴장**: Form 2 경로의 실효성이 Phase 3 Pilot 기간 동안 실증 불가능. D-16의 "가역성 high" 주장 및 "4층 정합 자연 확장" 주장이 **설계 수준 주장에 머물고 실증 미확보**. 

**단 대응책**:
- 01-migration.md Phase 4A~4B 또는 Phase 5에서 Form 2 Pilot 확장 검토
- 또는 별도 도메인의 write-mode FSM 후보(Approval, Order 등)로 보강 Pilot

**평가**: 이것이 blocker 아님. D-16이 애초에 "설계 수준 흡수"이고 구현 검증은 accepted 이후 단계. 단 `03-decisions.md § D-16 관련 미결`에 이 실증 공백을 박제할 필요.

**권장**: `03-decisions.md:481` "관련 미결"에 3번째 항목 추가 — "Form 2 실증 Pilot 별도 계획 필요 (Pilot FSM은 read-only라 Form 2 미사용)".

## Target 4: Under-review 전환 점검

### 4.1 이전 blocker 해소 확인

#### Blocker 1: R-2 Entry 결정 회피

**해소 확인**:
- `03-decisions.md:527~539` R-2 섹션이 "Option A 확정 + 정량 trigger 박제"로 업데이트.
- Phase 2/3/4 각각에 정량 trigger 명시: Phase 2 < 3건 / Phase 3 사용 0건 / Phase 4 < 5건
- `tiers/entry.md:20~40`이 동일 trigger를 재천명 (Phase 별 trigger 표 + 기대값).
- README.md `:190` 변경 이력이 "R-2 Entry Option A 확정 + 정량 trigger 박제"로 명시.

**일관성**: 3 파일(03-decisions.md / tiers/entry.md / README)에서 trigger 값(< 3 / 0 / < 5) 동일. ✓

**판정**: 해소 완료.

#### Blocker 2: "Pilot 관찰 6개 해소 완료" 표기

**해소 확인**:
- `02-fsm-composition.md:263` 섹션 제목이 "Pilot 작성 중 발견 — Phase 0 결정 완료 (Pilot 실증 남음)"으로 변경.
- `02-fsm-composition.md:265` 추가 설명: "즉 '[x] = 결정 내려졌다'이지 '[x] = Pilot에서 작동 확인됐다'가 아님".
- README.md `:186` 변경 이력 "Pilot 관찰 6개 **Phase 0 결정 완료 (Pilot 실증 남음)**"

**판정**: 해소 완료.

### 4.2 Important 이슈 해소 확인

#### Important 1: Exit Criteria 정량화

**해소 확인**: `03-decisions.md:776~800` Exit Criteria 표가 "시점 / 트리거 / 판단 주체 / 방법 / 임계점 / 대응" 컬럼 구조로 재편. 정성 기준 각각이 판단 주체 명시:
- Phase 3 FSM schema 부적합: "Pilot 저자 + 리뷰어 2명 중 2명 이상 'schema가 실효 없음' 응답"
- Phase 3 FSM framing 어색: "Pilot 저자 + 리뷰어 2명 모두 'framing이 자연스럽지 않음' 응답"
- 임의 시점 STC 어휘 오용 > 5건/월: "수동 review 또는 `def validate` 로그"

**판정**: 해소 완료.

#### Important 2: 50~79% 구간 처리 룰 명시

**해소 확인**: `03-decisions.md:785` — "자동 분류 성공률 50~79% | 자동 측정 | **룰 보강 + 분류기 재실행**. 80% 미달 시 Phase 3 지연. 60% 미만이면 부분 재설계"

**판정**: 해소 완료.

#### Important 3: DKG CON-004 근거 보강

**해소 확인**: `01-migration.md:174` — "자동 분류 커버리지 ≥ 80% — **근거**: 본 목표는 DKG CON-004(`classificationRate >= 80%`, `CLAUDE.md § DKG Constraints` 참조)를 **참조 지표**로 삼음. 두 체계는 직접 연결되지 않고 독립 분류축이지만, 대규모 자동 분류의 **운영 가능 임계점**으로 80%는 공통 기준."

**평가**: "정렬한다"를 "참조 지표로 삼음 + 운영 가능 임계점 공통 기준"으로 약화. 1차 리뷰 Executive Summary 3번의 "근거 인용이 약함" 지적을 명시적으로 해소.

**판정**: 해소 완료.

#### Important 4: Phase 4 분할 4A/4B

**해소 확인**: `01-migration.md:196~231` — "### Phase 4 — 전체 전환 (4A + 4B 분할)" 섹션. 
- Phase 4A: "warning 유지" (4A 완료 조건 포함)
- Phase 4B: "warning → error 승격" (조건: "4A 완료 후 2~4주간 observation 기간 경과 + warning false positive 비율 확인")
- Exit Criteria: "Phase 4B 진입 시 false positive > 10% 측정되면 4A로 롤백"

**판정**: 해소 완료.

#### Important 5: R-7 counter-test + self-reference 회피

**해소 확인**: 
- `examples/deterministic-label-system.md:54~64` — "Counter-test (System이 아니라면 어땠을까?)" 표 추가. 4가지 반례로 R-7 구별력 검증 (Component + 헬퍼 / CLI command 1개 / 순수 변환 / trivial 예외).
- `examples/deterministic-label-system.md:66~68` — "self-reference 회피 주의" 섹션 추가. "state enum의 관찰 가능한 변화"를 lifecycle 판단 기준으로 재정의 (FSM implements에서 독립).

**판정**: 해소 완료.

#### Important 6: Operational positive list + scope creep trigger

**해소 확인**: `rules/classification.md:26~43` — "Operational instruction 면제 — positive list + scope creep 방지" 섹션 추가.
- 허용 패턴 5종 명시: CLAUDE.md, GEMINI.md, AGENTS.md, `.claude/skills/**`, `docs/skills/**/README.md`
- 명시적 불허: packages README, scripts, 기타 일반 문서
- Scope creep Exit Criteria: "예외 대상이 > 150건 초과 시 Exit Criteria trigger로 추가"

**판정**: 해소 완료.

#### Important 7: 직교성 정밀화

**해소 확인**: 
- `00-design.md:115~128` — "Independent classification axes (부분 상관)" 섹션 교체. "세 좌표계는 **완전 직교**가 아닌 **독립 분류축 + 권장 상관관계**로 공존"
- `03-decisions.md:656~697` "qa-sdk 기존 좌표계와의 관계" 섹션이 "STC는 세 번째 좌표계가 아니다... 독립 분류축으로 공존... 완전 직교는 아니며, 각 축은 다른 축의 값에 **권장 상관관계**를 가질 수 있다"로 수정.

**판정**: 해소 완료.

### 4.3 Minor 이슈 해소 확인

| # | 이슈 | 해소 여부 | 근거 |
|---|------|---------|------|
| 1 | `^gate:` → `^guard:` 01-migration.md 잔존 | **부분** | `^gate:` 마커 자체는 문서에서 제거되었으나 `01-migration.md:65`에 "`states / events / gates / transitions / invariants`" 옛 목록 표현 **잔존** (drift 1) |
| 2 | FSM `implementation_refs` + BLOCKED SSOT 예외 주석 | ✓ | `examples/deterministic-label-record-fsm.md:62~67` implementation_refs 필드 있음 / `:144` "D-9 SSOT 예외 처리 필요" 주석 |
| 3 | Layout 가설 System 주석 | ✓ | `examples/docs-control-plane-layout.md:66` `:74` — "⚠️ 가설적 System" 경고 박스 |
| 4 | D-15 `-system` 접미사 권장 convention | ✓ | `03-decisions.md:398~412` D-15 섹션 신설 |
| 5 | D-10 validation rules 명시 | ✓ | `03-decisions.md:319~329` "Validation rules (Phase 1.B 구현 기준)" 섹션 — `from` 필드 3형식, 빈 배열 금지, wildcard+list 조합 금지, id unique |
| 6 | tier-name vs tier 필드 구별 README 명시 | ✓ | `README.md:127~135` Frontmatter 필드 규칙 표. `tier`(예시 문서) vs `tier-name`(tier 정의 문서) 구별 |
| 7 | 정규 spec 위치 옵션 3개 제시 | ✓ | `README.md:159~174` "잠정 후보 위치" + `<scope>` 결정 옵션 3개 (definition-catalog / system / meta) |
| 8 | STC 명명 근거 보강 | ✓ | `00-design.md:25~30` "명명 근거 (STC)" 블록 — Semantic / Topological / Coordinate 3축 근거 + 대안 후보 명시 |
| 9 | FSM M:N System implements 허용 명시 | ✓ | `rules/system-independence.md:58` + `:63~80` M:N 관계 예시 (HR-system + procurement-system이 같은 approval-fsm implements) |
| 10 | Phase 0 산출물 파일명 정합 | ✓ | `01-migration.md:56` — "산출물: [03-decisions.md](./03-decisions.md) (Phase 0 결정 메모 — 원래 이름 ... proposal 이관 시 `03-decisions.md`로 개명)" |
| + | CLI tsup 번들 제약 언급 | ✓ | `01-migration.md:158~162` "구현 주의사항 (CLI 제약)" 섹션 |

**Minor 1 이슈 잔존**. 다른 10개는 OK. 

### 4.4 mental-models.md 정합성

#### 4 taxonomy 모델 + 관점(질의 조합) framing의 충돌 여부

- `mental-models.md:24~48` Model 1 (ECS = tier taxonomy): 5 tier 값이 `tiers/`의 5개 정의 문서와 1:1 일치. ✓
- `mental-models.md:51~85` Model 2 (FSM 내부 sub-taxonomy): 5 관심사(state/event/guard/transition/invariant)가 `tiers/fsm.md:35~42`의 5 관심사와 일치. Transition 두 형태(D-16) 반영. ✓
- `mental-models.md:88~126` Model 3 (doc-type taxonomy): 7 확장자 목록이 qa-sdk `doc-type-convention.spec.md` 기존 convention과 정합. ✓
- `mental-models.md:130~174` Model 4 (교차 단위): `tier × scope × aspect × layer × lifecycle × doc-type-ext × tags` 7축 교차. 03-decisions.md R-1 표와 호환. ✓

#### Model 1 (ECS = tier taxonomy) vs tiers/ 각 tier 정의 정합성

| mental-models.md Model 1 값 | tiers/ 각 문서 정의 | 정합성 |
|---|---|---|
| `component` — 데이터 shape / 공유 계약 | `tiers/component.md:12` "데이터 정의. 속성, 스키마, shape" | ✓ |
| `entry` — 구체 instance (R-2 조건부) | `tiers/entry.md:13` "Component에서 투영되는 구체화 단위" | ✓ |
| `fsm` — 상태 전이 계약, System 소비 인터페이스 | `tiers/fsm.md:12` "FSM은 System의 소비 인터페이스다" | ✓ |
| `system` — Operations 집합, R-7 3-check | `tiers/system.md:23` "Operations 집합... 독립 운용 가능한 단위" | ✓ |
| `layout` — systems의 조직적 배치, refs 기반 | `tiers/layout.md:22` "System을 도메인/서비스/목적에 맞게 배치하는 **소비 컨텍스트**" | ✓ |

**판정**: mental-models.md와 tiers/ 정의 완전 정합.

**추가 관찰**: mental-models.md § "네 모델의 관계"(`:244~263`) 다이어그램이 Model 1~3 + 기존 axes의 관계를 시각화. Model 2가 Model 1의 `fsm` 값에 종속된다는 점이 명확. 읽기 지도로서 기능 충분.

## 추가 발견 (비 체크리스트)

### 발견 A: mental-models.md가 LinkType 축을 언급하지 않음

Model 4 교차 단위 축 7개 목록(`:137~146`)에 `tier / scope / aspect / layer / lifecycle / doc-type-ext / tags`만 포함. **LinkType 축(contains/depends_on/implements/refines/constrains/traces_to + 신규 refs)**이 빠짐. D-16의 `implements` 잠정 재사용 이슈(Target 1.3)가 Model 4에서 추적 가능해야 하는데 현재 구조에서는 불가.

**Severity**: Minor. LinkType은 문서 **간** 관계 속성이지 문서 **자체**의 identity 축이 아니라는 해석 가능. Model 4가 단위(교차점) 정의에 초점이므로 LinkType은 Model 4 범위 밖으로 볼 수도 있음. 다만 "Taxonomy 교차 단위 관점"에서 LinkType 축이 누락된 것은 논리적 공백.

### 발견 B: Pilot FSM의 Transitions 섹션 본문과 frontmatter 대응 확인

`examples/deterministic-label-record-fsm.md`:
- Frontmatter `transitions:` (`:38~49`): 5개 (draft-linted / linted-resolved / resolved-active / non-terminal-deprecated / any-archived)
- 본문 `## Transitions` 섹션 (`:230~270`): 5개 블록 모두 있음, 마커 `^transition:<id>` 존재

**검증**: 5/5 match, 마커 ID 모두 frontmatter와 일치. 

### 발견 C: Pilot FSM Pilot 관찰 박스 상태

`:354~361` — 체크박스 7개 중 6개는 `[ ]` (Pilot 실행 전), 마지막 D-16 항목만 `[x]` (Form 1 적용 결론이 이미 도출됨). 이는 2차 리뷰 F-1의 "해소 완료 표기" 문제와 동일 패턴이나, D-16 항목은 **Phase 0 결정 + 현 시점 Pilot FSM이 Form 1임을 관찰한 결과**라 `[x]`가 타당.

**평가**: OK. 나머지 6개 `[ ]`는 Pilot 실행 후 체크됨을 예상. 표기 일관성 유지됨.

### 발견 D: 01-migration.md Phase 1.B 의존 그래프 시각화

`01-migration.md:137~156` — critical path 3갈래 다이어그램 추가. 1차 리뷰 Category C-2의 "critical path 3갈래로 명시" 권장 반영.

### 발견 E: `docs/superpowers/specs/` 이관 이력의 잔존 파일 체크

`README.md:181` 변경 이력 "`docs/superpowers/specs/`에서 `docs/proposals/tier-redesign/`로 이관". Superpowers 디렉토리에 구 파일이 없는지 확인:

- 구 경로 확인 생략 (git status / ls 시 해당 경로 미언급) — 이관 완료로 추정.

## 최종 권장

### 승격 판정

**승격 가능 (`yes-with-minor-polish`)** — Blocker 2건 + Important 7건이 모두 해소되었고 Minor 10건 중 9건 해소. 잔존 4개 drift(Target 2 섹션)와 D-16 관련 Polish 4건(Target 1 섹션)은 모두 0.5~2줄 수정으로 처리 가능한 polish 수준. 의미 충돌이나 설계 결함이 아니며 under-review 리뷰어가 이해하고 평가하는 데 장애 없음.

### 조건부 승격 (승격 동시 polish)

다음 4개 drift를 승격 직전 또는 직후 처리 권장:

1. **drift 1**: `01-migration.md:65`의 "`states / events / gates / transitions / invariants`"에서 `gates` → `guards` 교체. (1분 작업)
2. **drift 2**: `tiers/fsm.md:54~62` Frontmatter spine 예시에 D-16 Form 2의 `scope_ref` 사용 예시 1~2줄 추가. (2분 작업)
3. **drift 3**: `tiers/README.md` 관계도에 "FSM Transition → PipeTransitionScope (Form 2)" 외부 화살표 추가 또는 주석 1줄. (3분 작업)
4. **drift 4**: `02-fsm-composition.md § 3. Marker 세트`에 "Form 2 transition의 `id` 필드 값이 `^transition:<id>` 마커에 그대로 사용됨" 명시. (2분 작업)

추가 권장 polish:

5. `03-decisions.md § D-16 관련 미결`에 세 번째 항목 추가 — "Form 2 실증 Pilot 계획 별도 필요 (Pilot FSM은 Form 1만 사용)". (Target 3 긴장 3.5)
6. `03-decisions.md § D-16 가역성`에 Form 2 → Form 1 변환 시 정보 손실 주석 추가. (Target 1.6)

### Phase 1.A 조사 병행 시작 가능 여부

**가능**. 1차 리뷰 권장 "depth 조사는 blocker와 독립이므로 draft 상태에서도 착수 가능"을 현재 승격 시점에 적용 가능:

- Phase 1.A 3 조사 항목 모두 blocker 해소에 독립적:
  1. `depth` 필드 사용처 전수 조사 — D-6 결정 근거로 활용 (under-review 중 완료 가능)
  2. Layout-like `contains` 실사용 사례 조사 — D-4 영향 범위 확정
  3. Operational 문서 정책 결정 — D-2 확장 (이미 positive list 초안 있음)

Under-review 진입과 병행해 Phase 1.A 착수 권장. 결과는 under-review 리뷰 피드백 대응 시점에 함께 통합.

## Phase 진행 권장

1. **즉시 (이번 업데이트)**: README.md의 Status를 `under-review`로 전환, Reviewer 필드 기입. 상기 4 drift polish 병행.
2. **Under-review 초기**: Phase 1.A 3 조사 항목 착수. depth 사용처 + Layout-like contains + operational 정책. 
3. **Under-review 중**: 리뷰어 피드백 수집. D-16 LinkType 이름 확정 논의(`implements` 재사용 vs 신규 `delegates_to` 등).
4. **Accepted 전**: Phase 1.A 조사 결과를 기반으로 D-6 최종 결정 + D-4 영향 범위 확정 + D-2 operational 범위 확정. 이 3개가 fixed되면 accepted 승격 요건 충족.
5. **Accepted 직후**: Phase 1 구현 PRD 작성 시작 ([`README.md:117`의 accepted 기준 마지막 항목](/Users/junwoobang/workflow/qa-sdk/docs/proposals/tier-redesign/README.md)). Phase 1.B 6단계 의존 그래프(`01-migration.md:137~156`) 기반 구현.
6. **Post-accepted Form 2 실증**: Write-mode transition controller 구현 시점(stability plan 재개)에서 Form 2 사용 FSM 예시 1건 이상 작성해 4층 정합 실증.

---

**최종 verdict 재확인**: `yes-with-minor-polish`. D-16 통합은 구조적으로 건강하고, 3차 리뷰 대상 4 verification target 모두에서 중대 결함 없음. 4 drift는 merge 동시 polish 또는 under-review 초기 정리로 해결.
