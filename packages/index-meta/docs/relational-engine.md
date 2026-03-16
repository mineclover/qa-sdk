# Relational Engine — 설계 문서

## 1. 핵심 아이디어

index-meta가 n차원 → 1D 정수 인코딩을 제공하는 시점에서, **하나의 index가 곧 관계형 테이블**이다.

| 관계형 개념 | index-meta 대응 | 이미 구현됨 |
|---|---|---|
| 테이블 정의 | IndexDef (dims 순서 = 컬럼) | O |
| 행 (row) | VersionedValue.value (1D 정수) | O |
| Foreign Key | `index_ref` dim / `entryRefs` | O |
| JOIN | `deepDecode` / `composeQuery` | O |
| WHERE | `matchRanges` (BETWEEN 쿼리) | O |
| Rule / Policy | `matchRules` / `resolvePolicy` | O |
| 테이블 라우팅 | PrefixRouter (prefix → store) | O |

**새로운 것**: 관계 유형 자체를 하나의 index로 선언하고, 그 값을 축으로 rule 엔진과 prefix 라우팅을 구성하는 **컨벤션과 구조**.

---

## 2. 관계 유형 정의 Index 컨벤션

### 2.1 스키마 구조

관계 유형 index는 **관계의 구조**를 정의한다. 최소 3차원:

```
subject_kind × predicate × object_kind
```

각 dim은 도메인의 엔티티 종류(kind)와 동사(predicate)를 열거한다.

```ts
const schema: MetaRegistryInput = {
  dims: {
    subject_kind: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정)',
      snapshots: {
        v1: {
          entries: ["_", "user", "group", "role", "service"],
          capacity: 8,  // headroom 3
        },
      },
    },
    predicate: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정)',
      snapshots: {
        v1: {
          entries: ["_", "has", "owns", "can_access", "inherits", "belongs_to", "delegates_to"],
          capacity: 16,  // headroom 9 — 동사는 확장 빈도가 높음
        },
      },
    },
    object_kind: {
      kind: { type: "string_enum" },
      description: 'reserved: [1]="_" (미지정)',
      snapshots: {
        v1: {
          entries: ["_", "user", "group", "role", "permission", "resource", "action", "service"],
          capacity: 16,
        },
      },
    },
  },
  indices: {
    rel: {
      dims: ["subject_kind", "predicate", "object_kind"],
      versions: {
        v1: {
          snapshots: { subject_kind: "v1", predicate: "v1", object_kind: "v1" },
        },
      },
    },
  },
};
```

### 2.2 컨벤션 규칙

1. **index 이름**: `rel` (또는 도메인 접두사 포함 `{domain}_rel`)
2. **dim 순서**: `subject_kind → predicate → object_kind` 고정. WeightedIndex shape 순서가 곧 S-P-O 순서.
3. **reserved entry**: `"_"` (position 1)를 반드시 포함. 부분 관계(predicate만, subject만 등) 표현에 필요.
4. **capacity headroom**: predicate는 확장이 잦으므로 넉넉하게. kind는 도메인 엔티티 종류에 따라.
5. **추가 dim 허용**: 필요 시 `context`, `scope`, `domain` 등 4번째 이상의 dim 추가 가능. S-P-O 뒤에 배치.

### 2.3 관계 유형 값의 역할

```ts
const sdk = createIndexSDK(schema);
const rel = sdk.client("rel", "v1");

// 관계 유형 인코딩
const userHasRole = rel.encode({
  subject_kind: "user", predicate: "has", object_kind: "role"
});
// → { indexId: "rel", versionId: "v1", value: 19 }

const roleCanPerm = rel.encode({
  subject_kind: "role", predicate: "can_access", object_kind: "permission"
});
// → { indexId: "rel", versionId: "v1", value: 52 }
```

이 값(`19`, `52`)이 시스템 전체에서 3가지 역할을 한다:

| 역할 | 사용처 | 메커니즘 |
|---|---|---|
| **Prefix Key** | 인스턴스 저장소 라우팅 | PrefixRouter가 `rel:v1:19` → 해당 store로 라우팅 |
| **index_ref Entry** | 다른 index에서 관계 유형 참조 | dim kind `index_ref`로 rel index 참조 |
| **Rule Pattern Axis** | 규칙 매칭의 좌표 | `matchRules`로 S-P-O 좌표 공간에서 패턴 매칭 |

---

## 3. Instance 저장 — Prefix 라우팅

