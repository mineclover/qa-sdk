---
def:
  id: taxonomy-engine-constraint-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: constraint
  aspect: concept
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concept-constraint
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/schema/zod.ts
  - packages/taxonomy-engine/src/validate/constraint.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/__tests__/unit/validate.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
---

# Constraint — 의미 제약

> [[axis]]/[[entry]]/[[relation]] 조합에 대한 선언적 무결성 규칙.

## 목적 ^purpose

- 좌표 공간 안에서 허용되지 않는 조합을 yaml에 명시한다.
- `validate()`의 fail-collect 진단 흐름에 무결성 규칙을 통합한다.
- relation의 의미 선언과 constraint의 무결성 검사를 분리한다.

## 정의

`ConstraintIR`는 `id`, `kind`, `rule`, `severity`를 가진다. parser는 yaml의 `constraints` 배열을 IR에 보존하고, `validateConstraints()`가 kind별 evaluator로 위반을 `Diagnostic[]`에 추가한다.

```typescript
type ConstraintKind = "capacity" | "structural" | "ref" | "custom"

type ConstraintIR = {
  id: string
  kind: ConstraintKind
  rule: string | Record<string, unknown>
  severity: "error" | "warning" | "info"
}
```

## kind 4종

| kind | 현재 evaluator | rule 예시 |
|------|----------------|-----------|
| `capacity` | axis의 `entries.length` 또는 `capacity` 숫자 비교 | `{ axis: scope, prop: entries.length, op: lte, value: 16 }` |
| `ref` | 필수 axis 존재 확인 | `{ axis: layer, mustExist: true }` |
| `structural` | 특정 relation kind의 rule field 금지값 확인 | `{ relationKind: contains, forbidden: { field: upper, value: leaf } }` |
| `custom` | engine이 실행하지 않고 info 진단으로 caller 책임을 표면화 | 임의 객체 |

구조화 rule은 `CapacityRuleSchema`, `RefRuleSchema`, `StructuralRuleSchema`로 재검증된다. 기존 string rule은 backward compatibility로 평가하되 `constraint-deprecated-string-rule` info 진단을 함께 낸다.

## 진단 정책

| 상황 | code | severity |
|------|------|----------|
| 구조화 rule shape 오류 | `constraint-violated` | `error` |
| capacity/ref/structural 위반 | `constraint-violated` | constraint의 `severity` |
| legacy string rule 사용 | `constraint-deprecated-string-rule` | `info` |
| custom constraint | `constraint-violated` | `info` |

## 사용 예시

qa-sdk-coordinate-system:
```yaml
constraints:
  - id: level-leaf-no-children
    kind: structural
    rule:
      relationKind: contains
      forbidden:
        field: upper
        value: leaf
    severity: error
```

capacity rule:
```yaml
constraints:
  - id: node-count-16
    kind: capacity
    rule:
      axis: node-kind
      prop: entries.length
      op: eq
      value: 16
    severity: error
```

## 다른 개념과의 관계

- [[axis]]: `capacity`와 `ref` kind가 axis 속성/존재를 검증한다.
- [[relation]]: `structural` kind가 relation rules를 검사한다.
- [[diagnostic]]: 위반은 안정 code로 반환된다.

## 참조

- 코드: `packages/taxonomy-engine/src/validate/constraint.ts`
- 타입: `packages/taxonomy-engine/src/schema/ir.ts`
- rule schema: `packages/taxonomy-engine/src/schema/zod.ts`
- DSL 구조화 결정: `../plans/v0.3.md` T-E5

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/validate.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
