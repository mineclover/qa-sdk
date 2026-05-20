# Data Model

> 00-design.md §4 분리. v0.7 모듈화 (T-L1).

## 4.1 YAML 구조 (qa-sdk 좌표계 도그푸딩)

```yaml
taxonomy: qa-sdk-coordinate-system
version: 1
description: qa-sdk definition-catalog의 좌표/level/layer 시스템

axes:
  scope:
    description: 시스템 경계
    entries: [apm, ingest, registry, gate, query, decode, definition, decision]
    capacity: 16            # nextPowerOf2(entries * 2) 이상 권장
    version: 1
  aspect:
    description: 측면
    entries: [model, protocol, runtime, policy, ops, io]
    capacity: 16
  depth:
    entries: [overview, system, layer, component, entry]
    capacity: 8
  level:
    entries: [group, module, leaf]
  layer:
    entries: [domain, operation, mediation, experience]

relations:
  depth-contains:
    from: depth
    to: depth
    kind: contains
    rules:
      - { upper: overview, lower: system }
      - { upper: system, lower: layer }
      - { upper: layer, lower: component }
      - { upper: component, lower: entry }
  aspect-parents:
    from: aspect
    to: aspect
    kind: parent-of
    rules:
      - { child: protocol, parent: model }
      - { child: runtime, parent: protocol }

constraints:
  - id: capacity-headroom
    kind: capacity
    rule: "entries.length * 2 <= capacity"
    severity: warning
  - id: level-leaf-no-children
    kind: structural
    rule: "axis=level entry=leaf must not appear as upper in any contains relation"
    severity: error
```

## 4.2 IR (정규화 표현)

코드 레벨 IR 타입은 `packages/taxonomy-engine/src/schema/ir.ts` 단일 소스. 형태는 위 yaml 구조를 그대로 반영하되 axes/relations는 `Map`, contentHash 필드 추가.

```typescript
// IR 핵심 타입 (개념 참조)
interface TaxonomyIR {
  taxonomy: string
  version: number
  description?: string
  contentHash: string           // yaml 파서가 계산. 결정론적
  axes: Map<string, AxisIR>
  relations: Map<string, RelationIR>
  constraints: ConstraintIR[]
  imports?: ImportIR[]
}

interface AxisIR {
  name: string
  description?: string
  entries: EntryIR[]
  capacity?: number
  version?: number
}

interface EntryIR {
  id: string
  address: number               // 정수, 불변
  label?: string
  meta?: Record<string, unknown>
  _loc?: { line: number; column: number }  // codegen 출력에서 제거
}
```

## 4.3 1급 개념

좌표 공간을 구성하는 추상은 [`concepts/`](./concepts/README.md)에 각각 1 파일로 분리:

- [Axis](./concepts/axis.md) — 차원 (entries, capacity, version)
- [Entry](./concepts/entry.md) — 좌표값 (id 가변 + address 불변 이중화)
- [Coordinate](./concepts/coordinate.md) — 다축 점 (cross-product 주소화)
- [Relation](./concepts/relation.md) — 점 사이 화살표 (contains/parent-of/depends-on/binds/projects-to)
- [Constraint](./concepts/constraint.md) — 의미 제약
- [Taxonomy](./concepts/taxonomy.md) — 한 공간 단위
- [Registry](./concepts/registry.md) — 공간들의 우주

## 4.4 설계 의도 — 왜 계층 대신 좌표 + Relation인가

단순 트리는 cross-cutting 관계(예: Clip이 Asset.controlParams를 구동)를 표현 못 한다. 좌표계는 직교성을 유지하면서도 Relation으로 임의의 관계를 1급으로 표현한다. lesson-builder/qa-sdk/DKG가 모두 같은 추상 모델 위에 표현 가능한 이유.

## 참조

- 아키텍처: [architecture.md](./architecture.md)
- 참조 문법: [reference-grammar.md](./reference-grammar.md)
- IR 타입 소스: `packages/taxonomy-engine/src/schema/ir.ts`
- 도그푸딩 yaml: `docs/taxonomies/qa-sdk-coordinate-system.yaml`
- v0.1 계획: [plans/v0.1.md](./plans/v0.1.md)
