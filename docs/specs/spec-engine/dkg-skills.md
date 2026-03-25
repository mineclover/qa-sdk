---
def:
  id: dkg-skills-spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
---

# DKG Skills — 종단 파이프라인과 자동화 가능 연산

## 목적 ^purpose

DKG 성장 나선의 반복 연산을 skill로 패키징한다. weighted-index(수학)와 DKG(그래프)를 종단으로 연결하여 "축 변경 → 서비스 영향 알림"까지를 하나의 호출로 실행할 수 있게 한다.

기반: [design-knowledge-graph.md](design-knowledge-graph.md) · [../indexing/weighted-index/traceability.spec.md](../indexing/weighted-index/traceability.spec.md) · [core-types.md](core-types.md)

---

## 빈 곳 4개와 해소 방향

| # | 빈 곳 | 문제 | 해소 |
|---|---|---|---|
| 1 | 종단 cascade 파이프라인 | diff()와 DKG 순회가 분리됨 | `analyzeImpact()` |
| 2 | migrator 자동 추론 | CoordMigrator를 매번 수동 작성 | `inferMigrator()` |
| 3 | diff → VersionEvent 파생 | diff 결과를 수동으로 YAML 작성 | `VersionEvent.fromDiff()` |
| 4 | Decision 구조화 템플릿 | 자유 형식이라 패턴 재사용 불가 | `Decision.scaffold()` |

---

## 1. 종단 cascade 파이프라인 — `analyzeImpact()`

### 문제

weighted-index의 `diff()`는 단일 prefix 내부 변경만 알려준다. DKG의 `composes/references/contains/consumes`는 그래프 순회만 한다. 이 둘을 연결하는 종단 파이프라인이 없다.

### API

```typescript
interface ImpactAnalysisInput {
  /** 변경 유형 */
  type:
    | "entry-added"
    | "entry-deactivated"
    | "capacity-changed"
    | "dim-added"
    | "ref-changed"
    | "version-bump";

  /** 변경 대상 */
  target: {
    axis?: string;         // 축 변경 시
    prefix?: string;       // prefix 직접 변경 시
    fromVersion?: string;  // 이전 버전
    toVersion?: string;    // 새 버전
  };

  /** 변경 상세 (entry-added의 경우 entry 이름 등) */
  detail?: string;
}

interface ImpactAnalysisResult {
  /** stride-break 여부 */
  strideBreak: boolean;

  /** shape 변경 내용 (있으면) */
  shapeChange?: {
    from: number[];
    to: number[];
  };

  /** 직접 영향받는 prefix 목록 */
  affectedPrefixes: Array<{
    id: string;
    reason: "composes" | "references";
    diff?: PrefixVersionDiff;
  }>;

  /** 영향받는 도메인 */
  affectedDomains: Array<{
    id: string;
    affectedPrefixes: string[];
  }>;

  /** 영향받는 소비자 */
  affectedConsumers: Array<{
    id: string;
    via: string;  // 어떤 domain/prefix를 통해
  }>;

  /** 마이그레이션 필요 여부 */
  migrationRequired: boolean;

  /** 자동 migrator 추론 가능 여부 */
  autoMigratable: boolean;

  /** constraint 위반 목록 */
  constraintViolations: Array<{
    constraintId: string;
    rule: string;
  }>;

  /** 깨지는 IntentLink */
  brokenIntentLinks: Array<{
    id: string;
    invariant: string;
  }>;
}
```

### 실행 경로

```
analyzeImpact(input)
  │
  ├─ 1. weighted-index 단계
  │     codec.diff(prefix, from, to) → changedLabels
  │     shape 비교 → strideBreak 판정
  │
  ├─ 2. DKG composes 단계
  │     Axis(target) ←composes── Prefix(*) → affectedPrefixes
  │
  ├─ 3. DKG references 단계 (transitive)
  │     for each affectedPrefix:
  │       Prefix(P) ←references── Prefix(*) → 추가 영향
  │     반복 (참조 체인 끝까지)
  │
  ├─ 4. DKG contains 단계
  │     for each affectedPrefix:
  │       Prefix(P) ←contains── Domain(*) → affectedDomains
  │
  ├─ 5. DKG consumes 단계
  │     for each affectedDomain:
  │       Domain(D) ←consumes── Consumer(*) → affectedConsumers
  │     for each affectedPrefix (도메인 밖 직접 소비):
  │       Prefix(P) ←consumes── Consumer(*) → 추가 consumers
  │
  ├─ 6. Constraint 검사
  │     for each affectedAxis/Prefix:
  │       ←constrains── Constraint(*) → 위반 확인
  │
  ├─ 7. IntentLink 검사
  │     for each affectedPrefix/Consumer:
  │       ←binds── IntentLink(*) → invariant 확인
  │
  └─ 8. Migration 판정
        strideBreak → migrationRequired = true
        inferMigrator 호출 → autoMigratable 판정
```

