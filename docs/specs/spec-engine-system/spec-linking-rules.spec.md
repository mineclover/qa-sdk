---
def:
  id: spec-linking-rules
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [entry-point]
  links:
    - target: spec-linking-standard
      type: refines
---

# Spec Linking 규칙

## 목적 ^purpose

스펙 문서, decision, prefix, axis 간 참조 형식과 문서 유형별 필수 연결 규칙을 분리해 링크 표준을 정리한다.

## 구성 ^overview

- `참조 형식`: SpecId 계층 구조와 기계/사람 가독 ID 규칙을 정의한다.
- `SpecRelation 6종`: satisfies/implements/tests/traces-to/depends-on/constrains 관계 타입을 기술한다.
- `문서 유형별 필수 연결`: req/feat/uc/evt/ls/adr 각 유형에서 요구되는 연결 방향을 명시한다.
- `새 문서 추가 체크리스트`: 링크 누락과 잘못된 방향을 방지하는 검증 절차를 정리한다.

## 참조 형식

SpecId는 계층적 구조를 따른다 (spec-core/src/spec/spec.types.ts):

```
SpecId 형식: "{TYPE}-{NUM}" | "{TYPE}-{NUM}-{SUBTYPE}-{NUM}"
예시: "FEAT-003", "FEAT-003-LS-01", "FEAT-003-LS-01-TC-01"
```

- frontmatter의 `def.id`: 기계가 읽는 kebab-case 식별자 (예: `address-context-format`)
- 마크다운 `# 제목`: 사람이 읽는 한국어 제목 (예: `Address Context 형식`)
- frontmatter의 `def.links[].target`: 참조 대상의 def.id

SpecDocumentRegistry (spec-core/src/spec/spec-document.registry.ts)가 등록과 관계 탐색을 담당한다. 중복 등록 시 DuplicateRegistrationError를 발생시킨다.

## SpecRelation 6종

```typescript
interface SpecRelation {
  from: SpecId;
  to: SpecId;
  type: "satisfies" | "implements" | "tests" | "traces-to" | "depends-on";
}
```

| 관계 | 방향 | 의미 |
|------|------|------|
| satisfies | feat → req | 기능이 요구사항을 충족 |
| implements | ls/evt → feat | 로직/이벤트가 기능을 구현 |
| tests | tc → ls | 테스트가 로직을 검증 |
| traces-to | any → any | 추적 연결 (참고용) |
| depends-on | any → any | 의존 (선행 조건) |

frontmatter에서 `def.links[].type`으로 선언하는 관계(refines, constrains)는 문서 계층 구조용이고, SpecRelation은 spec 레벨 추적용이다.

## 문서 유형별 필수 연결

| 문서 유형 | 필수 연결 | 방향 |
|-----------|-----------|------|
| req (요구사항) | — | (최상위, 연결 시작점) |
| feat (기능) | satisfies → req | 어떤 요구를 충족하는가 |
| uc (유즈케이스) | traces-to → feat | 어떤 기능의 사용 시나리오인가 |
| evt (이벤트) | implements → feat | 어떤 기능의 이벤트 정의인가 |
| ls (로직 스펙) | implements → feat | 어떤 기능의 행위 규칙인가 |
| adr (결정 기록) | traces-to → feat/ls | 어떤 설계에 대한 결정인가 |

## 새 문서 추가 체크리스트

1. **def.id가 기존 문서와 중복되지 않는가?** — SpecDocumentRegistry가 DuplicateRegistrationError로 검출
2. **필수 연결이 존재하는가?** — 위 표에 따라 해당 유형의 필수 관계가 선언되었는지 확인
3. **연결 방향이 올바른가?** — satisfies는 feat→req 방향, implements는 ls→feat 방향
4. **참조 대상이 존재하는가?** — `registry.has(targetId)`로 참조 대상 존재 확인
5. **lifecycle이 적절한가?** — draft/active/deprecated 중 문서 상태에 맞는 값 선택

잘못된 방향의 연결(예: req → feat에 satisfies)은 링크 누락보다 위험하다. 방향 검증을 누락 검증보다 먼저 수행한다.
