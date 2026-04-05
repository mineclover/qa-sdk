---
name: doc-lifecycle
description: "문서 유형 생명주기 관리. 6종 확장자(spec/rule/todo/test/memo/plan) 문서 생성, 승격, 상태 조회, 정합성 검증."
triggers:
  - doc lifecycle
  - 문서 생성
  - 문서 승격
  - doc create
  - doc promote
  - doc status
  - doc audit type
argument-hint: "<command> <doc-id> [--type spec|rule|todo|test|memo|plan]"
---

# Doc Lifecycle — 문서 유형 생명주기 관리

6종 확장자(spec/rule/todo/test/memo/plan) 문서의 생성, 승격, 상태 조회를 수행한다.

컨벤션: `docs/specs/system/doc-type-convention.spec.md`

## 명령

### create — 문서 생성

```
/doc-lifecycle create <doc-id> --type <spec|rule|todo|test|memo|plan> [--dir <path>]
```

지정 유형의 문서를 생성한다. frontmatter 자동 포함.

- `--type spec` → `{id}.spec.md` (lifecycle: approved, 필수 마커: ^purpose, ^defines)
- `--type rule` → `{id}.rule.md` (lifecycle: spec 따름, 소비 규칙/체크리스트/판별 기준)
- `--type todo` → `{id}.todo.md` (lifecycle: draft, `[ ]` 체크박스 포함)
- `--type test` → `{id}.test.md` (시나리오 구조, test.ts 식별자 참조 형식)
- `--type memo` → `{id}.memo.md` (frontmatter 선택, 자유 형식)
- `--type plan` → `{id}.plan.md` (frontmatter 선택, 현재 목표/장기 목표 구조)
- `--dir` 미지정 시 현재 def-id의 scope/aspect로 디렉토리 추론

### promote — todo → spec 승격

```
/doc-lifecycle promote <doc-id>
```

1. `{id}.todo.md`의 전체 구현 여부 확인 (체크박스 전부 `[x]`?)
2. 전부 완료 → `.spec.md`로 이름 변경 + lifecycle `draft` → `approved`
3. 부분 완료 → `.spec.md` 신규 생성 (완료 부분), `.todo.md` 잔여분 유지
4. 체크박스는 모두 끝났지만 내용이 결정 기록/리뷰 로그라면 `.memo.md` 또는 `knowledge` 문서로 전환

### status — 문서 현황 조회

```
/doc-lifecycle status <doc-id>
```

해당 id의 6종 존재 여부 + 내용 요약:

```
pipe-static-lineage:
  spec.md  ✅ lifecycle=approved, API 10개
  rule.md  ❌ 없음
  todo.md  ❌ 없음
  test.md  ❌ 없음
  memo.md  ❌ 없음
  plan.md  ❌ 없음
```

### audit — 정합성 검증

```
/doc-lifecycle audit [--dir <path>]
```

디렉토리 내 모든 문서의 정합성 검증:

| 검증 | 심각도 |
|------|--------|
| `.todo.md`인데 `lifecycle: approved` | error |
| `.todo.md`만 있고 구현 코드 존재 | warning (spec 누락) |
| `.rule.md`만 있고 대응 spec 없음 | error (종속 spec 필수) |
| `.rule.md` lifecycle이 종속 spec과 불일치 | warning |
| `.memo.md`만 있고 대응 spec/todo 없음 | warning (고아) |
| `.test.md` 시나리오 ID가 test.ts에 없음 | warning |
| `.plan.md`에 장기 체류 항목 | info |

## 템플릿

### spec 템플릿

```markdown
---
def:
  id: {id}
  level: leaf
  scope: {scope}
  aspect: {aspect}
  depth: specification
  lifecycle: approved
  layer: {layer}
  links: []
---

# {Title}

## 목적 ^purpose

## ^defines

## ^consumes
```

### rule 템플릿

```markdown
---
def:
  id: {id}
  level: leaf
  scope: {scope}
  aspect: {aspect}
  depth: specification
  lifecycle: approved
  layer: {layer}
  links:
    - target: {spec-id}
      type: refines
---

# {Title} — 소비 규칙

## 목적 ^purpose

{spec}을 소비할 때 확인해야 하는 판별 기준과 체크리스트.

## 체크리스트

### {패싯1}

- 항목 A → 조건 X이면 Y
- 항목 B → 조건 Z이면 거부

### Cross-{패싯} (전체)

- 정합성 조건 1
- 정합성 조건 2
```

rule 문서 규칙:
- 종속 spec과 같은 디렉토리에 배치
- lifecycle은 종속 spec을 따른다
- links에 종속 spec을 `refines`로 연결
- spec 변경 시 rule도 함께 갱신

### todo 템플릿

```markdown
---
def:
  id: {id}
  level: leaf
  scope: {scope}
  aspect: {aspect}
  depth: specification
  lifecycle: draft
  layer: {layer}
  links: []
---

# {Title}

## 목적 ^purpose

## 구현 항목

- [ ] 항목 1
- [ ] 항목 2
```

### test 템플릿

```markdown
---
def:
  id: {id}
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  layer: {layer}
  links:
    - target: {spec-id}
      type: refines
---

# {Title} — 검증 기준

## 시나리오

### S-001: {시나리오명}

- **describe**: `{test.ts의 describe 식별자}`
- **전제 조건**: ...
- **입력**: ...
- **기대 결과**: ...
- **대응 테스트**: `{파일}:{line}`
```

테스트 문서 좌표 규칙:

- 기본값은 `flow/user_scenario + depth: validation`
- feature 전용 시나리오를 강조할 때만 `feature/scenario + depth: validation`
- `aspect: validation`은 현재 taxonomy에 없으므로 쓰지 않는다
- `.test.md`는 spec 또는 상위 module에서 authored link로 참조해야 orphan 경고가 나지 않는다

### memo 템플릿

```markdown
# {Title} — 결정 메모

## 날짜

{YYYY-MM-DD}

## 맥락

## 검토한 대안

| 대안 | 장점 | 단점 |
|------|------|------|

## 결정

## 영향받는 스펙

- `{id}.spec.md`
```

### plan 템플릿

```markdown
# {Title} — 방향 계획

## 현재 목표

1. ...
2. ...

## 장기 목표

1. ...
2. ...

## 단계

| 단계 | 내용 | 전제 |
|------|------|------|
```

## 기존 skill과의 관계

| skill | 역할 | doc-lifecycle과의 관계 |
|-------|------|----------------------|
| `def-new` | spec 문서 생성 | doc-lifecycle create --type spec과 동등. def-new는 유지, doc-lifecycle은 6종 전체 커버 |
| `spec-lifecycle` | 코드 참조 전환, drift 점검 | doc-lifecycle promote와 연동 가능 — 승격 후 spec-lifecycle로 코드 참조 점검 |
| `def-audit` | 링크/고아/깊이 검증 | doc-lifecycle audit는 확장자 정합성에 집중, def-audit은 구조 검증에 집중 |

## 경험 규칙

- `.todo.md`와 `.spec.md`가 공존할 때는 **같은 id + 같은 stem**을 유지한다.
- `.todo.md`는 실행 가능한 잔여만 남기고, 이미 끝난 체크리스트는 spec이나 memo로 옮긴다.
- 리뷰/결정 기록이主体가 되면 `.todo.md`보다 `.memo.md`가 맞다.
