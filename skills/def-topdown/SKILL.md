---
name: def-topdown
description: "definition-catalog 탑다운 조회. 시스템/그룹에서 시작하여 멤버 문서의 purpose/overview를 scope 순서로 조립한다."
---

# Definition Catalog — 탑다운 조회

시스템/도메인 루트에서 출발해 **구조 멤버** 와 **소비자** 를 분리해 훑어 내려간다. `collectDomainRelations` (`packages/cli/src/commands/def.ts:867`) 는 두 묶음을 별도로 반환한다:

- **members (구조)** — `contains` 순방향 ∪ `refs` 순방향 ∪ `refines` 역방향. 그룹/시스템의 본체.
- **consumers (소비)** — `depends_on` 역방향. 이 문서를 사용하는 dependents — 멤버처럼 표시하지 않는다.

기본 출력은 members 만 보이고, `--with-consumers` 플래그가 있을 때만 consumer 섹션이 추가된다.

> 신규 기여자라면 본 명령 이전에 `qa-sdk def doctor` 로 시스템 전반의 건강도부터 점검할 것 — `skills/def-doctor/SKILL.md` 참조.

## 실행

```bash
qa-sdk def topdown <그룹ID>
qa-sdk def topdown <그룹ID> --overview
qa-sdk def topdown <그룹ID> --with-consumers       # 의존자 섹션 추가
```

예:
```bash
qa-sdk def topdown gate-system
qa-sdk def topdown apm-system --with-consumers
qa-sdk def topdown ingest-system
```

## 멤버 / 소비자 탐색 규칙

`collectDomainRelations(groupId)` 는 두 리스트로 분리한다 (중복 제거, scope 정렬).

**members 경로:**
1. **contains 순방향** — `getChildren(groupId)`. 전통적 group 선언.
2. **refs 순방향** — `parent.links` 중 `type === "refs"`. **Layout/Pack 이 독립 System/Interface 를 조망** 하는 시멘틱.
3. **refines 역방향** — `getIncomingLinks(groupId).filter(l => l.type === "refines")`. 추상 → 구체 파생 문서.

**consumers 경로 (별도):**
- **depends_on 역방향** — `getIncomingLinks(groupId).filter(l => l.type === "depends_on")`. Option B 이후 incoming depends_on 이 membership 처럼 쓰인 케이스가 있었지만, 일반 의존자도 같은 경로에 걸리므로 UX 에서는 **별도 consumer 섹션** 으로 분리.

## 출력

```
# <그룹 제목>
<그룹 purpose>
concerns: <tags>

## [scope] [level] <제목>
via: contains|refs|refines←
<purpose>
...

## 관련 소비자/의존자 (incoming depends_on)   ← --with-consumers 일 때만
- [depends_on←] <docId>  <scope>/<aspect>  <lifecycle>
  <purpose 발췌>
```

scope 정렬: constraint → data → feature → flow → interface → state → ui

### 실제 출력 예 — `gate-system --with-consumers`

`tier: layout` 인 gate-system 은 `contains` 자식이 없고 `refs` 6 개로 독립 시스템들을 조망한다.

```
# Gate 시스템
주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.
concerns: security

## [feature] Gate API
via: refs
GateEngine 외부 계약 — register/check/exit 흐름.

## [feature] Gate Engine Func
via: refs
주소 상태 자동 재계산 라이브러리.

## [flow] Gate Flow
via: refs
gate 도입/해제 흐름.

## [interface] Gate State Model
via: refs
주소 4-state FSM.

## [constraint] Gate Constraint
via: refs

## [feature] Gate Scenario
via: refs

## 관련 소비자/의존자 (incoming depends_on)
- [depends_on←] gate-engine-group        feature/func_def        approved
- [depends_on←] gate-engine-group-cases  feature/func_def        approved
- [depends_on←] gate-consistency         flow/func_def           approved
- [depends_on←] gate-consistency-cases   flow/func_def           approved
- [depends_on←] gate-event-bus           interface/func_def      approved
- [depends_on←] gate-event-bus-cases     interface/func_def      approved
- [depends_on←] query-system             interface/func_def      approved
```