### 3.1 Rel-Type Value → Prefix

각 관계 유형 값이 인스턴스 데이터의 prefix가 된다.

```
rel:v1:19  ("user has role")
  ├─ instance: (alice, admin)    → 인스턴스 정수값 0
  ├─ instance: (alice, editor)   → 인스턴스 정수값 1
  └─ instance: (bob, viewer)     → 인스턴스 정수값 2

rel:v1:52  ("role can_access permission")
  ├─ instance: (admin, read)     → 인스턴스 정수값 0
  ├─ instance: (admin, write)    → 인스턴스 정수값 1
  └─ instance: (editor, read)    → 인스턴스 정수값 2
```

PrefixRouter 매핑:
```ts
// prefix → D1 database 라우팅
router.register("rel:v1:19", "d1-user-role");
router.register("rel:v1:52", "d1-role-perm");
// 또는 같은 DB에 prefix로 분리
router.register("rel:v1:*", "d1-relations");
```

### 3.2 Instance Schema 도출

관계 유형의 `subject_kind`와 `object_kind`가 인스턴스 index의 dim을 결정한다.

```
rel_type = { subject_kind: "user", predicate: "has", object_kind: "role" }
→ instance index dims: [user_ref, role_ref]
→ user_ref → users index의 index_ref
→ role_ref → roles index의 index_ref
```

**도출 규칙:**

```ts
interface RelTypeInstanceSchema {
  /** 관계 유형의 1D 값 */
  relTypeValue: number;
  /** subject_kind 값 → 어떤 index를 참조하는지 */
  subjectRef: { kind: string; indexId: string };
  /** object_kind 값 → 어떤 index를 참조하는지 */
  objectRef: { kind: string; indexId: string };
}
```

이 도출은 **kind → index 매핑 레지스트리**가 필요하다:

```ts
// kind 이름 → 해당 종류의 마스터 index
const kindToIndex: Record<string, string> = {
  user: "users",
  group: "groups",
  role: "roles",
  permission: "permissions",
  resource: "resources",
  action: "actions",
  service: "services",
};
```

이 매핑은 관계 유형 index 옆에 선언하며, `rel` index 자체와는 독립적이다 (인스턴스 스키마 생성에만 사용).

### 3.3 범용 Instance Encoding

인스턴스의 실제 인코딩은 두 가지 전략이 가능하다:

**전략 A — 관계별 전용 index**: 각 관계 유형마다 별도 IndexDef를 생성.
```ts
// "user has role" 전용
user_has_role: {
  dims: ["user_id", "role_id"],  // 각각 index_ref
  ...
}
```
- 장점: 타입 안전, 쿼리 최적
- 단점: 관계 유형 수 × index 수 → 관리 비용

**전략 B — 범용 2-dim index**: subject_id × object_id로 통일하고, prefix로 구분.
```ts
// 모든 관계 유형이 공유하는 범용 스키마
rel_instance: {
  dims: ["subject_id", "object_id"],  // number_enum — 각 인스턴스의 마스터 index 값
  ...
}
```
- 장점: 하나의 index 스키마로 모든 관계 처리
- 단점: subject/object의 의미가 prefix에 의존 (런타임 해석)

**권장: 전략 B + 메타데이터**. 1D 환원의 장점을 극대화하려면 범용 스키마가 유리하다. 의미 해석은 rel_type decode로 복원.

---

## 4. Rule Engine

### 4.1 설계 원칙

Rule Engine은 **기존 policy-resolver를 2단계로 합성**하는 구조다. 새로운 매칭 알고리즘이 아니라, 기존 `matchRules` + `resolvePolicy`를 관계 유형 좌표 공간에 적용하는 것.

```
Level 1: 관계 유형 매칭 (rel index의 좌표 공간)
Level 2: 인스턴스 매칭 (instance index의 좌표 공간)
```

### 4.2 Level 1 — 관계 유형 매칭

