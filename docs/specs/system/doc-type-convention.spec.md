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
    - target: test-name-tokens
      type: depends_on
---

# 문서 유형 컨벤션 — 5종 확장자 체계

## 목적 ^purpose

definition-catalog 문서의 역할을 확장자로 명시하여,
현재 상태(spec/todo/test)와 히스토리(memo)와 방향(plan)을 구분한다.

## ^defines

### 5종 확장자

| 확장자 | 역할 | lifecycle | frontmatter |
|--------|------|----------|-------------|
| `.spec.md` | 구현 완료 스펙 (기본). ADR 성격 포함 가능 | `approved` | 필수 |
| `.todo.md` | 미구현 계획 — 이번에 구현할 대상만 | `draft` | 필수 |
| `.test.md` | 검증 기준 명세 — test.ts 식별자 참조 | spec 따름 | 필수 |
| `.memo.md` | 의사결정 맥락 ("왜 이렇게 했는가") | — | 선택 |
| `.plan.md` | 현재 목표 → 장기 목표 방향 | — | 선택 |

### 배치 규칙

- **spec 옆 배치** — 같은 디렉토리, 같은 id에 확장자만 다름
- **기본은 spec** — 모든 문서가 5종 가질 필요 없음
- **같은 id에 `.spec.md` + `.todo.md` 동시 존재 가능** — spec=완료 부분, todo=잔여분

```
docs/specs/meta-semantic/pipe-impl/
  pipe-static-lineage.spec.md       ← 구현 완료 부분
  pipe-static-lineage.todo.md       ← 미구현 잔여 (동시 존재 허용)
  pipe-static-lineage.test.md       ← 검증 기준
  pipe-static-lineage.memo.md       ← 결정 배경 (필요시만)
  pipe-fold-lineage.todo.md         ← 미구현 전용
  pipe-fold-lineage.plan.md         ← 장기 방향 (필요시만)
```

### 파일명 규칙

```
{def-id}.{type}.md

예:
  pipe-static-lineage.spec.md
  pipe-static-lineage.todo.md
  pipe-static-lineage.test.md
  pipe-static-lineage.memo.md
  pipe-static-lineage.plan.md
```

### 전이 규칙

```
.plan.md ──추출──→ .todo.md ──구현완료──→ .spec.md 승격
                     │                      │
                     │ 부분 완료             │ 잔여분
                     └──→ .todo.md 유지      └──→ .todo.md 동시 존재
```

- `.todo.md` → 전체 구현 완료 시 삭제 (spec이 흡수)
- `.todo.md` → 부분 완료 시 잔여분 유지, spec 생성
- `.plan.md` → 실행 가능 항목 추출 → `.todo.md`
- `.memo.md` → spec/todo에서 링크 참조

### lifecycle 매핑

| 확장자 | lifecycle 값 | 전이 |
|--------|-------------|------|
| `.todo.md` | `draft` | 구현 시작 → `review` (선택) |
| `.spec.md` | `approved` | — |
| `.test.md` | spec의 lifecycle 따름 | — |
| `.memo.md` | 없음 (히스토리) | — |
| `.plan.md` | 없음 (방향) | — |

## 운영 규칙 ^constraint

### todo 규칙

- todo에만 `[ ]` 체크박스 사용
- plan에는 체크박스 없음 (방향만)
- **이번에 구현 시작 가능한 것만** todo에 기재

### memo 분리 기준

- spec에서 "왜" 설명 비중 > 1/3이면 `.memo.md`로 분리
- 1-2줄이면 spec 안에 포함

### test.md 규칙

- test.ts의 `describe`/`it` 식별자를 참조하는 구조
- 테스트 시나리오 전용 인터페이스로 관리 예정
- 코드와 독립적 — 구현 전에도 작성 가능 (TDD 명세)

### plan 규칙

- 현재 목표 → 장기 목표 구분
- 구체적 체크박스 없음 — 방향과 단계만
- 실행 가능해지면 todo로 추출

## 정합성 검증 ^constraint

| 검증 | 심각도 | 설명 |
|------|--------|------|
| 확장자 vs lifecycle | error | `.todo.md`인데 `lifecycle: approved` |
| 확장자 vs 코드 존재 | warning | `.todo.md`만 있고 구현 코드 존재 → spec 누락 |
| 고아 memo | warning | memo가 있지만 대응 spec/todo 없음 |
| test.md 미연결 | warning | 시나리오 ID가 test.ts에 없음 |
| plan 체류 | info | plan에 장기 체류 항목 |

## ^consumes

- definition-catalog frontmatter 체계 (scope, aspect, lifecycle 등)
- `qa-sdk def sync` / `qa-sdk def audit` — 기존 검증 파이프라인
