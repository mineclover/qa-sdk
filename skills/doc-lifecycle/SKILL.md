---
name: doc-lifecycle
description: "문서 유형 생명주기 관리. 7종 확장자(spec/rule/todo/test/cases/memo/plan) 문서 생성, 승격, 상태 조회, 정합성 검증. 트리거: doc lifecycle, 문서 생성, 문서 승격, doc create, doc promote, doc status, doc audit type."
---

# Doc Lifecycle — 문서 유형 생명주기 관리

7종 확장자(spec/rule/todo/test/cases/memo/plan) 문서의 생성, 승격, 상태 조회를 수행한다.

컨벤션: `docs/specs/system/doc-type-convention.spec.md`

## Lifecycle 5종 상태 머신

코드 SSOT: `packages/definition-catalog/src/validate.ts` + `types.ts:DefLifecycle`

| state | 의미 | 검증 대상 | 승격 조건 |
|-------|------|----------|-----------|
| `draft` | 초안 — 작성 중 | orphan 검사 제외 | review 이행 시 검토 시작 |
| `review` | 검토중 — 리뷰 진행 | orphan 검사 제외 | 리뷰 통과 → approved |
| `approved` | 승인 — 정합성 강제 | broken-link, dup-coord, multi-parent, contains-depth, owner-system 등 전수 적용 | (대체 문서 존재 시) deprecated |
| `deprecated` | 폐기예정 — 유예 기간 | **거의 모든 검사 면제** (validate.ts L96~465) | 실파일 삭제 또는 archived |
| `archived` | 보관 — 검색 대상 외 | orphan 검사 제외 (validate.ts L313) | — |

```
draft ──▶ review ──▶ approved ──▶ deprecated ──▶ (삭제 또는 archived)
                       │
                       └──────────────────────▶ archived (히스토리 보존)
```

- `draft`/`review`/`archived`는 orphan 경고 대상이 아니다 (`validate.ts:312-313`).
- `deprecated`는 단순 경고 회피 목적으로 쓰지 않는다 — `archived`나 `draft` 환원이 적절할 수 있다 (`validator-suppression-tags.rule.md` §1.1).
- `traces_to`로 deprecated → 후속 문서 연결을 남긴다.

## 명령

### create — 문서 생성

```
/doc-lifecycle create <doc-id> --type <spec|rule|todo|test|cases|memo|plan> [--dir <path>]
```

지정 유형의 문서를 생성한다. frontmatter 자동 포함.

- `--type spec` → `{id}.spec.md` (lifecycle: approved, 필수 마커: ^purpose, ^defines)
- `--type rule` → `{id}.rule.md` (lifecycle: spec 따름, 소비 규칙/체크리스트/판별 기준)
- `--type todo` → `{id}.todo.md` (lifecycle: draft, `[ ]` 체크박스 포함)
- `--type test` → `{id}.test.md` (시나리오 구조, test.ts 식별자 참조 형식)
- `--type cases` → `{id}.cases.md` (사용 시나리오/UC, 흐름 + 기대 결과)
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

해당 id의 7종 존재 여부 + 내용 요약:

```
pipe-static-lineage:
  spec.md   ✅ lifecycle=approved, API 10개
  rule.md   ❌ 없음
  todo.md   ❌ 없음
  test.md   ❌ 없음
  cases.md  ❌ 없음
  memo.md   ❌ 없음
  plan.md   ❌ 없음
```

확장자 필터로 전체 카탈로그를 훑을 때는 `def list --type=...`을 사용한다 (코드 SSOT: `packages/cli/src/commands/def.ts:172` `EXT_TYPE_FLAGS = {rule, cases, test, todo, plan, memo}`).

```bash
qa-sdk def list --type=rule        # *.rule.md 만
qa-sdk def list --type=todo        # *.todo.md 만 — 미완 항목 추적
qa-sdk def list --type=test        # *.test.md 만 — 시나리오 문서
qa-sdk def list --type=cases       # *.cases.md 만 — UC 문서
qa-sdk def list --type=plan        # *.plan.md 만
qa-sdk def list --type=memo        # *.memo.md 만 — 결정 기록
```

`--type=spec`은 EXT_TYPE_FLAGS에 포함되지 않으므로 doc_type 필드 필터로 동작한다.

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
| `.cases.md`만 있고 대응 spec 없음 | error (종속 spec 필수) |
| `.plan.md`에 장기 체류 항목 | info |

확장자별 표적 감사 (`def list --type=...` 활용):

```bash
qa-sdk def list --type=todo --lifecycle=approved   # 위반 후보 — todo는 draft여야
qa-sdk def list --type=rule                         # 종속 spec 누락 검토 대상
qa-sdk def list --type=memo                         # 고아 후보
```

