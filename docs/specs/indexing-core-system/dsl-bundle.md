---
def:
  id: dsl-bundle-spec
  address: def_document:v2:342172
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime]
  links:
    - target: dim-ops-system
      type: depends_on
    - target: table-system-group
      type: depends_on
---

# DSL Bundle — prefix 묶음의 사용 패턴 정의

## 목적 ^purpose

prefix는 차원 교차의 **원자 단위**다.
DSL Bundle은 여러 prefix를 묶어 **하나의 사용 시나리오**를 구성한다.
"이 prefix들을 이 서비스 컨텍스트에서 이렇게 조합해서 쓴다"의 선언.

## 구성 ^overview

- **DSL 정의**: prefix 묶음 + 서비스 바인딩(fixedDims) + 사용 패턴 + 불변조건의 조합. 개별 prefix는 독립 사용 가능하되 DSL이 조합 의도를 명시
- **4개 등록 번들**: observation(화면/API/흐름 관측), infra(배포/헬스 추적), checkout(결제 종단 흐름), auth(인증/권한 접근 제어)
- **멤버 역할 5종**: observation, permission, event, infra, context — 각 prefix의 DSL 내 역할을 구분
- **svcRefLabel 자동 감지**: defineDslBundle()이 멤버 prefix의 dims에서 prefix_ref → service인 차원을 자동으로 찾아 서비스 바인딩
- **DKG 노드 타입**: dsl-bundle은 DKG 12번째 노드 타입으로 등록. DomainNode(소유 경계)와 달리 사용 패턴을 표현하며, 하나의 prefix가 여러 DSL에 포함 가능
- **커버리지 분석**: analyzeDslCoverage()로 카탈로그 prefix의 DSL 배치 현황(covered/uncovered/unbound) 파악
- **불변조건 선언**: 번들별로 prefix 간 선후 관계나 필수 공출현 조건을 명시 (예: checkout page_view 없이 flow_point success 관측 금지)

기반 문서: [dimension-operations.md](dimension-operations.md) · [table-system.md](table-system.md)

---


## 관련 소스

관련 스펙: `packages/spec-core/src/dkg/dsl-bundle.ts`

## 1. DSL이란

이 시스템에서 DSL(Domain-Specific Language)의 정의:

```
DSL = prefix 묶음 + 서비스 바인딩 + 사용 패턴 + 불변조건
```

| 구성 요소 | 역할 | 예시 |
|---|---|---|
| **prefix 묶음** | 함께 사용되는 prefix 집합 | page_view, endpoint, flow_point |
| **서비스 바인딩** | SDK 부트 시 고정되는 차원 | env=prod, region=asia, svc=payment |
| **사용 패턴** | prefix 간 연결과 흐름 | 화면 진입 → API 호출 → 흐름 분기 |
| **불변조건** | 이 DSL 내에서 유지해야 하는 규칙 | "page_view 없이 flow_point가 관측되면 안 됨" |

**개별 prefix는 독립적으로도 쓸 수 있다.** DSL Bundle은 "이 prefix들을 함께 쓸 때의 의도와 규칙"을 명시하는 것이다.

---

## 2. 현재 등록된 DSL 번들

### 2.1 관측 DSL (`dsl-observation`)

```
page_view  ─┐
endpoint   ─┼── 동일한 svc_ref(→service) 공유
flow_point ─┘
```

**용도:** 화면/API/흐름 관측 포인트를 서비스 단위로 묶어 추적.

**불변조건:**
- 모든 관측 prefix의 svc_ref는 동일한 service 주소를 참조
- page_view 없이 flow_point가 관측되면 진입점 누락

### 2.2 인프라 계측 DSL (`dsl-infra`)

```
deploy_event ─┐
health_event ─┼── svc_ref(→service), dev/stage/prod 전 환경
endpoint     ─┘
```

**용도:** 배포/헬스 이벤트를 서비스 단위로 묶어 인프라 상태 추적.

**불변조건:**
- deploy_event 직후 health_event(degraded) 발생 → 배포 실패 후보
- health_event(unhealthy) 시 해당 서비스의 endpoint 관측 중단 감지

### 2.3 결제 흐름 DSL (`dsl-checkout`)

```
page_view    ─┐
endpoint     ─┤
flow_point   ─┼── 결제 흐름 전체 경로
order_event  ─┤
permission   ─┘
```

**용도:** 결제 흐름의 진입 → 호출 → 분기 → 주문 → 권한을 종단 추적.

**불변조건:**
- checkout page_view 없이 checkout flow_point(success) 관측 금지
- order_event(create) 없이 order_event(complete) 관측 금지

### 2.4 인증/권한 DSL (`dsl-auth`)

```
auth_event  ─┐
permission  ─┼── 인증 흐름 + 권한 관리
endpoint    ─┘
```

