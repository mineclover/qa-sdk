---
def:
  id: meta-semantic-ir-pipe
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
    - target: meta-semantic-spacetime-uid
      type: depends_on
    - target: ms-concept-pipe
      type: refines
---

# Meta-Semantic IR — PipeIR

## 목적 ^purpose

PipeIR를 동적인 실행 트랜잭션 모델로 정의한다. Module과 Data를 실제 시간축 위에서 연결하고, 어떤 실행이 어떤 후속 실행을 촉발하는지의 인과 체인을 좌표화하는 것이 목적이다.

## 정의 ^defines

- `PipeIR`
- `PipeRef`
- `transactionId`
- `triggers`
- 시간 축 전진 규칙

## 소비 ^consumes

- `ModuleRef`
- `DataRef`
- `meta-semantic-spacetime-uid`

## 구성 ^overview

- Pipe는 실행 시점의 트랜잭션 단위다.
- `targetModule`은 실행 대상, `payload`는 입력 데이터다.
- `state`는 `pending / committed / rolledBack`으로 관리한다.
- `triggers`는 후속 파이프 체인을 만들어 인과 순서를 표현한다.

## PipeIR 구조

```ts
interface PipeIR {
  transactionId: string;
  targetModule: ModuleRef;
  payload: DataRef;
  state: "pending" | "committed" | "rolledBack";
  triggers: PipeRef[];
  source: {
    filePath: string;
    line: number;
    kind: "method-call" | "event-emit" | "http-request" | "db-query";
  };
}
```

## 시간 축 전진 규칙

PipeIR의 본질은 시간축 생성이다.

1. Pipe 실행 시 `transactionId`가 단조 증가한다.
2. 같은 Module 안에서도 Pipe마다 독립적인 시간 좌표를 가진다.
3. `triggers`로 연결된 Pipe는 인과적 순서를 이룬다.
4. `rolledBack` 상태도 이력은 유지한다. 좌표는 사라지지 않는다.

즉 Pipe는 단순한 호출 로그가 아니라, Spacetime UID의 temporal identity를 발생시키는 원천이다.

## Module/Data와의 관계

```text
Module --sideEffects--> Pipe
Pipe   --targetModule--> Module
Pipe   --payload-------> Data
Pipe   --triggers------> Pipe
```

해석:

- Module은 어떤 Pipe를 유발하는지 정의한다.
- Pipe는 실제로 어떤 Module이 실행됐는지 나타낸다.
- Data는 Pipe의 입력/출력 경계에서 시간축을 가진 상태로 이동한다.

## 순환과 롤백 규칙

- `Pipe.triggers -> Pipe`의 직접 순환은 금지한다.
- 무한 루프를 피하려면 인과 체인은 DAG로 유지한다.
- `rolledBack`는 실패한 실행을 제거하는 것이 아니라, 실패한 실행을 보존한 채 상태만 바꾼다.
- 따라서 rollback도 관측 가능한 경로로 남아야 한다.

## 소스 코드

| 파일 | 역할 |
|------|------|
| `core/src/meta-semantic/ir-types.ts` | `PipeIR`, `PipeSourceLocation`, `PipeRef` 타입 |
| `core/src/meta-semantic/ir-validate.ts` | `circular-pipe` 탐지 (DFS) |
| `core/src/meta-semantic/ir-bridge.ts` | `pipeSpecToIR()` — PipeSpec → PipeIR 변환 |