(6 members via `refs` + 7 consumers via `depends_on←` — 정확한 카운트는 도큐먼트 변경에 따라 변동)

## 자식 재확인

`def children` 도 동일한 분리 모델을 사용한다. 구조 멤버와 소비자가 별도 묶음으로 출력되며 각 항목의 via 가 `contains` / `refs` / `refines←` / `depends_on←` 중 무엇인지 표시한다.

```bash
qa-sdk def children gate-system
# [local] gate-system → 6 members + 7 consumers
#   gate-api              feature/func_def    approved   (refs)
#   gate-engine-group     feature/func_def    approved   (depends_on←)
#   ...
```

## Rule 문서 발견하기

`*.rule.md` 규약 문서는 별도 확장자로 분류된다. CLI 필터로 단번에 조회한다 (카운트는 변동하므로 명령으로 위임).

```bash
qa-sdk def list --type=rule          # *.rule.md 만 나열
qa-sdk def list --ext=rule           # 동일 — 일반 ext 필터
qa-sdk def list --ext=cases          # *.cases.md — consumer-driven 기대 시나리오
qa-sdk def list --ext=test           # *.test.md — provider 테스트 문서
```

system-wide rule 인덱스 + 개요는 [`docs/specs/system/README.md`](../../docs/specs/system/README.md) 에서 조회한다. workflow-smoke Scenario D 가 `--type=rule` 카운트 ≥ 8 을 보장한다.

## 사용 가능한 그룹

```bash
qa-sdk def audit --by-domain      # 도메인 루트 후보 + 멤버 수
qa-sdk def list --domain-root <rootId>  # 도메인 전체 나열
qa-sdk def stats                  # level/scope 분포
```

## 도메인 루트에서 드릴다운 — 4-step

```bash
# 1. 루트 후보 확인
qa-sdk def audit --by-domain

# 2. 특정 도메인 전체 나열
qa-sdk def list --domain-root gate-system

# 3. topdown 으로 멤버 purpose 한 번에 훑기
qa-sdk def topdown gate-system

# 4. 특정 멤버 구현 경로
qa-sdk def body gate-consistency
```

도메인 루트가 아직 파생되지 않는 시스템(자기 자신이 root 인 경우)은 `def audit --by-domain` 의 top 리스트에 다수 1~2건 루트로 노출된다.

## 계층 맥락

본 skill 은 **L3 workflow navigation skill**. `collectDomainRelations` 의 멤버/소비자 분리 모델 (members = `contains ∪ refs ∪ refines←`, consumers = `depends_on←`) 을 시연한다.

| 요소 | 계층 |
|------|------|
| 링크 그래프 (contains / refs / refines / depends_on) | L1 data |
| `collectDomainRelations` 구현 (`def.ts:867`) | L2 validator/파생 헬퍼 |
| `def topdown`, `def children` CLI | **L3 workflow (본 skill)** |

**Phase 3b Option B 주의담**: 초기 topdown 은 contains 순방향만 walk 했다. Phase 3b 에서 parent→child `depends_on` 이 제거되자 `def topdown gate-system` 이 silent 0 member 를 반환 — 80+ commits 동안 신규 contributor entry-point 가 침묵. 복구: `collectDomainMembers` 를 다중 경로 union 으로 확장 + silent empty 에 warning hint + workflow-smoke non-empty assertion. 이후 일반 의존자가 멤버처럼 섞이는 부작용을 방지하기 위해 `depends_on←` 을 별도 consumer 섹션으로 분리 (`--with-consumers` flag). 이 사건이 L3 의 Union > single path 원칙의 근거.

근거: `docs/proposals/domain-hierarchy/reviews/2026-04-21-selector-review.md` Gap #1, `-selector-fixes.md` §1.

계층 분리 규칙: `docs/specs/system/layer-separation.rule.md` §2.2 (Union > single path). Semantic 변경 시 topdown smoke 재실행 필수 — `skills/semantic-change/SKILL.md` Step 3 L3.

신규 기여자 entry-point: `skills/def-doctor/SKILL.md` (validate + topdown 건강도 통합).
