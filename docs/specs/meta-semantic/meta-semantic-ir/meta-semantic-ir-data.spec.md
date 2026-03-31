---
def:
  id: meta-semantic-ir-data
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-ir
      type: refines
    - target: meta-semantic-system
      type: depends_on
    - target: meta-semantic-spacetime-uid
      type: depends_on
---

# Meta-Semantic IR — DataIR

## 목적 ^purpose

DataIR를 상태의 실체와 계약의 경계로 정의한다. 데이터의 생산·소비·정의·관리·저장 5원 역할을 분리하여, 어떤 타입이 어떤 계약 아래 어떤 UID 체계로 흐르는지 좌표화하는 것이 목적이다.

## 정의 ^defines

- `DataIR`
- `FieldDescriptor`
- 5원 분리 규칙
- `schemaHash`
- `certainty`
- `uid` / `uidScheme`

## 소비 ^consumes

- `ModuleRef`
- `RuleRef`
- `meta-semantic-spacetime-uid`

## 구성 ^overview

- 정의: 타입 구조와 필드 시그니처
- 관리: 계약과 검증 규칙을 소유하는 상위 계층
- 생산/소비: 데이터의 시작점과 사용 지점
- 저장: UID와 retention을 포함한 정체성 보존 계층

## 5원 분리 규칙

데이터는 아래 5가지 역할을 반드시 분리해서 본다.

| 역할 | 의미 | 책임자 |
|------|------|--------|
| 생산 | 데이터가 생성되는 시작점 | 하위 모듈 |
| 소비 | 계약의 소비 주체, UI 포함 | 하위 모듈 / UI |
| 정의 | 타입과 스키마의 구조 | 타입 시스템 |
| 관리 | 계약, 검증, 트랜잭션 보장 | 상위 모듈 |
| 저장 | UID, retention, 실제 저장 방식 | 좌표 시스템 |

이 다섯 역할이 섞이면 데이터의 정체성이 모호해지고, 좌표를 적절히 나누면서 일관성을 유지할 수 없다.

## DataIR 구조

```ts
interface DataIR {
  definition: {
    type: string;
    schemaHash: string;
    fields: FieldDescriptor[];
    certainty: "strict" | "flexible";
  };
  management: {
    managedBy: ModuleRef;
    validationRules: RuleRef[];
    transactionScope: "local" | "distributed";
  };
  lifecycle: {
    producedBy: ModuleRef[];
    consumedBy: ModuleRef[];
    transformedBy: ModuleRef[];
  };
  storage: {
    uid: string;
    uidScheme: string;
    storageType: "memory" | "db" | "event-stream";
    retention: "ephemeral" | "session" | "persistent";
  };
}
```

## 계약 위임과 공유 데이터

공유되는 데이터는 상위 계층이 관리한다.

- 여러 모듈이 같은 Data를 쓰면 `management.managedBy`는 상위 바운더리를 가리킨다.
- 상위는 계약과 검증 규칙을 내려준다.
- 하위는 그 계약 범위 내에서 자유롭게 생산하고 소비한다.
- 상위는 하위의 세부 구현을 몰라도 된다.

즉 DataIR는 타입 정보만이 아니라, **누가 계약을 소유하는가**까지 포함하는 관리 모델이다.

## schemaHash와 certainty

`schemaHash`는 구조적 정체성을 결정하는 해시다.

```text
schemaHash = deterministicHash(
  sortedFields.map(f => `${f.name}:${normalizeType(f.type)}:${f.optional}`)
)
```

규칙:

- 필드 순서는 이름 정렬 기준
- 타입은 정규화한다. 예: `string | undefined` -> `string?`
- 같은 구조는 같은 해시를 가진다

`certainty`는 타입이 얼마나 닫혀 있는지를 나타낸다.

- `strict`: 모든 필드가 concrete 타입
- `flexible`: any, unknown, generic, runtime 결정 타입 포함

## 저장과 UID 체계

저장의 핵심은 단순한 DB 종류가 아니라 **고유 식별자 부여 체계**다.

- `uid`는 데이터 인스턴스의 좌표 정체성이다.
- `uidScheme`는 어떤 주소 체계를 쓰는지 나타낸다.
- 같은 데이터의 다른 시점은 같은 경로 주소를 공유하되, 다른 시퀀스로 구분한다.
- UID 체계가 바뀌면 마이그레이션과 버전 관리가 필요하다.
