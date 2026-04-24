---
name: def-split
description: "definition-catalog 대형 문서 분할. 150줄 이상이거나 여러 책임이 섞인 문서를 E/C/I/S + L/P 단위로 분해한다."
---

# Definition Catalog — 문서 분할

150줄+ 문서나 여러 책임이 섞인 문서를 E/C/I/S + L/P 단위로 분할한다. 분할 시 먼저 책임지는 System boundary를 확인하고, Entry/Identity, Component, Interface/DSL, System behavior, Layout/Pack 문서로 나눈다.

원칙: "모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다."

## 핵심 지침: 과편화 허용 + 자기 증명

**과편화는 상관없다.** 책임이 다르면 줄 수와 무관하게 분할한다. 작은 책임 문서가 여러 개인 것이 큰 혼합 문서 하나보다 낫다.

분할 후 각 문서가 갖춰야 할 것:
- **System 문서**: 독립 운용되는 코드/서비스/패키지 책임 단위. 분할의 기준점이며 system끼리 `contains`하지 않는다.
- **Interface / DSL 문서**: System을 어떻게 소비할지 정하는 API/CLI/event/rule/contract 평면.
- **Component 문서**: data shape, state enum, evidence shape, validation vocabulary처럼 수동 참조되는 데이터 평면.
- **Entry / Identity 문서**: 안정 ID, 유한 값, singleton identity처럼 식별만 담당하는 평면. ECS 설명에서만 Entity라고 부른다.
- **Layout / Pack 문서**: 여러 System 또는 Interface 조각을 조망/배치/배포 묶음으로 조직한다. 세부 behavior/data ownership은 갖지 않는다.
- **BDD contract**: System behavior의 결정론적 의미를 Given/When/Then으로 고정한다.
- **Event vocabulary / mapping pack**: event key와 관측 taxonomy를 고정한다. behavior 자체를 소유하지 않는다.
- **코드 boundary**: 문서가 분리됐는데 구현 파일/함수가 여전히 여러 책임을 한꺼번에 소유하면 code split 후보로 기록하거나 함께 분리.

코드 작성 규칙은 `docs/specs/system/architecture-revealing-code-convention.rule.md`가 소유한다. 문서 분할은 이 rule을 소비해서 코드가 책임을 드러내는지 확인한다.

## 분할 대상 찾기

```bash
qa-sdk def stats    # 전체 현황
qa-sdk def audit    # 대형 리프 이슈 확인
```

## 시작 전 확인

```bash
qa-sdk def sync
qa-sdk def context <문서ID>
qa-sdk def bottomup <문서ID>
```

- 분할 기준은 `scope`보다 `E/C/I/S + L/P 책임`을 우선한다.
- 단일 개념은 반드시 어느 `tier: system`이 책임지는지 먼저 정한다.
- 기본 패턴은 `Layout/Pack → System → Interface/DSL + Component + Entry/Identity + System behavior`다.
- `level: module|leaf`는 현재 validator 메타데이터일 뿐, authoring 방법론의 중심 언어로 쓰지 않는다.
- 여러 system을 조망하는 문서는 `layout`이며, 분할 ownership을 갖지 않는다.
- transport/API surface, validation contract, cleanup/operations lane처럼 **운영 책임이 다른 패싯**은 줄 수와 무관하게 분리한다.

## 절차

1. `qa-sdk def context <문서ID>`로 책임지는 system boundary를 확인한다.
2. system 후보가 없으면 `def-tier` 기준으로 system/layout/component/entry 중 무엇인지 먼저 판정한다.
3. `grep "^## " <파일>`로 섹션 구조를 분석한다.
4. 각 섹션을 "System / Interface / Component / Entry 중 무엇인가" 기준으로 묶는다.
5. System 문서는 behavior ownership만, Interface 문서는 소비 계약만, Component 문서는 데이터 vocabulary만, Entry 문서는 식별자만 소유하게 분리한다.
6. 필요한 문서를 생성하고 `## 목적 ^purpose`를 채운다.
7. 각 문서에 구현 참조(`## 구현 참조`)를 추가한다:
   - 구현: `패키지/src/파일.ts` — 핵심 함수/타입
   - 테스트: `패키지/src/파일.test.ts` — 관련 describe/it 라인번호
8. 구현 참조가 거대 shared file 전체만 가리키면 code split 또는 symbol-level reference를 검토한다.
9. 필요한 횡방향 관계는 `/def-link` 기준으로 보강한다.
10. `qa-sdk def sync`로 local datasource를 갱신한다.
11. 검증: system은 system을 contains하지 않고, Interface/Component/Entry가 behavior를 숨기지 않으며, shared source가 여러 책임을 과도하게 소유하지 않는다.

경험적 분할 힌트:

- System 문서는 분할의 ownership root다. 문서가 여러 system 책임을 섞으면 먼저 system 경계부터 나눈다.
- Interface 문서에 data shape나 runtime behavior가 섞이면 Component/System behavior로 분리한다.
- Component 문서에 validator/projector/writer 같은 behavior가 섞이면 System behavior 문서로 분리한다.
- Entry 문서에 schema나 behavior가 섞이면 Component/System으로 승격한다.
- behavior를 이벤트 목록으로만 설명하고 있으면 BDD contract로 분리한다.
- event key의 의미/분류를 BDD contract 안에서 새로 만들고 있으면 event vocabulary 또는 mapping pack으로 분리한다.
- **구조 설명 vs 운영 surface**가 한 문서에 섞여 있으면 분리한다.
- **validate/assemble contract**와 **warning/cleanup lane**은 같은 기능군이어도 실패 조건과 운영 책임이 다르면 분리한다.
- 상위 index/layout은 가능한 한 가볍게 두고, API/CLI/dashboard 같은 진입점은 Interface 문서로 뺀다.
- 문서를 분리했는데 모든 문서가 같은 거대 source file만 참조하면 코드 boundary도 아직 분리되지 않은 것이다.
- code split이 과도하면 최소한 `파일.ts:symbol` 수준으로 source target을 좁힌다.

## frontmatter 형식

```yaml
---
def:
  id: <id>
  tier: <system|component|entry|layout>
  scope: <scope>
  aspect: <aspect>
  depth: <depth>
  lifecycle: approved
---
# <제목>

## 목적 ^purpose

<purpose>
```

`def:` 래퍼 + 2칸 들여쓰기. `## 목적 ^purpose` 필수.

## scope 결정: "주 독자가 누구인가"

constraint → state → data → feature → flow → interface → ui

## 검증

```bash
qa-sdk def sync
qa-sdk def validate    # 깨진 링크 0건 확인
qa-sdk def audit       # purpose/overview/level 누락 0건 확인
pnpm --filter definition-catalog test
```

## 판단 원칙 (meta-semantic 기반)

> 상세: `ms-concept-boundary`, `ms-concept-five-roles` 참조

분할 판단의 근거는 **E/C/I/S + L/P 책임**과 데이터 패싯(생산·소비·정의·관리·저장)이다.

- 한 문서 내에서 **서로 다른 패싯 조합**이 섞여 있으면 분리 신호
- 예: 스키마 정의(정의) 부분과 검증 규칙(관리) 부분이 한 문서에 → 분리
- 예: API 계약(소비 인터페이스)과 구현 로직(생산) → 분리
- 예: Interface 구조 설명(정의)과 cleanup 운영 절차(관리/운영)가 한 문서에 → 분리
- 예: 서비스 aggregate 설명(정의)과 sync endpoint surface(소비 인터페이스)가 한 문서에 → 분리

분할 결과의 각 문서는 **검증 가능한 책임 단위(바운더리)**여야 한다:
- 실행 검증, 타입 검증, 계약 검증, 정합성 검증 중 하나 이상 가능한가?
- "기계적으로 판정 가능한가"가 기준. 코드 리뷰로만 확인 가능하면 검증이 아님

## 코드 공동 분할 원칙

문서 분할의 목적은 예쁜 목차가 아니라 책임 boundary를 만들기 위한 것이다.

- System 문서가 코드 boundary를 대표하고, Interface/Component/Entry 문서는 그 내부 소비 계약/데이터/식별자 평면을 나눈다.
- 문서 1개는 가능한 한 구현 boundary 1개와 테스트 boundary 1개에 대응한다.
- 코드가 이미 여러 파일로 나뉘어 있어도 파일 수만큼 문서를 만들지 않는다. 독립 계약/데이터/행동/조망을 소유할 때만 문서를 나눈다.
- Component-like 파일(types/schema/state/evidence)은 data vocabulary만 소유해야 한다.
- Interface-like 파일(commands/routes/events/ports)은 소비 표면만 소유해야 한다.
- System-like 파일(traverse/project/validate/sync/write/activate)은 behavior boundary를 소유해야 한다.
- Layout/Pack-like 파일(index/manifest/registry/facade)은 조립만 소유해야 한다.
- 한 코드 파일이 서로 다른 E/C/I/S + L/P 문서 3개 이상을 소유하면 `spec-lifecycle`과 함께 code split 후보로 본다.
- 한 테스트 파일이 여러 source boundary를 검증하면 `test-split`을 사용한다.
- 당장 code split을 못 하면 문서에 "현재 shared source"임을 명시하고, `.todo.md`에 code split follow-up을 남긴다.

## 주의

- 원본 문서를 `deprecated`로 바꾸지 않는다. 기존 `docId`는 가능한 책임 문서로 유지하되, 역할이 바뀌면 tier/scope/aspect를 함께 정정한다.
- 설치본 `~/.codex/skills/`나 DB를 직접 수정하지 않는다. repo 문서 수정 후 sync한다.