**용도:** 인증 이벤트와 권한 변경을 묶어 접근 제어 추적.

---

## 3. DSL의 구조

### 3.1 타입 정의

```typescript
interface DslBundle {
  id: string;
  name: string;
  description: string;

  serviceBinding: {
    prefixId: string;          // "service"
    fixedDims: string[];       // ["env", "region", "svc_name", "namespace"]
  };

  members: DslMember[];        // 포함되는 prefix와 역할
  flows?: string[];            // FlowDefinition IDs
  invariants?: string[];       // 불변조건
}

interface DslMember {
  prefixId: string;
  role: "observation" | "permission" | "event" | "infra" | "context";
  svcRefLabel?: string;        // 자동 감지 — prefix_ref → service인 label
}
```

### 3.2 서비스 바인딩과 svcRefLabel 자동 감지

`defineDslBundle()`은 각 멤버 prefix의 dims를 검사하여 **svcRefLabel을 자동 감지**한다:

```typescript
// page_view prefix의 dims에서 prefix_ref → "service"인 차원을 찾는다
page_view.dims.svc_ref = { kind: "prefix_ref", prefixId: "service" }
// → svcRefLabel = "svc_ref" (자동 감지)

// auth_event prefix는 prefix_ref → service가 없다
auth_event.dims.actor = { kind: "table_ref", table: "members" }
auth_event.dims.action = { kind: "axis", axisId: "auth_action" }
// → svcRefLabel = undefined (서비스 바인딩 없음)
```

### 3.3 멤버 역할 (DslMemberRole)

| 역할 | 의미 | 예시 |
|---|---|---|
| `observation` | 관측 포인트 | page_view, endpoint, flow_point |
| `permission` | 권한 관리 | permission, rbac |
| `event` | 비즈니스 이벤트 | cart_event, order_event |
| `infra` | 인프라 이벤트 | deploy_event, health_event |
| `context` | 컨텍스트 제공 | service |

---

## 4. DKG에서의 위치

DSL Bundle은 DKG의 12번째 노드 타입(`dsl-bundle`)으로 등록된다.

```
DslBundleNode
  │
  ├── contains → page_view     (멤버 prefix)
  ├── contains → endpoint      (멤버 prefix)
  ├── contains → flow_point    (멤버 prefix)
  │
  └── binds → service          (서비스 바인딩)
```

**DomainNode와의 차이:**

| | DomainNode | DslBundleNode |
|---|---|---|
| 관심사 | prefix의 **소유 경계** (어디에 속하는가) | prefix의 **사용 패턴** (어떻게 조합하는가) |
| 중복 | 하나의 prefix는 하나의 domain에만 속함 | 하나의 prefix가 여러 DSL에 포함 가능 |
| 서비스 바인딩 | 없음 | 있음 (fixedDims) |
| 불변조건 | 없음 | 있음 (invariants) |

**IntentLinkNode와의 차이:**

| | IntentLinkNode | DslBundleNode |
|---|---|---|
| 관심사 | prefix 간 **인과 관계** | prefix의 **사용 묶음** |
| 구조 | endpoints + via + intent | members + serviceBinding + invariants |
| 용도 | "이 prefix들은 이 개념으로 연결된다" | "이 prefix들을 이 컨텍스트에서 함께 쓴다" |

---

## 5. 커버리지 분석

`analyzeDslCoverage()`로 카탈로그의 prefix가 DSL에 어떻게 배치되었는지 분석한다.

```typescript
import { analyzeDslCoverage, DslBundleRegistry } from "spec-core";

const registry = new DslBundleRegistry();
// ... 번들 등록 ...

const report = analyzeDslCoverage(DEMO_CATALOG, registry);
// report.covered:    DSL에 포함된 prefix
// report.uncovered:  DSL에 포함되지 않은 prefix (service, rbac, content, ...)
// report.unboundMembers: svcRefLabel 없는 멤버 (서비스 연결 없음)
// report.roleCounts: { observation: 3, infra: 2, event: 2, ... }
```

**uncovered prefix는 독립 사용되거나 새 DSL에 배치되어야 할 후보다.**

---

## 6. 버전 스큐 분석 (analyzeDslVersionSkew)

DSL 번들 내 멤버 prefix 간 버전 스큐를 감지한다.

### 감지 항목

1. **축 버전 충돌**: 같은 축을 다른 버전으로 참조하는 멤버 쌍 (예: permission은 role:v4, rbac은 role:v1)
2. **prefix 버전 수 차이**: 멤버 간 prefix 버전 수 격차 (예: permission은 4개 버전, endpoint는 1개)
3. **심각도 자동 판정**: `spread ≥ 3` → major, 충돌 존재 또는 `maxVersionSpread ≥ 3` → minor

