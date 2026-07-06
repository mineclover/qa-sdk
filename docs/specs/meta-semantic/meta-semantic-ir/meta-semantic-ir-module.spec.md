---
def:
  id: meta-semantic-ir-module
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-ir
      type: refines
    - target: meta-semantic-system
      type: depends_on
    - target: definition-level
      type: depends_on
    - target: ms-concept-boundary
      type: refines
  sources:
    - packages/core/src/meta-semantic/ir-types.ts
    - packages/core/src/meta-semantic/ir-types.test.ts
    - packages/core/src/meta-semantic/ir-validate.ts
    - packages/core/src/meta-semantic/ir-validate.test.ts
    - packages/core/src/meta-semantic/ir-bridge.ts
    - packages/core/src/meta-semantic/ir-bridge.test.ts
    - packages/core/src/meta-semantic/ir-nesting-bridge.ts
    - packages/core/src/meta-semantic/ir-nesting-bridge.test.ts
---

# Meta-Semantic IR — ModuleIR

## 목적 ^purpose

ModuleIR를 구조적 의도 컨테이너로 정의한다. 코드에서 추출한 기능 단위를 어떤 경계로 나누고, 어떤 계약을 외부에 노출하며, 상하위 계층에 어떻게 연결할지를 명시하는 것이 목적이다.

## 정의 ^defines

- `ModuleIR`
- `ModuleRef`
- `relations.parent / children / internal / external`
- 계약의 하향 전달, 트랜잭션의 상향 전달 원칙
- `DefLevel` 자동 추론 규칙

## 소비 ^consumes

- `DataRef`
- `PipeRef`
- `DefLevel`
- `DefLayer`

## 구성 ^overview

- Module은 데이터 패싯 중 일부가 존재하는 검증 가능한 기능 단위다.
- 외부 계약은 `inputs / outputs / sideEffects`로 표현한다.
- 계층 관계는 `parent / children / internal / external`로 표현한다.
- 상위는 계약을 내려주고, 하위는 계약 범위 안에서 생산/소비/실행을 수행한다.

## Module 경계

Module은 패싯 전체를 갖는 거대한 객체가 아니라, **검증 가능한 기능 단위**를 표현한다.

- 순수 함수: 정의 + 생산 + 소비만 가질 수 있다.
- 서비스 클래스: 정의 + 관리 + 생산 + 소비 + 저장을 모두 가질 수 있다.
- 핵심 판정 질문은 "이 단위를 독립적으로 검증할 수 있는가"이다.

```ts
interface ModuleIR {
  id: string;
  source: {
    filePath: string;
    line: number;
    kind: "class" | "function" | "module" | "namespace";
  };
  interface: {
    inputs: DataRef[];
    outputs: DataRef[];
    sideEffects: PipeRef[];
  };
  relations: {
    parent: ModuleRef | null;
    children: ModuleRef[];
    internal: ModuleRef[];
    external: ModuleRef[];
  };
  meta: {
    level: "group" | "module" | "leaf";
    layer?: "domain" | "operation" | "mediation" | "experience";
    defDocRef?: string;
  };
}
```

## 계약의 하향 전달

ModuleIR의 핵심 규칙은 **상호 무지, 자기 계약 명확**이다.

- 상위는 하위의 세부 구현을 몰라도 된다.
- 하위는 상위의 전체 구조를 몰라도 된다.
- 각 바운더리는 자신이 소비해야 할 데이터, 계약, 트랜잭션만 명확히 안다.
- 공유되는 데이터가 있으면 상위 계층이 관리자 역할을 맡아 계약을 내려준다.

```text
상위 바운더리
  -> 계약 내려줌 (스키마, 검증 규칙, 트랜잭션 범위)
    -> 하위 바운더리 A
    -> 하위 바운더리 B

하위 바운더리
  -> 계약 범위 내에서 데이터 생산/소비
  -> 실행 결과와 트랜잭션을 상위로 전달
```

## DefLevel 자동 추론

ModuleIR의 관계 구조는 definition-catalog의 `level`과 직접 대응된다.

```text
relations.parent === null && relations.children.length > 0  -> group
relations.parent !== null && relations.children.length > 0  -> module
relations.children.length === 0                             -> leaf
```

이 규칙은 ModuleIR가 단순 AST 노드가 아니라, 문서 경계와 코드 경계를 동시에 정렬하는 기준임을 뜻한다.

## 소스 코드

| 파일 | 역할 |
|------|------|
| `core/src/meta-semantic/ir-types.ts` | `ModuleIR`, `ModuleInterface`, `ModuleRelations`, `ModuleMeta`, `ModuleRef` 타입 |
| `core/src/meta-semantic/ir-types.ts` | `inferModuleLevel()` — 계층에서 level 자동 추론 |
| `core/src/meta-semantic/ir-validate.ts` | `dangling-ref` (parent/child), `circular-parent`, `orphan-module` 탐지 |
| `core/src/meta-semantic/ir-audit.ts` | `level-mismatch`, `too-many-inputs/outputs/children`, `mixed-certainty` 감사 |
| `core/src/meta-semantic/ir-bridge.ts` | `pipeGraphToModuleIR()` — PipeGraph → ModuleIR 계층 변환 |
| `core/src/meta-semantic/ir-nesting-bridge.ts` | `nestingToModuleIRs()` — ScopeNesting → ModuleIR 변환, `crossValidate()` |