### cleanup — 완료된 기록 정리 (commit 72ca7d50)

```
qa-sdk docs cleanup review [doc-id|path] [--prd <file>] [--family-only] [--include-session] [--json]
qa-sdk docs cleanup plan  <record-path|doc-id|paired-path> --action archive|memo-conversion|promote-spec|rewrite [--override <json|inline>] [--dry-run]
qa-sdk docs cleanup apply <record-path|doc-id|paired-path> --action archive|memo-conversion|promote-spec|rewrite [--override <json|inline>]
```

3단계 워크플로우 + 4 액션:

| 단계 | 역할 |
|------|------|
| `review` | 완료 기록 후보 + 가족(스펙 묶음) 스캔 — 액션 추천 |
| `plan`   | 액션 실행 계획 생성 (dry-run 기본) |
| `apply`  | 계획 실제 적용 (record 이동 + 산출물 갱신) |

| action | 의미 |
|--------|------|
| `archive`          | record를 archive 위치로 이동 (lifecycle: archived 전이 동반) |
| `memo-conversion`  | 결정/리뷰 기록을 `.memo.md`로 변환하고 원본 정리 |
| `promote-spec`     | todo의 완료 부분을 `.spec.md`로 승격 (이 skill의 `promote`보다 PRD/record 묶음 단위로 동작) |
| `rewrite`          | 기존 record를 새 형식으로 재작성 |

`promote`(이 skill, doc-id 단일)와 `cleanup apply --action=promote-spec`(record/PRD 묶음, 자동 plan)은 **범위가 다르다**. 단건 todo→spec은 `promote`, 다건 records 일괄은 `cleanup apply --all` 흐름을 쓴다.

상세 스펙: `docs/specs/definition-catalog/docs-control-plane-cleanup.spec.md`

### system spec stub 생성

신규 영역(예: `sim-*`, `motion-content-*`)을 도입할 때 system 단위 stub은 다음 분담을 따른다.

1. **`def-new`** — 단일 leaf/module 문서를 frontmatter+`^purpose`+`^overview`만으로 빠르게 만든다.
2. **`doc-lifecycle create`** — 동일 id에 7종 확장자(`.spec.md`/`.todo.md` 페어 등)를 한 번에 깔아 생명주기 시작점을 만든다.

system stub 패턴: `def-new`로 system 1건 생성 → `doc-lifecycle create <id> --type todo` + `--type cases`로 미구현/시나리오 페어 추가 → `qa-sdk def sync` → `qa-sdk def validate`로 결합 검증.

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
- `.test.md`는 대응 spec 또는 책임 System 문서에서 authored link로 참조해야 orphan 경고가 나지 않는다

### cases 템플릿

```markdown
---
def:
  id: {id}
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: {layer}
  links:
    - target: {spec-id}
      type: refines
---

# {Title} — Use Cases

## 목적 ^purpose

{spec}의 구체적 사용 시나리오를 정의한다.

---

## UC-1: {시나리오명}

**상황**: {언제 이 시나리오가 발생하는가}

**관여**: {관여 패키지/컴포넌트}

**흐름**:
```
1. ...
2. ...
```

**기대 결과**:
- ...

**검증**: `{test 파일 또는 수동 검증 방법}`
```

cases 문서 규칙:
- 종속 spec과 같은 디렉토리에 배치
- lifecycle은 종속 spec을 따른다
- links에 종속 spec을 `refines`로 연결
- 각 UC: 상황, 관여, 흐름, 기대 결과, 검증 참조로 구성
- test.ts 테스트 케이스의 원천 시나리오 — cases에서 파생하여 test.ts로 구현

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
| `def-new` | spec 문서 생성 | doc-lifecycle create --type spec과 동등. def-new는 유지, doc-lifecycle은 7종 전체 커버 |
| `spec-lifecycle` | 코드 참조 전환, drift 점검 | doc-lifecycle promote와 연동 가능 — 승격 후 spec-lifecycle로 코드 참조 점검 |
| `def-audit` | 링크/고아/깊이 검증 | doc-lifecycle audit는 확장자 정합성에 집중, def-audit은 구조 검증에 집중 |

## 경험 규칙

- `.todo.md`와 `.spec.md`가 공존할 때는 **같은 id + 같은 stem**을 유지한다.
- `.todo.md`는 실행 가능한 잔여만 남기고, 이미 끝난 체크리스트는 spec이나 memo로 옮긴다.
- 리뷰/결정 기록이主体가 되면 `.todo.md`보다 `.memo.md`가 맞다.
