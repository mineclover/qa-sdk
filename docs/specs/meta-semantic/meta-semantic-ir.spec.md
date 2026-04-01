---
def:
  id: meta-semantic-ir
  level: module
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: system-concepts
      type: depends_on
    - target: meta-semantic-ir-module
      type: contains
    - target: meta-semantic-ir-data
      type: contains
    - target: meta-semantic-ir-pipe
      type: contains
---

# Meta-Semantic IR — 3종 중간 표현 모델

## 목적 ^purpose

TypeScript 코드에서 추출한 의도를 표현하는 3종 IR(Module · Data · Pipe) 구조를 정의한다.
코드를 "텍스트"가 아닌 "좌표를 가진 의도 객체의 네트워크"로 변환하기 위한 데이터 모델이다.

## 방법 ^method

**ModuleIR**이 바운더리에 의해 정의된 계층 구조를 표현하고,
**DataIR**이 패싯 역할별(생산/소비/정의/관리/저장) 데이터 스키마를 분리하고,
**PipeIR**이 트랜잭션 실행으로 시간 축을 전진시키고,
**참조 타입**(ModuleRef/DataRef/PipeRef)이 IR 간 타입 안전한 연결을 제공하고,
계약은 **하향 위임**(parent→children), 트랜잭션은 **상향 전달**(pipe→module)한다.

## 정의 ^defines

- `ModuleIR` — 구조적 의도 컨테이너 (정적, 계층적)
- `DataIR` — 데이터 패싯 규칙 (생산/소비/정의/관리/저장)
- `PipeIR` — 실행 트랜잭션 (동적, 시간축 생성기)
- `DataRef`, `ModuleRef`, `PipeRef` — IR 간 참조 타입
- 데이터 계약의 하향 위임 + 트랜잭션의 상향 전달 원칙
- 데이터 패싯 = 좌표를 적절히 나누면서 일관성을 유지하기 위한 설계 규칙

## 소비 ^consumes

- `WeightedIndex` (weighted-index) — 좌표 압축
- `SemanticAddress` (weighted-index/protocol) — 주소 직렬화
- `DefLevel` (definition-catalog) — group/module/leaf 분해 레벨
- `DefLayer` (definition-catalog) — domain/operation/mediation/experience

## 위임 ^delegates

- **meta-semantic-ir-module** → ModuleIR 상세 구조, 계층 규칙, 계약 위임 메커니즘
- **meta-semantic-ir-data** → DataIR 패싯 모델, 정합성 경계, 스키마 해싱
- **meta-semantic-ir-pipe** → PipeIR 트랜잭션 모델, 시간축 전진, 부수효과 체인

## 구성 ^overview

3개 IR 유형의 직교적 역할:

| IR | 공간 | 시간 | 역할 |
|---|---|---|---|
| Module | 정적 (구조 트리) | 불변 | 의도의 컨테이너 — **어디에** 로직이 있는가 |
| Data | 준정적 (스키마) + 동적 (인스턴스) | 변경 추적 | 상태의 실체 — **무엇이** 흐르는가 |
| Pipe | 동적 (트랜잭션) | 생성자 | 실행의 트리거 — **언제** 변하는가 |

---

## 1. IR 참조 타입

IR 요소 간 참조는 타입 안전한 ref 객체로 표현한다.

```typescript
/** 모듈 참조 */
interface ModuleRef {
  moduleId: string;          // ModuleIR.id
  address?: number;          // 인코딩된 좌표 (할당 후)
}

/** 데이터 참조 */
interface DataRef {
  dataId: string;            // DataIR.definition.type + schemaHash
  schemaHash: string;        // 구조적 정체성
}

/** 파이프 참조 */
interface PipeRef {
  pipeId: string;            // PipeIR.transactionId
  targetModule: ModuleRef;   // 실행 대상
}
```

---

## 2. ModuleIR 구조

### Module = 바운더리에 의해 정의

모듈의 경계는 **바운더리**(패싯 중 일부가 존재하는 검증 가능 기능 단위)에 의해 결정된다.

> 바운더리 개념 상세: `ms-concept-boundary` 참조
> 계약 하향 원칙 상세: `ms-concept-contract-descent` 참조