```ts
import type { PolicyRule, ConflictStrategy } from "index-meta";

// 관계 유형 좌표 공간에서 규칙 정의
// shape = [subject_kind.length, predicate.length, object_kind.length]

interface RelRule<T> extends PolicyRule<T> {
  // pattern: CoordConstraint[] — subject_kind, predicate, object_kind 좌표
  // value: T — 규칙 효과
}

// 예: "user가 주체인 모든 관계에 대해 감사 로깅 필수"
const auditRule: RelRule<RuleEffect> = {
  pattern: ["2", null, null],  // subject_kind=user(pos 2), 나머지 와일드카드
  value: { auditLog: true },
};

// 예: "role can_access permission 관계는 최대 50개 인스턴스"
const limitRule: RelRule<RuleEffect> = {
  pattern: ["4", "4", "5"],  // role(4), can_access(4), permission(5) — 1-based positions
  value: { maxInstances: 50 },
};

// 예: "모든 inherits 관계는 순환 감지 필수"
const cycleRule: RelRule<RuleEffect> = {
  pattern: [null, "5", null],  // predicate=inherits(pos 5)
  value: { requireCycleCheck: true },
};
```

매칭:
```ts
const relCodec = registry.createCodec("rel", "v1");

// "role can_access permission" → 좌표 추출
const coords = relCodec.decodeToCoords(relTypeValue);
// → [4, 4, 5] (role=4, can_access=4, permission=5)

const matched = matchRules(coords, rules, relShape);
// → [limitRule, auditRule]  (specificity 순)
```

### 4.3 Level 2 — 인스턴스 매칭

Level 1에서 매칭된 규칙이 인스턴스 수준 제약을 포함할 수 있다:

```ts
interface RuleEffect {
  // 관계 유형 수준 제약
  auditLog?: boolean;
  maxInstances?: number;
  requireCycleCheck?: boolean;
  requireApproval?: boolean;

  // 인스턴스 수준 제약 (선택적)
  instanceConstraint?: {
    pattern: CoordConstraint[];  // instance index 좌표 공간의 패턴
    effect: "deny" | "allow" | "require_approval";
  };
}
```

예:
```ts
// "user has role 관계에서 admin role은 승인 필요"
{
  pattern: ["2", "2", "4"],  // user(2), has(2), role(4)
  value: {
    instanceConstraint: {
      pattern: [null, "1"],  // object_id = admin role의 position
      effect: "require_approval",
    },
  },
}
```

### 4.4 Two-Level 합성 흐름

```
                    ┌─────────────────────────────┐
  rel_type value ──→│  Level 1: matchRules(coords, │
                    │    relRules, relShape)        │
                    └──────────┬──────────────────┘
                               │ matched rules
                               ▼
                    ┌─────────────────────────────┐
                    │  Type-level effects 적용      │
                    │  (auditLog, maxInstances...) │
                    └──────────┬──────────────────┘
                               │ instanceConstraint가 있는 규칙
                               ▼
                    ┌─────────────────────────────┐
  instance value ──→│  Level 2: matchRules(coords, │
                    │    instanceRules, instShape)  │
                    └──────────┬──────────────────┘
                               │ matched instance rules
                               ▼
                    ┌─────────────────────────────┐
                    │  resolvePolicy(strategy)     │
                    │  → 최종 effect               │
                    └─────────────────────────────┘
```

### 4.5 API Surface (신규)

```ts
/**
 * 관계 유형 인덱스 기반 2-level rule engine.
 *
 * 기존 matchRules/resolvePolicy를 합성하는 얇은 레이어.
 */

/** 관계 유형 수준 규칙 */
interface RelationRule<T> {
  /** rel index 좌표 공간의 패턴 (S-P-O) */
  typePattern: CoordConstraint[];
  /** 규칙 효과 */
  effect: T;
  /** 인스턴스 수준 추가 제약 (선택) */
  instancePattern?: CoordConstraint[];
  /** 우선순위 */
  priority?: number;
}

/** 2-level 규칙 매칭 결과 */
interface RelationRuleMatch<T> {
  rule: RelationRule<T>;
  typeSpecificity: number;
  instanceSpecificity?: number;
}

/**
 * rel_type 값과 instance 값에 대해 매칭되는 규칙 반환.
 *
 * @param relTypeValue - 관계 유형의 1D 값 (rel index의 encode 결과)
 * @param instanceValue - 인스턴스의 1D 값 (instance index의 encode 결과, 선택)
 * @param rules - 관계 규칙 배열
 * @param relCodec - rel index의 MetaCodec
 * @param instanceCodec - instance index의 MetaCodec (선택)
 */
function matchRelationRules<T>(
  relTypeValue: number,
  instanceValue: number | undefined,
  rules: RelationRule<T>[],
  relCodec: MetaCodec,
  instanceCodec?: MetaCodec,
): RelationRuleMatch<T>[];

/**
 * 2-level 정책 해석.
 */
function resolveRelationPolicy<T>(
  relTypeValue: number,
  instanceValue: number | undefined,
  rules: RelationRule<T>[],
  relCodec: MetaCodec,
  instanceCodec: MetaCodec | undefined,
  strategy: ConflictStrategy,
): T | T[] | undefined;
```