### 반환 타입 (DslVersionSkewReport)

```typescript
interface DslVersionSkewReport {
  bundleId: string;
  members: MemberVersionInfo[];        // 멤버별 버전 정보
  axisConflicts: AxisVersionConflict[]; // 같은 축의 다른 버전 참조
  maxVersionSpread: number;            // prefix 버전 수 차이 (max - min)
  severity: "ok" | "minor" | "major";
  summary: string;                     // 사람이 읽을 수 있는 요약
}
```

### 사용

```typescript
import { analyzeDslVersionSkew, analyzeAllVersionSkew } from "spec-core";

// 단일 번들
const report = analyzeDslVersionSkew(DEMO_CATALOG, bundle);

// 전체 번들 일괄
const reports = analyzeAllVersionSkew(DEMO_CATALOG, registry);
```

---

## 7. 실행 컨텍스트 (ExecutionContext)

DslBundle은 선택적으로 `executionContext`를 가질 수 있다. 데이터 출처와 목적을 식별하는 3가지 독립 관심사를 분리한다:

| 관심사 | 위치 | 의미 |
|--------|------|------|
| env (axis) | 좌표에 인코딩 | 서비스가 어디서 돌아가는가 (인프라) |
| build | envelope에 포함 | 코드가 어떻게 빌드됐는가 (CI/CD) |
| execution | ExecutionContext | 이 데이터가 왜 존재하는가 (필터/격리 기준) |

```typescript
type ExecutionMode = "live" | "test" | "synthetic" | "replay";

interface ExecutionContext {
  mode: ExecutionMode;
  executionId?: string;   // 테스트 suite ID, 시나리오 ID 등
  tags?: string[];        // 필터/그룹핑용 자유 태그
}
```

---

## 8. DslBundleRegistry API

| 메서드 | 설명 |
|--------|------|
| `register(bundle)` | 번들 등록 (중복 ID 시 에러) |
| `get(id)` | ID로 조회. 없으면 `undefined` |
| `getOrThrow(id)` | ID로 조회. 없으면 에러 |
| `list()` | 전체 번들 목록 |
| `findByPrefix(prefixId)` | 특정 prefix가 포함된 모든 DSL |
| `findByRole(role)` | 특정 역할의 멤버를 가진 모든 DSL |
| `listServiceBoundPrefixes()` | svcRefLabel이 있는 모든 멤버 목록 (prefixId, svcRefLabel, bundleId) |

---

## 9. 소스 위치

| 파일 | 역할 |
|---|---|
| `packages/spec-core/src/dkg/dsl-bundle.ts` | DslBundle 타입, defineDslBundle, DslBundleRegistry, analyzeDslCoverage |
| `packages/spec-core/src/dkg/dkg.types.ts` | DslBundleNode (DKG 노드 타입) |
| `packages/spec-core/src/dkg/bootstrap.ts` | 4개 DSL 번들 등록 (observation, infra, checkout, auth) |
| `packages/spec-core/src/dkg/flow-definition.ts` | FlowDefinition (DSL과 조합 가능한 흐름 정의) |

## 10. DSL Bundle과 Taxonomy의 관계

DSL Bundle과 Taxonomy는 **동일 단위를 다른 관점에서 부른 이름**이다.

| 관점 | 이름 | 강조점 |
|------|------|--------|
| 구현/사용 | DSL Bundle | 공통 서비스 바인딩 + 사용 패턴 + 불변조건 |
| 개념/도메인 | Taxonomy | 이름 붙일 수 있는 도메인 경계 |

### Taxonomy 확정 기준

DSL Bundle이 다음 조건을 모두 만족하면 Taxonomy(개념 단위)로 확정한다.

- [ ] 공통 서비스 컨텍스트에서 함께 사용되는가?
- [ ] 불변조건을 공유하는가?
- [ ] 도메인 이름을 붙일 수 있는가?
- [ ] 경계 밖의 단위와 명확히 구분되는가?

### System 경계

Taxonomy 수준부터 System이 된다. DSL Bundle 하나가 독립 운용 + 복합 데이터 관리를 갖추면 단독 System이고, 그렇지 않으면 상위 System의 Taxonomy로 포함된다.

계층 원칙 전체: [composition-hierarchy.spec.md](../system/composition-hierarchy.spec.md)

## 참조

- [dimension-operations.md](dimension-operations.md) — 축 교차 선택, 환경 주입, 배포 시점 해석, 인프라 계측
- [table-system.md](table-system.md) — 좌표↔관계형 양방향 연결, 이벤트 인코딩 분리
- `docs/specs/spec-engine/prefix-guide.md` — prefix 실용 가이드, 환경 오버라이드 패턴
- `docs/specs/decision-flow/decision-standard-group.md` — 의사결정 표준 프로세스