```typescript
interface ModuleIR {
  /** 의도의 결정론적 ID — interface 구조 해시에서 파생 */
  id: string;

  /** 원본 소스 위치 */
  source: {
    filePath: string;       // 상대 경로
    line: number;           // 시작 줄
    kind: 'class' | 'function' | 'module' | 'namespace';
  };

  /** 외부 계약 — 이 바운더리가 소비/생산하는 것 */
  interface: {
    inputs: DataRef[];       // 이 바운더리가 소비하는 데이터
    outputs: DataRef[];      // 이 바운더리가 생산하는 데이터
    sideEffects: PipeRef[];  // 유발하는 부수효과
  };

  /** 계층적 관계 — 계약 전달 경로 */
  relations: {
    parent: ModuleRef | null;   // 계약을 내려주는 상위 계층
    children: ModuleRef[];      // 계약 범위 내에서 동작하는 하위 계층
    internal: ModuleRef[];      // 캡슐화된 내부 모듈
    external: ModuleRef[];      // 외부 의존 (import)
  };

  /** definition-catalog 대응 메타데이터 */
  meta: {
    level: 'group' | 'module' | 'leaf';  // 자동 추론
    layer?: 'domain' | 'operation' | 'mediation' | 'experience';
    defDocRef?: string;      // 연결된 definition-catalog 문서 ID
  };
}
```

### 계약의 하향 전달, 트랜잭션의 상향 전달

**상호 무지, 자기 계약 명확.** 상세 원칙은 `ms-concept-contract-descent` 참조.

ModuleIR에서의 적용:
- `relations.parent` — 계약을 내려주는 상위 바운더리
- `relations.children` — 계약 범위 내에서 동작하는 하위 바운더리
- `relations.external` — peer 관계 (동등 수준, API 계약)

### DefLevel 자동 추론

```
relations.parent === null && relations.children.length > 0  → group
relations.parent !== null && relations.children.length > 0  → module
relations.children.length === 0                             → leaf
```

---

## 3. DataIR 구조

### 데이터 패싯 규칙

DataIR은 데이터 패싯 규칙에 따라 역할별 필드가 분리되어 있다.

> 데이터 패싯 개념 상세: `ms-concept-data-facets` 참조

### 인터페이스

```typescript
interface DataIR {
  /**
   * 정의 (Definition) — 기능적 필요에 의한 스펙 정의, 스키마
   * 이 데이터가 어떤 형태인지를 결정한다.
   */
  definition: {
    type: string;              // TypeScript 인터페이스/타입 이름
    schemaHash: string;        // 타입 구조의 결정론적 해시
    fields: FieldDescriptor[]; // 필드 목록 (name, type, optional)
    certainty: 'strict' | 'flexible';  // any/unknown 포함 여부
  };

  /**
   * 관리 (Management) — 정합성 보장, 트랜잭션 보장
   * 계약은 관리에 해당한다. 상위 모듈이 계약을 내려주고,
   * 하위 모듈은 이 계약 범위 내에서 동작한다.
   */
  management: {
    managedBy: ModuleRef;        // 정합성 보장 주체 (공유 시 상위 계층)
    validationRules: RuleRef[];  // 검증 규칙 — 상위가 내려주는 계약
    transactionScope: 'local' | 'distributed';
  };

  /**
   * 생산 (Production) — 입력 받는 쪽, 생성되는 쪽, 시작점
   * 소비 (Consumption) — 계약의 소비 주체, UI 표시 등
   */
  lifecycle: {
    producedBy: ModuleRef[];     // 데이터의 시작점 (생성자)
    consumedBy: ModuleRef[];     // 데이터의 소비 주체 (UI 표시 등)
    transformedBy: ModuleRef[];  // 형태를 변환하는 중간자
  };

  /**
   * 저장 (Storage) — 실제 저장 방식
   * 고유 식별자 부여 및 부여 체계가 핵심.
   * 좌표를 적절히 나누면서 일관성을 유지하기 위한 규칙.
   */
  storage: {
    uid: string;                 // Spacetime UID — 일관된 좌표 주소
    uidScheme: string;           // 사용된 주소 체계 (intent:v1, custom 등)
    storageType: 'memory' | 'db' | 'event-stream';
    retention: 'ephemeral' | 'session' | 'persistent';
  };
}

interface FieldDescriptor {
  name: string;
  type: string;            // TypeScript 타입 문자열
  optional: boolean;
  hasDefault: boolean;
}
```

### 계약 위임과 공유 데이터

공유 데이터의 계약 관리는 `ms-concept-contract-descent` 규칙 4를 따른다:
n개 모듈이 같은 Data를 공유하면 상위 계층에 관리 위임.
`management.managedBy`가 이 상위 바운더리를 가리킨다.