---

## 5. Prefix 조합 — 복합 관계

### 5.1 Transitive Relationship (경유 관계)

두 관계 유형을 연결해 경유 관계를 정의한다.

```
"user has role" (rel:v1:19) + "role can_access permission" (rel:v1:52)
→ "user can_access permission via role"
```

**조건**: 첫 번째 관계의 `object_kind` = 두 번째 관계의 `subject_kind`.

```ts
interface TransitiveRelation {
  /** 경유 체인. 순서대로 적용 */
  chain: number[];  // rel_type values: [19, 52]
  /** 유도되는 관계 (선택적 — 명시하지 않으면 자동 추론) */
  derived?: {
    subject_kind: string;  // "user" (chain[0]의 subject)
    predicate: string;     // "can_access" (chain[-1]의 predicate)
    object_kind: string;   // "permission" (chain[-1]의 object)
  };
}
```

**평가**:

```
1. chain[0] 인스턴스에서 subject=alice인 행 조회
   → alice has role: [admin, editor]

2. chain[1] 인스턴스에서 subject∈[admin, editor]인 행 조회
   → admin can_access: [read, write]
   → editor can_access: [read]

3. 결과: alice can_access permission: [read, write]
```

이 평가는 `composeQuery` 체이닝으로 구현 가능:
```ts
// chain[1] → chain[0] 방향으로 composeQuery
const ranges = composeQuery(
  { indexId: "rel_instance", versionId: "v1" },  // chain[0] instance
  "object_id",  // chain[0]의 object = chain[1]의 subject
  { subject_id: "alice_pos" },  // 시작 조건
  registry,
);
```

### 5.2 Compound Relationship (복합 관계)

여러 관계 유형의 AND/OR 조합.

```
"user has role" AND "user belongs_to group"
→ "user with role in group" (교집합)
```

```ts
interface CompoundRelation {
  op: "AND" | "OR";
  members: number[];  // rel_type values
  /** 공유 축. 교집합/합집합의 기준 */
  joinOn: "subject" | "object";
}
```

**AND (교집합)**: joinOn 축의 값이 모든 members에 존재해야 함.
```
user has role: { alice: [admin], bob: [editor] }
user belongs_to group: { alice: [engineering], charlie: [sales] }
→ AND on subject: alice만 (두 관계 모두 존재)
```

**OR (합집합)**: joinOn 축의 값이 하나 이상의 member에 존재.

### 5.3 Prefix 조합 표현

복합 관계는 prefix 조합으로 표현한다:

```
단일:      rel:v1:19                     → "user has role"
경유:      rel:v1:19+rel:v1:52           → "user→role→permission"
복합(AND): rel:v1:19&rel:v1:16           → "user has role AND belongs_to group"
복합(OR):  rel:v1:19|rel:v1:16           → "user has role OR belongs_to group"
```

PrefixRegistry에 등록:
```ts
// 경유 관계 등록
registry.register({
  prefix: "rel:v1:19+rel:v1:52",
  versionId: "v1",
  capacity: derivedCapacity,
  refs: [
    { prefix: "rel:v1:19", versionId: "v1", capacity: c1 },
    { prefix: "rel:v1:52", versionId: "v1", capacity: c2 },
  ],
  compositionType: "transitive",  // 새 필드
});
```

기존 PrefixRegistryRecord의 `refs: DimRef[]`가 이미 composite를 지원하므로, `compositionType` 필드만 추가하면 경유/복합을 구분할 수 있다.

---

## 6. 기존 구현과의 관계

### 변경 없이 활용

| 기능 | 활용 방식 |
|---|---|
| `MetaRegistry` + `MetaCodec` | rel index와 instance index의 encode/decode |
| `matchRules` / `resolvePolicy` | Level 1 (type) + Level 2 (instance) 매칭 |
| `composeQuery` | transitive relation 평가 (체이닝) |
| `deepDecode` | rel_type → instance 재귀 탐색 |
| `PrefixRouter` | rel_type value → instance store 라우팅 |
| `PrefixRegistry` composite refs | prefix 조합의 DAG 저장 |
| `getReverseRefs` | "이 kind를 참조하는 관계 유형" 역탐색 |