### references transitive 순회 규칙

```
깊이 제한: 10 (무한 순환 방지. 실제 DEMO_CATALOG에서 최대 깊이 2)
방문 기록: Set<string>으로 중복 방지
순회 결과: 각 hop에 distance 표기

예시:
  Axis(env) ←composes── Prefix(service)           distance=1
            ←references── Prefix(permission)       distance=2
            ←references── Prefix(event)            distance=2
            ←references── Prefix(order_event)      distance=2
```

---

## 2. migrator 자동 추론 — `inferMigrator()`

### 문제

`PrefixCodec.migrate(vi, toVersion, migrator)`의 migrator 함수를 매번 수동 작성해야 한다. 대부분의 마이그레이션은 소수의 패턴으로 분류된다.

### 패턴 분류

| 패턴 | 조건 (diff에서 판별) | 생성되는 migrator |
|---|---|---|
| **identity** | changedLabels의 모든 label이 max만 증가 (entries 추가) | `coords => coords` |
| **append-dim** | 새 label이 추가됨 (labels 배열 길이 증가) | `coords => [...coords, defaultValue]` |
| **remove-dim** | label이 제거됨 (labels 배열 길이 감소) | `coords => coords.filter(제거 dim 제외)` |
| **reorder** | labels 집합 동일, 순서만 변경 | `coords => reorder(coords, mapping)` |
| **composite** | 위 패턴의 조합 | 패턴 합성 |
| **unknown** | 위 패턴 어디에도 해당 안 됨 | `null` (수동 작성 필요) |

### API

```typescript
interface InferredMigrator {
  /** 추론된 패턴 */
  pattern: "identity" | "append-dim" | "remove-dim" | "reorder" | "composite" | "unknown";

  /** 자동 생성된 migrator (unknown이면 null) */
  migrator: CoordMigrator | null;

  /** 패턴 설명 (사람이 검토할 수 있도록) */
  description: string;

  /** 주의사항 (있으면) */
  warnings?: string[];
}

function inferMigrator(
  codec: PrefixCodec,
  prefix: string,
  fromVersion: string,
  toVersion: string,
  options?: {
    /** append-dim 시 새 차원의 기본값 (default: 1) */
    defaultValue?: number;
  }
): InferredMigrator;
```

### 추론 로직

```
inferMigrator(codec, "permission", "pv3", "pv4"):

  1. fromLabels = codec.getLabels("permission", "pv3")  // ["role", "action"]
     toLabels   = codec.getLabels("permission", "pv4")  // ["role", "action"]

  2. labels 집합 비교:
     같은 집합 + 같은 순서 → diff만 확인
     같은 집합 + 다른 순서 → reorder 패턴
     toLabels ⊃ fromLabels  → append-dim 패턴
     toLabels ⊂ fromLabels  → remove-dim 패턴

  3. diff = codec.diff("permission", "pv3", "pv4")
     changedLabels.every(c => c.toMax >= c.fromMax && entries 보존)
       → identity 패턴

  결과:
     pattern: "identity"
     migrator: (coords) => coords
     description: "max만 증가. 좌표 동일 유지."
```

### 안전 장치

```
· 추론된 migrator는 실행 전 검증 가능:
  verifyMigrator(codec, prefix, fromVersion, toVersion, migrator)
  → 모든 유효 좌표에 대해 roundtrip 확인 (from encode → migrate → to decode)
  → 규모가 큰 경우 샘플링 검증

· unknown 패턴이면 migrator=null 반환. 절대 추측하지 않음.

· warnings 예시:
  - "remove-dim: position 2 제거됨. 기존 데이터에서 이 차원의 정보 소실"
  - "append-dim: 기본값 1이 의미적으로 적절한지 확인 필요"
```

---

## 3. diff → VersionEvent 자동 파생 — `VersionEvent.fromDiff()`

### 문제

PrefixCodec.diff() 결과를 수동으로 YAML에 옮겨 적어야 한다. diff의 정보만으로 VersionEvent의 대부분을 자동 생성할 수 있다.

### API

```typescript
function versionEventFromDiff(
  diff: PrefixVersionDiff,
  meta: {
    date: string;
    /** 추가 컨텍스트 (선택) */
    note?: string;
  }
): VersionEventNode;
```

