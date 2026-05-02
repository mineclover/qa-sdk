---
name: def-topdown
description: "definition-catalog 탑다운 조회. 시스템/그룹에서 시작하여 멤버 문서의 purpose/overview를 scope 순서로 조립한다."
---

# Definition Catalog — 탑다운 조회

시스템/도메인 루트에서 출발해 멤버 문서를 하위로 훑어 내려간다. Phase 3b Option B 이후 멤버십은 `contains` 순방향과 자식이 부모를 지정하는 `depends_on` 역방향 두 경로로 선언되며, `def topdown`/`def children` 은 두 경로의 **union** 을 반환한다.

## 실행

```bash
qa-sdk def topdown <그룹ID>
qa-sdk def topdown <그룹ID> --overview
```

예:
```bash
qa-sdk def topdown gate-system
qa-sdk def topdown apm-system
qa-sdk def topdown ingest-system
```

## 멤버 탐색 규칙

`collectDomainMembers(groupId)` 는 다음 union 을 반환한다 (중복 제거, scope 정렬).

1. **contains 순방향** — `getChildren(groupId)` 결과. 레거시 system-infra / system-root 계열.
2. **depends_on 역방향** — `getIncomingLinks(groupId).filter(l => l.type === "depends_on")`. Phase 3b 이후 표준.
3. **refines 역방향** — 추상 → 구체 파생 문서 포함.

## 출력

```
# <그룹 제목>
<그룹 purpose>
concerns: <tags>

## [constraint] <제목>
<purpose>

## [flow] <제목>
<purpose>
...
```

scope 정렬: constraint → data → feature → flow → interface → state → ui

### 실제 출력 예 — `gate-system`

```
# Gate 시스템
주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.

## [feature] GateEngine 그룹
index-meta 패키지의 GateEngine 라이브러리. 주소 상태 자동 재계산 + Decorator 패턴 + gate-aware-query.

## [flow] Consistency 서비스
gate-service의 일관성 모델을 구현한다. shouldVerify 재확인 흐름 ...

## [flow] Gate Event Bus — 소비자 기대 시나리오
...

## [interface] EventBus 이벤트 전파 계약
...

## [interface] Query 시스템
관계형 질의, 정책 해소, gate 통합을 제공하는 중앙 질의 서비스.
```

(7 members: gate-engine-group, gate-consistency, gate-consistency-cases, gate-engine-group-cases, gate-event-bus-cases, gate-event-bus, query-system)

## 자식 재확인

`def children` 도 동일한 union 을 사용하며, 각 멤버의 via 가 `contains` 인지 `depends_on←` 인지 표시한다.

```bash
qa-sdk def children gate-system
# [local] gate-system → 7 children
#   gate-engine-group  feature/func_def  approved  (depends_on←)
#   ...
```

## Rule 문서 발견하기

`*.rule.md` 규약 문서는 별도 확장자로 분류된다. CLI 필터로 단번에 조회한다.

```bash
qa-sdk def list --type=rule          # *.rule.md 만 나열 (19건)
qa-sdk def list --ext=rule           # 동일 — 일반 ext 필터
qa-sdk def list --ext=cases          # *.cases.md — consumer-driven 기대 시나리오
qa-sdk def list --ext=test           # *.test.md — provider 테스트 문서
```

system-wide rule 8건은 [`docs/specs/system/README.md`](../../docs/specs/system/README.md) 인덱스에서 개요 조회 가능하다.

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

본 skill 은 **L3 workflow navigation skill**. `collectDomainMembers` 의 Union 패턴 (contains ∪ depends_on← ∪ refines←) 을 시연한다.

| 요소 | 계층 |
|------|------|
| 링크 그래프 (contains / depends_on / refines) | L1 data |
| `collectDomainMembers` 구현 | L2 validator/파생 헬퍼 |
| `def topdown`, `def children` CLI | **L3 workflow (본 skill)** |

**Phase 3b Option B 주의담**: 초기 topdown 은 contains 순방향만 walk 했다. Phase 3b 에서 parent→child `depends_on` 이 제거되자 `def topdown gate-system` 이 silent 0 member 를 반환 — 80+ commits 동안 신규 contributor entry-point 가 침묵. 복구: `collectDomainMembers` 를 3 경로 union 으로 확장 + silent empty 에 warning hint + workflow-smoke non-empty assertion. 이 사건이 L3 의 Union > single path 원칙의 근거.

근거: `docs/proposals/domain-hierarchy/reviews/2026-04-21-selector-review.md` Gap #1, `-selector-fixes.md` §1.

계층 분리 규칙: `docs/specs/system/layer-separation.rule.md` §2.2 (Union > single path). Semantic 변경 시 topdown smoke 재실행 필수 — `skills/semantic-change/SKILL.md` Step 3 L3.
