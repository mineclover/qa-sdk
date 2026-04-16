---
def:
  id: doc-type-convention
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: doc-type-convention-cases
      type: contains
    - target: drizzle-orm-convention
      type: traces_to
---

# 문서 유형 컨벤션 — 7종 확장자 체계

## 목적 ^purpose

definition-catalog 문서의 역할을 확장자로 명시하여,
정의(spec)와 소비 규칙(rule)과 현재 상태(todo/test)와 사용 시나리오(cases)와 히스토리(memo)와 방향(plan)을 구분한다.

## ^defines

### 7종 확장자

| 확장자 | 질문 | 독자 | lifecycle | frontmatter |
|--------|------|------|----------|-------------|
| `.spec.md` | "이것은 무엇인가" | 정의자/구현자 | `approved` | 필수 |
| `.rule.md` | "이것을 사용할 때 무엇을 확인하는가" | 소비자 | spec 따름 | 필수 |
| `.todo.md` | "다음에 무엇을 하는가" | 구현자 | `draft` | 필수 |
| `.test.md` | "어떻게 검증하는가" | 검증자 | spec 따름 | 필수 |
| `.cases.md` | "누가 어떤 흐름으로 사용하는가" | 구현자/검증자 | spec 따름 | 필수 |
| `.memo.md` | "무엇을 발견/기록했는가" | 탐색자 | — | 선택 |
| `.plan.md` | "어떻게 구현할 것인가" | 설계자 | — | 선택 |

### spec vs rule

- spec = "이것은 무엇이고, 어떤 구조인가" (정의)
- rule = "이것을 소비할 때 어떤 조건을 확인하는가" (판별 기준 + 체크리스트)
- guide(knowledge_kind)와의 차이: guide는 프로젝트 전역 절차, rule은 spec 단위 종속
- rule은 소비자가 생길 때 생성. spec만으로 소비 가능하면 불필요

### cases vs test

- cases = "사용자/시스템이 어떤 흐름으로 동작하는가" (시나리오, UC, 기대 결과)
- test = "코드 레벨에서 어떻게 검증하는가" (describe/it 식별자 매핑)
- cases는 구현 전에도 작성 가능 — spec의 흐름을 구체화한 시나리오 문서
- test.md가 코드 검증 매핑이라면, cases.md는 사용 흐름 + 기대 결과 명세
- cases의 UC가 test.ts의 테스트 케이스로 파생 가능

### 배치 규칙

- **spec 옆 배치** — 같은 디렉토리, 같은 id에 확장자만 다름
- **기본은 spec** — 모든 문서가 6종 가질 필요 없음
- **같은 id에 `.spec.md` + `.rule.md` + `.todo.md` 동시 존재 가능**

```
docs/specs/meta-semantic/meta-semantic-ir/
  meta-semantic-ir.spec.md       ← 정의 (무엇인가)
  meta-semantic-ir.rule.md       ← 소비 규칙 (무엇을 확인하는가)
  meta-semantic-ir.todo.md       ← 미구현 잔여
  meta-semantic-ir-pipe.spec.md  ← 하위 leaf spec
```

### 파일명 규칙

```
{def-id}.{type}.md

예:
  meta-semantic-ir.spec.md
  meta-semantic-ir.rule.md
  meta-semantic-ir.todo.md
  meta-semantic-ir.test.md
  meta-semantic-ir.cases.md
  meta-semantic-ir.memo.md
  meta-semantic-ir.plan.md
```

### 전이 규칙

```
.plan.md ──추출──→ .todo.md ──구현완료──→ .spec.md 승격
                     │                      │
                     │ 부분 완료             │ 소비자 필요
                     └──→ .todo.md 유지      └──→ .rule.md 생성
```

- `.todo.md` → 전체 구현 완료 시 삭제 (spec이 흡수)
- `.todo.md` → 부분 완료 시 잔여분 유지, spec 생성
- `.plan.md` → 실행 가능 항목 추출 → `.todo.md`
- `.memo.md` → spec/todo에서 링크 참조
- `.rule.md` → spec 변경 시 함께 갱신. spec deprecated 시 rule도 deprecated

### lifecycle 매핑

| 확장자 | lifecycle 값 | 전이 |
|--------|-------------|------|
| `.spec.md` | `approved` | — |
| `.rule.md` | spec의 lifecycle 따름 | spec deprecated → rule deprecated |
| `.todo.md` | `draft` | 구현 시작 → `review` (선택) |
| `.test.md` | spec의 lifecycle 따름 | — |
| `.cases.md` | spec의 lifecycle 따름 | spec 흐름 변경 → cases 갱신 |
| `.memo.md` | 없음 (히스토리) | — |
| `.plan.md` | 없음 (방향) | — |

## 운영 규칙 ^constraint

### rule 규칙

- **종속 spec 필수** — rule만 단독 존재 불가
- spec과 같은 디렉토리에 배치
- 내용: 판별 기준, 체크리스트, 좌표 매핑, 소비 조건
- 내용 아닌 것: 정의(→spec), 구현 계획(→todo), 이유(→memo)

### todo 규칙

- todo에만 `[ ]` 체크박스 사용
- plan에는 체크박스 없음 (방향만)
- **이번에 구현 시작 가능한 것만** todo에 기재

### memo 분리 기준

- spec에서 "왜" 설명 비중 > 1/3이면 `.memo.md`로 분리
- 1-2줄이면 spec 안에 포함

### cases.md 규칙

- **종속 spec 필수** — cases만 단독 존재 불가
- 각 UC: 상황, 관여 패키지, 흐름, 기대 결과, 검증 참조로 구성
- 내용: 사용 시나리오(UC), 입력→흐름→출력, 기대 결과
- 내용 아닌 것: 설계 구조(→spec), 코드 검증 매핑(→test), 잔여 작업(→todo)
- test.ts 테스트 케이스의 원천 시나리오 — cases에서 파생하여 test.ts로 구현

### test.md 규칙

- test.ts의 `describe`/`it` 식별자를 참조하는 구조
- 코드와 독립적 — 구현 전에도 작성 가능 (TDD 명세)

### plan 규칙

- 현재 목표 → 장기 목표 구분
- 구체적 체크박스 없음 — 방향과 단계만
- 실행 가능해지면 todo로 추출

### topic/cases 분리

새 이슈, 미확정 토론, 실행 후보, 확정된 구조, 사용 규칙, 검증 문서로 전이되는 실제 흐름은 `doc-type-convention-cases`가 사용 시나리오로 소유한다. 이 문서는 확장자별 역할과 전이 원칙만 소유한다.

## 정합성 검증 ^constraint

| 검증 | 심각도 | 설명 |
|------|--------|------|
| 확장자 vs lifecycle | error | `.todo.md`인데 `lifecycle: approved` |
| rule 종속 spec 없음 | error | `.rule.md`만 있고 대응 `.spec.md` 없음 |
| rule lifecycle 불일치 | warning | `.rule.md` lifecycle이 종속 spec과 다름 |
| 확장자 vs 코드 존재 | warning | `.todo.md`만 있고 구현 코드 존재 → spec 누락 |
| 고아 memo | warning | memo가 있지만 대응 spec/todo 없음 |
| test.md 미연결 | warning | 시나리오 ID가 test.ts에 없음 |
| plan 체류 | info | plan에 장기 체류 항목 |

## ^consumes

- definition-catalog frontmatter 체계 (scope, aspect, lifecycle 등)
- `qa-sdk def sync` / `qa-sdk def audit` — 기존 검증 파이프라인