### 신규 구현 필요

| 모듈 | 역할 | 의존 |
|---|---|---|
| **relation-schema.ts** | 관계 유형 index 스키마 빌더 + kind→index 매핑 관리 | core (MetaRegistry) |
| **relation-rule.ts** | 2-level rule matching (`matchRelationRules`, `resolveRelationPolicy`) | core (MetaCodec), policy-resolver |
| **relation-compose.ts** | transitive/compound 관계 정의 + 평가 | core, cross-index-query |
| **relation-prefix.ts** | prefix 조합 문법 파싱 + PrefixRegistry 연동 | infra (PrefixRegistry) |

---

## 7. 패키지 경계 정의

### 분리 기준: 배포 컨텍스트 × 의존성 방향

```
index-meta-core
├── types, errors
├── MetaRegistry, MetaCodec, MetaResolver
├── IndexSDK (createIndexSDK)
├── address-protocol-manager
├── table-def, compile-schema
├── [NEW] relation-schema (관계 유형 컨벤션 헬퍼)
│
│   deps: weighted-index만
│   배포: 모든 환경 (브라우저, Edge, Node)

index-meta-query
├── cross-index-query (deepDecode, composeQuery)
├── version-query
├── policy-resolver (matchRules, resolvePolicy)
├── invalid-ranges (게이트 계산)
├── migrate-address
├── [NEW] relation-rule (2-level rule engine)
├── [NEW] relation-compose (transitive/compound 평가)
│
│   deps: index-meta-core
│   배포: 서비스 레이어

index-meta-store
├── index-meta-store (인터페이스)
├── entry-flag-store, invalid-range-store (인터페이스)
├── adapters/* (InMemory, SQL, SQLite, D1)
├── backup, api-payload
│
│   deps: index-meta-core
│   배포: 데이터 서버 (Node.js)

index-meta-infra
├── prefix-registry, prefix-router
├── schema-sync, distributed-client
├── [NEW] relation-prefix (prefix 조합 파싱 + 등록)
│
│   deps: index-meta-core, index-meta-store
│   배포: 마스터 서버
```

### 의존성 그래프

```
            index-meta-core
           ╱       │       ╲
    query ←        │        → store
      │            │            │
      └──────→ index-meta-infra ←┘
```

### 현재 진입점과의 호환

| 현재 | 분리 후 |
|---|---|
| `index-meta` (full) | `index-meta-core` + `index-meta-query` + `index-meta-store` + `index-meta-infra` 통합 re-export |
| `index-meta/client` | `index-meta-core` 단독 (변경 없음) |

**통합 패키지 `index-meta`는 유지**하되, 내부적으로 4개 하위 패키지를 re-export. 세밀한 의존성이 필요한 소비자만 하위 패키지를 직접 import.

### 경계의 핵심 기준

1. **core**: `weighted-index` 외 외부 의존성 없음. 순수 로직만.
2. **query**: core에만 의존. 저장소 접근 없음 (인메모리 데이터만 처리).
3. **store**: Node.js/SQL 의존. 인터페이스 + 구현체.
4. **infra**: store + core 의존. 분산 라우팅, prefix 조합.

---

## 8. 구현 우선순위

### Phase 1: 관계 유형 컨벤션 확립

1. `relation-schema.ts` — 관계 유형 index 스키마 빌더
   - `defineRelationType(config)` → MetaRegistryInput의 rel index 부분 생성
   - kind → index 매핑 레지스트리
   - 인스턴스 스키마 자동 도출
2. 테스트: RBAC 시나리오로 관계 유형 선언 → encode/decode 검증

### Phase 2: Rule Engine

3. `relation-rule.ts` — 2-level rule matching
   - `matchRelationRules()` — type-level + instance-level 합성
   - `resolveRelationPolicy()` — 전략별 해석
4. 테스트: RBAC 규칙 매칭 시나리오

### Phase 3: Prefix 조합

5. `relation-compose.ts` — transitive/compound 관계 정의 + 평가
   - composeQuery 체이닝 기반
6. `relation-prefix.ts` — prefix 조합 문법 + PrefixRegistry 연동
7. 테스트: 경유 관계 평가 (user→role→permission)

### Phase 4: 패키지 분리

8. 파일 이동 + 진입점 재구성
9. 통합 `index-meta` re-export 유지