### 변환 규칙

```
PrefixVersionDiff → VersionEventNode 매핑:

  id:          "VE-{prefix}-{from}-{to}"
  subjectId:   diff.prefix
  subjectKind: "prefix"
  fromVersion: diff.from
  toVersion:   diff.to
  date:        meta.date

  changes:     diff.changedLabels.map(cl => {
    if (cl.toMax > cl.fromMax && entries 보존)
      → { kind: "entry-added" | "capacity-changed", detail: "{label} max {from}→{to}" }
    if (cl.toMax < cl.fromMax)
      → { kind: "entry-deactivated", detail: "{label} max {from}→{to}" }
  })

  impact:      자동 판정:
    · changedLabels.length === 0 → "no-impact"
    · 모든 changedLabels가 max만 증가하고 shape 불변 → "state-only. bitmask 크기 변경 가능"
    · shape 변경 → "stride-break. 전체 re-encode 필요"
```

### 축 변경에서의 파생

축(axis) 변경은 PrefixCodec.diff가 직접 지원하지 않는다. 축 변경 → 영향받는 prefix 각각에 대해 diff를 호출하는 패턴:

```typescript
function versionEventsFromAxisChange(
  codec: PrefixCodec,
  graph: GraphRegistry,
  axisId: string,
  fromVersion: string,
  toVersion: string,
  meta: { date: string }
): VersionEventNode[] {
  // 1. DKG에서 이 축을 사용하는 prefix 목록
  const prefixes = graph.query("composes", { to: axisId });

  // 2. 각 prefix에 대해 version pair 찾기 (해당 axis version을 핀하는 prefix version)
  // 3. diff → VersionEvent 생성
  return prefixes.map(p => {
    const diff = codec.diff(p.id, oldPrefixVersion, newPrefixVersion);
    return versionEventFromDiff(diff, meta);
  });
}
```

---

## 4. Decision 구조화 템플릿 — `Decision.scaffold()`

### 문제

Decision 노드를 자유 형식으로 작성하면 패턴이 재사용되지 않는다. 반복되는 결정 유형별로 구조화된 템플릿을 제공하면, alternatives와 reversalConditions를 자동 생성할 수 있다.

### 결정 유형 분류

| 유형 | 입력 | 자동 생성 가능한 필드 |
|---|---|---|
| `capacity` | axis, currentUsed, proposed | alternatives (2의 거듭제곱, +1, ×2), reversalConditions (소진 시) |
| `new-axis` | axisId, entries, rationale | alternatives (기존 축 재사용, 하드코딩, table_ref), reversalConditions (미사용 시) |
| `new-prefix` | prefixId, dims, rationale | alternatives (기존 prefix 확장, 별도 시스템), reversalConditions (불필요 시) |
| `dim-add` | prefix, newDim, rationale | alternatives (별도 prefix, metadata로 관리), reversalConditions (차원 비활성화 필요 시) |
| `merge` | targets[], into, rationale | alternatives (유지, alias), reversalConditions (분리 필요 시) |
| `deprecate` | target, reason | alternatives (유지+비활성화, 삭제), reversalConditions (재활성화 필요 시) |

### API

```typescript
interface DecisionScaffoldInput {
  type: "capacity" | "new-axis" | "new-prefix" | "dim-add" | "merge" | "deprecate";
  date: string;
  title: string;

  /** 유형별 파라미터 */
  params: CapacityParams | NewAxisParams | NewPrefixParams
        | DimAddParams | MergeParams | DeprecateParams;

  /** 인간이 작성하는 핵심 근거 (필수) */
  rationale: string;

  /** 추가 대안 (자동 생성에 더해서) */
  additionalAlternatives?: string[];

  /** 추가 역전 조건 (자동 생성에 더해서) */
  additionalReversalConditions?: string[];
}

interface CapacityParams {
  axis: string;
  currentUsed: number;
  currentCapacity: number;
  proposedCapacity: number;
}

interface NewAxisParams {
  axisId: string;
  entries: string[];
  capacity: number;
}

interface NewPrefixParams {
  prefixId: string;
  dims: string[];
  domain?: string;
}

interface DimAddParams {
  prefix: string;
  newDim: string;
  defaultValue?: number;
}

interface MergeParams {
  targets: string[];
  into: string;
  overlapEntries?: string[];
}

interface DeprecateParams {
  target: string;
  replacement?: string;
}

function scaffoldDecision(input: DecisionScaffoldInput): DecisionNode;
```

### 자동 생성 규칙

#### capacity 유형

