# Constraint — 의미 제약

> [[axis]]/[[entry]]/[[relation]] 조합에 대한 선언적 무결성 규칙.

## 정의

좌표 공간의 형태를 강제하는 규칙. yaml에 선언적으로 박혀 있고, validate 단계에서 위반 검출.

## 목적

- "이 좌표 조합은 허용 안 됨" / "이 axis는 반드시 존재해야" 같은 무결성 보장
- 검증 단계의 fail-collect 정책에 통합
- 4 kind로 표현력 분리

## kind 4종

| kind | 의미 | rule 예시 |
|------|------|----------|
| `capacity` | axis prop 비교 | `{ axis: scope, prop: entries.length, op: lte, value: 16 }` |
| `ref` | axis 존재 보장 | `{ axis: layer, mustExist: true }` |
| `structural` | relation rule field 금지값 | `{ relationKind: contains, forbidden: { field: upper, value: leaf } }` |
| `custom` | caller-책임 (info 진단만) | 임의 객체 |

(v0.3 구조화 형식. v0.1~v0.2의 string rule도 backward compat — `constraint-deprecated-string-rule` info 진단.)

## 핵심 원리

### Relation과의 분리

[[relation]]은 "이런 화살표가 있다" 선언. Constraint는 "이런 조합 금지/필수". 두 개념 분리로 의미와 무결성 따로 관리.

### Severity

`error` / `warning` / `info`. validate 결과의 fail-collect 정책 그대로.

### 진단 코드

위반 시 `constraint-violated` (또는 형식 오류 시 같은 코드 + meta로 구분).

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

dkg-schema:
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

- [[axis]]: capacity/ref kind가 axis 자체 검증
- [[relation]]: structural kind가 relation rules 검증
- [[diagnostic]]: 위반은 `constraint-violated` 진단으로 emit

## 참조

- spec: `../00-design.md` §7
- 코드: `packages/taxonomy-engine/src/validate/constraint.ts`
- DSL 구조화 결정 (v0.3): `../plans/v0.3.md` T-E5