### 스키마 해시 규칙

```
schemaHash = deterministicHash(
  sortedFields.map(f => `${f.name}:${normalizeType(f.type)}:${f.optional}`)
)
```

- 필드 순서 무관 (이름 정렬)
- 타입 정규화: `string | undefined` → `string?`
- 같은 구조 = 같은 해시 = 같은 좌표 (구조적 동등성)

### certainty 판정

```
strict:   모든 field가 concrete 타입 (string, number, boolean, enum, 다른 strict interface)
flexible: any, unknown, Record<string, any>, generic T 등 런타임 결정 타입 포함
```

시각화에서 strict → 다각형, flexible → 구름으로 표현된다.

### 저장과 UID 체계

저장 역할의 핵심은 UID 부여 체계다. 상세는 `ms-concept-spacetime-uid` 및 `meta-semantic-spacetime-uid` 참조.

---

## 4. PipeIR 구조

```typescript
interface PipeIR {
  /** 트랜잭션 ID — 시간 축 좌표의 원천 */
  transactionId: string;

  /** 실행 대상 모듈 */
  targetModule: ModuleRef;

  /** 입력 데이터 참조 */
  payload: DataRef;

  /** 트랜잭션 상태 */
  state: 'pending' | 'committed' | 'rolledBack';

  /** 후속 파이프 체인 (실행 결과에서 파생) */
  triggers: PipeRef[];

  /** 원본 소스 위치 */
  source: {
    filePath: string;
    line: number;
    kind: 'method-call' | 'event-emit' | 'http-request' | 'db-query';
  };
}
```

### 시간 축 전진 규칙

1. Pipe 실행 시 `transactionId`가 단조 증가
2. 같은 Module 내에서도 Pipe마다 독립적 시간 좌표
3. Pipe 체인: `triggers`로 연결된 Pipe는 인과적 순서를 형성
4. `rolledBack` 상태의 Pipe도 좌표는 유지 (이력 불변성)

---

## 5. IR 간 관계 규칙

### Module ↔ Data: 바운더리 관계

Module이 Data의 패싯을 통합하는 바운더리이므로, 모든 Data 역할이 Module을 통해 연결된다:

```
Data 패싯               Module에서의 역할
─────────              ──────────────────
정의 (definition)   →  Module.interface의 타입 시그니처가 스키마를 결정
관리 (management)   →  Module = managedBy의 대상. 계약을 내려주는 주체
생산 (production)   →  Module.interface.inputs — 이 바운더리로 데이터가 들어옴
소비 (consumption)  →  Module.interface.outputs — 이 바운더리에서 데이터가 나감
저장 (storage)      →  Module 경계에서 UID가 할당되어 좌표 체계에 진입
```

### 전체 참조 그래프

```
Module ──interface.inputs──→ Data (이 바운더리의 생산 시작점)
Module ──interface.outputs──→ Data (이 바운더리의 소비 전달점)
Module ──interface.sideEffects──→ Pipe (트리거)
Module ──relations.*──→ Module (계층/의존)

Data ──management.managedBy──→ Module (계약을 내려주는 바운더리)
Data ──lifecycle.producedBy──→ Module (생산자)
Data ──lifecycle.consumedBy──→ Module (소비자)

Pipe ──targetModule──→ Module (실행 대상)
Pipe ──payload──→ Data (입력)
Pipe ──triggers──→ Pipe (인과 체인)
```

### 순환 참조 규칙

| 관계 | 순환 허용 |
|------|----------|
| Module.relations.parent → Module | 금지 (트리) |
| Module.relations.children → Module | 금지 (트리) |
| Module.relations.external → Module | 허용 (상호 의존) |
| Data.lifecycle.producedBy ↔ consumedBy | 허용 (피드백 루프) |
| Pipe.triggers → Pipe | 금지 (무한 루프 방지) |

---

## 6. 검증 규칙

| 검증 | 심각도 | 설명 |
|------|--------|------|
| orphan-module | warning | 어떤 parent에도 속하지 않는 비루트 모듈 |
| orphan-data | warning | producedBy/consumedBy 모두 비어 있는 데이터 |
| missing-manager | error | Data.management.managedBy가 null |
| circular-parent | error | Module.relations.parent 순환 |
| circular-pipe | error | Pipe.triggers 순환 |
| schema-collision | warning | 다른 type 이름인데 같은 schemaHash |
| dangling-ref | error | 존재하지 않는 ModuleRef/DataRef/PipeRef |