```typescript
scaffoldDecision({
  type: "capacity",
  date: "2026-03-20",
  title: "role capacity를 16으로 확장",
  params: { axis: "role", currentUsed: 8, currentCapacity: 8, proposedCapacity: 16 },
  rationale: "9번째 역할이 필요. bitmask 정렬 유지",
})

자동 생성:
  context: "role axis: 현재 8/8 사용 중 (100%). headroom 0."
  alternatives:
    - "9 — 최소 확장. headroom 1. 비 2의 거듭제곱"      ← currentUsed + 1
    - "16 — 2의 거듭제곱. headroom 8. bitmask 정렬 최적"  ← proposed
    - "32 — 과도한 headroom. 사용률 28%"                  ← proposed × 2
  reversalConditions:
    - "16개 역할이 모두 사용되고 17번째가 필요할 때"       ← proposed 소진
    - "bitmask 정렬보다 주소 밀도가 더 중요해질 때"       ← 항상 포함
```

#### new-axis 유형

```typescript
scaffoldDecision({
  type: "new-axis",
  date: "2026-03-20",
  title: "severity 축 추가",
  params: { axisId: "severity", entries: ["low","medium","high","critical"], capacity: 8 },
  rationale: "이벤트 심각도를 좌표로 추적해야 한다",
})

자동 생성:
  context: "새 축 'severity': 4개 entries, capacity 8 (headroom 4)"
  alternatives:
    - "기존 축 재사용 — 의미적으로 대응하는 기존 축이 있는지 확인 필요"
    - "축 대신 table_ref — 경우의 수가 무한하면 좌표에 넣지 않음"
    - "축 대신 metadata — 좌표 인코딩 없이 부가 정보로 관리"
  reversalConditions:
    - "이 축이 6개월 이상 어떤 prefix에서도 사용되지 않을 때"
    - "기존 축으로 의미를 충분히 표현할 수 있을 때"
```

#### merge 유형

```typescript
scaffoldDecision({
  type: "merge",
  date: "2026-03-20",
  title: "rbac_role과 role 병합 검토",
  params: { targets: ["rbac_role", "role"], into: "role", overlapEntries: ["admin"] },
  rationale: "운영 중 혼동 발생. entries 중 'admin'이 중복",
})

자동 생성:
  context: "rbac_role(3 entries)과 role(7 entries) 병합. 중복: ['admin'] (1개)"
  alternatives:
    - "병합 — entries 합집합, 기존 position 재배치 필요"
    - "유지 + alias — 이름 규칙 정비로 혼동 해소"
    - "유지 + Constraint — CON-xxx로 동시 사용 금지 강제"
  reversalConditions:
    - "병합 후 두 도메인의 의미가 다시 분기할 때"
    - "병합으로 인해 prefix의 주소 공간이 과도하게 커질 때"
```

---

## 5. Skill 카탈로그

위 4개 빈 곳을 메운 후, 패키징 가능한 skill 목록.

### 완전 자동 skill

| skill | 입력 | 출력 | 의존 |
|---|---|---|---|
| **impact-analysis** | ImpactAnalysisInput | ImpactAnalysisResult | analyzeImpact() |
| **constraint-check** | 변경 대상 (axis/prefix ID) | 위반 Constraint 목록 | DKG constrains 역순회 |
| **cascade-notify** | VersionEvent | 영향받는 Consumer 목록 + 조치 필요 여부 | analyzeImpact() subset |
| **domain-health** | Domain ID | prefix 간 version 정합성 + constraint 위반 | DKG contains + constraint-check |

### 반자동 skill (인간 확인 필요)

| skill | 입력 | 자동 부분 | 인간 확인 부분 |
|---|---|---|---|
| **version-bump** | axis + 변경 내용 | diff + VersionEvent 생성 + impact 분석 | 새 capacity 선택 (제안은 자동) |
| **safe-entry-add** | axis + entry | headroom 확인, capacity 부족 시 확장 제안 | 확장 여부 결정 |
| **auto-migrate** | old version + new version | migrator 추론 + 검증 | unknown 패턴 시 수동 작성 |
| **decision-scaffold** | 결정 유형 + 파라미터 | 템플릿 채움 + alternatives/reversalConditions | rationale 작성 |

### Skill 실행 흐름 예시

#### "role에 auditor 추가"

```
1. safe-entry-add("role", "auditor")
   → headroom 확인: capacity=8, used=7, headroom=1 → 추가 가능
   → LabelRegistry에 role v5 = [..., "auditor"]
   → 출력: { safe: true, newVersion: "v5", headroomAfter: 0 }

2. version-bump("role", "v4", "v5")
   → diff: changedLabels=[] (max 동일)
   → VersionEvent.fromDiff(): impact="no-impact"
   → 출력: VE-role-v4-v5

3. impact-analysis({ type: "entry-added", target: { axis: "role" } })
   → strideBreak: false
   → affectedPrefixes: [permission, rbac]
   → affectedDomains: [shopping-domain]
   → affectedConsumers: [auth-service, payment-service]
   → migrationRequired: false
   → constraintViolations: []
   → 출력: "서비스 마이그레이션 불필요"

4. cascade-notify(VE-role-v4-v5)
   → auth-service: "role v5 등록 완료. 마이그레이션 불필요"
   → payment-service: 동일

5. decision-scaffold({ type: "capacity", ... })
   → (headroom=0이므로) "다음 추가 시 capacity 확장 필요. 미리 결정 권장"
   → 제안: capacity 16 (2의 거듭제곱)
```

#### "role capacity 8→16 확장"

```
1. decision-scaffold({ type: "capacity", axis: "role", proposed: 16 })
   → alternatives: [9, 16, 32]
   → reversalConditions: ["16 소진 시"]
   → 인간: rationale 작성 + 16 선택
   → 출력: DEC-xxx

2. version-bump("role", capacity 8→16)
   → diff: changedLabels=[{ role: max 8→16 }]
   → VersionEvent.fromDiff(): impact="size 변경. bitmask 재생성 필요"

3. auto-migrate("permission", "pv3", "pv4")
   → inferMigrator: pattern="identity" (max만 증가)
   → migrator: coords => coords
   → verifyMigrator: 통과
   → 출력: 자동 마이그레이션 가능

4. impact-analysis({ type: "capacity-changed", target: { axis: "role" } })
   → strideBreak: false (stride 동일, size만 증가)
   → migrationRequired: true (bitmask 크기 변경)
   → autoMigratable: true
   → affectedConsumers: [auth-service, payment-service]

5. cascade-notify(VE-role-v4-v5)
   → auth-service: "permission pv4 등록 완료. bitmask 재생성 필요"
   → payment-service: 동일
```

---

## spec-core 내 위치

```
packages/spec-core/
  src/
    dkg/
      skills/
        analyze-impact.ts        ← 종단 cascade 파이프라인
        infer-migrator.ts        ← migrator 자동 추론
        version-event-derive.ts  ← diff → VersionEvent 파생
        decision-scaffold.ts     ← Decision 템플릿
        safe-entry-add.ts        ← entry 추가 + headroom 확인
        cascade-notify.ts        ← 소비자 알림 생성
        domain-health.ts         ← 도메인 정합성 검사
      skills.ts                  ← skill 카탈로그 re-export
```

## CLI 연동

```
qa dkg impact role --change entry-added --entry auditor
  → impact-analysis 실행 → 전체 cascade 출력

qa dkg bump role --from v4 --to v5
  → version-bump 실행 → diff + VersionEvent + impact

qa dkg migrate permission --from pv3 --to pv4
  → auto-migrate 실행 → inferMigrator + verify + 실행

qa dkg decide capacity --axis role --proposed 16
  → decision-scaffold 실행 → 템플릿 출력 → 인간이 rationale 채움

qa dkg health shopping-domain
  → domain-health 실행 → version 정합성 + constraint 위반 출력

qa dkg add-entry role auditor
  → safe-entry-add 실행 → headroom 확인 → bump → impact → notify 체인
```

---

## 불변식

1. **analyzeImpact()는 순수 읽기다.** 상태를 변경하지 않는다. 영향 분석만 수행한다.
2. **inferMigrator()는 unknown 시 null을 반환한다.** 추측하지 않는다. 인간 작성을 요구한다.
3. **VersionEvent.fromDiff()는 diff 결과만으로 생성한다.** 외부 상태에 의존하지 않는다.
4. **scaffoldDecision()은 rationale을 자동 생성하지 않는다.** "왜"는 인간의 책임이다. 구조(alternatives, reversalConditions)만 자동 생성한다.
5. **cascade-notify는 알림을 생성할 뿐 전송하지 않는다.** 전송은 qa-sdk 트래커의 책임이다.
6. **모든 skill의 입출력은 직렬화 가능해야 한다.** CLI, API, YAML 파일 어느 경로로든 사용 가능.
7. **skill chain은 각 단계가 독립적으로 실행 가능해야 한다.** 체인 중간에서 멈추고 인간이 개입한 뒤 이어갈 수 있어야 한다.
