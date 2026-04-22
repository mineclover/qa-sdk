---
def:
  tier: component
  id: authorization-ontology-resource-lifecycle
  type: spec
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: draft
  layer: domain
  svc: authorization-ontology
  tags: [security, structural, lifecycle, permission]
  links:
    - target: state-event-terminology
      type: depends_on
    - target: authorization-ontology-system
      type: traces_to
    - target: authorization-ontology-application-enforcement
      type: refines
    - target: authorization-ontology-cerbos-mapping
      type: refs
    - target: authorization-ontology-audit-layer
      type: traces_to
    - target: authorization-graph-store
      type: refs
    - target: authorization-ontology-decision-observation
      type: refs
    - target: coordinate-storage
      type: refs
    - target: wi-disjoint-union-addressing
      type: depends_on
    - target: authorization-ontology-bitmap-pipeline
      type: refs
    - target: authorization-ontology-nested-audit-tracing
      type: refs
---

# Authorization Ontology Resource Lifecycle — 리소스 인스턴스 권한 상태 모델

## 목적 ^purpose

permission-engine의 bitmap 기반 정적 권한(타입 레벨)과 Cerbos의 정책 기반 동적 권한(인스턴스 레벨) 사이의 **전이 규약**을 정의한다. 모든 리소스 인스턴스는 생성 시점부터 폐기까지 명확한 권한 상태를 가지며, default deny가 **규율이 아니라 데이터 구조**에서 나오도록 한다.

현재 qa-sdk는 정적 권한(permission-engine)과 정책 엔진(Cerbos)을 갖추고 있지만, 둘을 이어주는 **리소스 인스턴스 lifecycle**이 명시되어 있지 않다. 본 스펙은 그 공백을 채운다.

## 구성 ^overview

리소스 권한 lifecycle은 **3상태 FSM**으로 표현된다. 모든 리소스 인스턴스는 생성 시 `UNREGISTERED`로 시작하며, 공유·위임에 따라 `REGISTERED` 또는 `DELEGATED`로 전이한다. 역전이는 금지된다.

여기서 FSM은 current state와 허용 전이의 authority다. Event는 이 전이가 발생했다는 감사/evidence를 남기는 관측 평면이며, FSM을 대체하지 않는다. 용어 기준은 `state-event-terminology`를 따른다.

권한 체크는 **2-pass 구조**:

1. Pass 1 — **타입 레벨** (bitmap 기반 O(1)) — 정적 CRUD × resource_type 판정
2. Pass 2 — **인스턴스 레벨** (lifecycle 상태 기반) — 인스턴스별 접근 판정

Pass 1이 거절하면 즉시 종료. Pass 2는 Pass 1이 허용할 때만 실행된다.

## 정의 ^defines

### 1. 상태 모델 (FSM)

```
UNREGISTERED (default)  →  REGISTERED  →  DELEGATED
      ↓                        ↓              ↓
  소유자만 접근           Cerbos 정책 판정   ACL 그래프 탐색
  (row.owner_id 체크)    (policy-based)    (ReBAC 스타일)
```

- **UNREGISTERED**: 리소스 생성 직후 기본 상태. 접근 가능 주체는 `row.owner_id`와 일치하는 actor뿐. policy server 조회 없음.
- **REGISTERED**: 공유 정책이 등록된 상태. Cerbos policy로 판정. `cerbos_policy_ref`가 유효해야 한다.
- **DELEGATED**: ACL 그래프 기반 위임이 활성화된 상태. `graph_root_id`가 authorization-graph-store의 루트 노드를 가리킨다.

### 2. 전이 규약

| 전이 | 조건 | 부수 효과 |
|---|---|---|
| `UNREGISTERED → REGISTERED` | share/publish API 호출 | Cerbos에 policy 배포, `cerbos_policy_ref` 저장, 감사 로그 |
| `REGISTERED → DELEGATED` | ACL 그래프 필요 시 (예: 조직 하위 위임) | `authorization-graph-store`에 root node 생성 |
| `DELEGATED → REGISTERED` | **금지** |  |
| `REGISTERED → UNREGISTERED` | **금지** |  |

역전이 금지의 근거: 한 번 외부에 노출된 리소스의 "덜 공유" 상태는 의미가 모호하다. 접근 범위 축소는 **현 상태의 policy 변경**으로 표현하며, 상태 전이로 표현하지 않는다.

### 3. 스키마

```sql
CREATE TABLE resource_policies (
  resource_id        TEXT PRIMARY KEY,
  resource_type      TEXT NOT NULL,
  state              TEXT NOT NULL
                     CHECK (state IN ('UNREGISTERED','REGISTERED','DELEGATED')),
  owner_id           TEXT NOT NULL,
  cerbos_policy_ref  TEXT,                      -- REGISTERED|DELEGATED일 때만
  graph_root_id      TEXT,                      -- DELEGATED일 때만
  registered_at      TEXT,                      -- UNREGISTERED → REGISTERED 시각
  delegated_at       TEXT,                      -- REGISTERED → DELEGATED 시각
  updated_at         TEXT NOT NULL
);

CREATE INDEX idx_rp_owner ON resource_policies(owner_id);
CREATE INDEX idx_rp_state ON resource_policies(state);
CREATE INDEX idx_rp_type ON resource_policies(resource_type);
```

인덱스 용도:
- `idx_rp_owner`: "내 리소스 목록" 조회
- `idx_rp_state`: 상태별 배치 감사 (예: 고립된 UNREGISTERED 감지)
- `idx_rp_type`: 타입별 정책 일괄 조회

### 4. 체크 알고리즘

**전제**: 모든 API 호출(CRUD 엔드포인트든 트랜잭션 엔드포인트든)이 동일한 2-pass 체크를 받는다. 트랜잭션은 "여러 API를 묶는 상위 개념"이지만 호출 경로 관점에서는 **그 자체가 하나의 API**다. 따라서 별도 권한 레이어가 아니라 Pass 1 bitmap의 다른 `kind` variant로 표현된다 (`wi-disjoint-union-addressing` 참조).

```ts
interface AuthContext {
  userId: string;
  bitmap: VersionedBitmap;       // DisjointUnionIndex 기반 mask
  policyEngine: CerbosClient;    // Cerbos 판정
  graphAcl: GraphAclClient;      // ACL 그래프 탐색
  policyRegistry: ResourcePolicyRegistry; // resource_policies 조회
}

interface ApiCall {
  kind: "resource" | "transaction";  // DisjointUnionIndex variant
  action: string;                    // "read" | "write" | "execute" | ...
  targetId: string;                  // resource_type 또는 transition_id
  resource?: Resource;               // kind="resource"일 때만
}

async function check(ctx: AuthContext, call: ApiCall): Promise<boolean> {
  // Pass 1: API 호출 권한 (union-aware bitmap, O(1))
  const addr = UNION_INDEX.encode(call.kind, [ctx.role, call.action, call.targetId]);
  if (!hasBit(ctx.bitmap.mask, addr)) return false;

  // Pass 2: resource kind일 때만 인스턴스 lifecycle
  if (call.kind !== "resource" || !call.resource) return true;

  const policy = await ctx.policyRegistry.resolve(call.resource.id);
  switch (policy.state) {
    case "UNREGISTERED":
      return call.resource.ownerId === ctx.userId;

    case "REGISTERED":
      return ctx.policyEngine.check({
        principal: { id: ctx.userId },
        resource: { kind: call.resource.type, id: call.resource.id, attrs: call.resource.attrs },
        action: call.action,
        policyRef: policy.cerbos_policy_ref,
      });

    case "DELEGATED":
      return ctx.graphAcl.canAccess({
        actor: ctx.userId,
        action: call.action,
        rootId: policy.graph_root_id,
        resourceId: call.resource.id,
      });
  }
}
```

**트랜잭션 엔드포인트의 경우** (`kind: "transaction"`):
- Pass 1만 통과하면 호출 허가
- Pass 2는 불필요 (트랜잭션 자체는 인스턴스 아님)
- 단, 트랜잭션 **내부**에서 호출되는 개별 API(CRUD)는 각자 2-pass 체크 독립 수행
- 중첩 트랜잭션도 각 레벨에서 자기 kind="transaction" 비트 체크 (`authorization-ontology-nested-audit-tracing` 참조)

빠른 경로: 대부분 호출은 Pass 1만으로 판정 (transaction) 또는 `UNREGISTERED + owner 체크`로 끝. DB 조회는 `resource_policies` 한 번 (캐시 가능).

### 5. 동기화 전략 — Hybrid

| 전략 | 설명 | 평가 |
|---|---|---|
| Eager | 리소스 생성 시 항상 policy 등록 | 오버헤드, 대부분 공유 안 됨 → 비효율 |
| Lazy | 첫 공유 시 policy 등록 | first-share 레이턴시 증가 |
| **Hybrid** | 생성 시 UNREGISTERED flag, 공유 시 REGISTERED 전환 | **권장** — 빈번 케이스 빠름 |

Hybrid의 구현 규칙:

1. **리소스 생성 트랜잭션**이 `resource_policies(id, owner_id, state='UNREGISTERED')` 삽입을 포함해야 한다. 별도 트랜잭션 불가 — race 방지.
2. **공유 API**는 `UPDATE resource_policies SET state='REGISTERED', cerbos_policy_ref=?, registered_at=now()` + Cerbos policy 배포를 하나의 논리 단위로 수행한다. policy 배포 실패 시 state 전이도 롤백.
3. **리소스 삭제 트랜잭션**은 `resource_policies` row도 삭제. orphan policy 방지.

### 6. 캐시 설계

```
L1: 프로세스 메모리 LRU (resource_id → policy, TTL 30s)
L2: Redis/distributed cache (resource_id → policy, TTL 5min)
L3: resource_policies 테이블 (L1/L2 miss 시)
```

**Invalidation**: 상태 전이 시 pub/sub으로 L1/L2 flush. Cerbos policy 변경 시에도 동일.

**UNREGISTERED 가속 옵션**: resource row 자체에 `policy_state` 컬럼을 denormalize → 인스턴스 조회가 이미 있으면 0-hop. 쓰기 비용과 L2 캐시 적중률 측정 후 선택.

### 7. 관측·감사

- 모든 상태 전이는 `authorization-ontology-decision-observation` 스펙과 연동해 기록 (actor, from, to, timestamp, policy_ref).
- 이 기록은 event/audit evidence다. `resource_policies.state`와 transition 함수가 state authority이며, event log만으로 현재 상태를 임의 override하지 않는다.
- `authorization-monitor-web`에 state 분포 대시보드 추가 (타입별 UNREGISTERED / REGISTERED / DELEGATED 비율).
- 배치 감사 항목:
  - orphan policy (resource 삭제됐는데 policy row 잔존)
  - missing policy (resource row는 있는데 `resource_policies` 없음)
  - inconsistent reference (`cerbos_policy_ref`가 존재하지 않는 policy를 가리킴)

## 소비 ^consumes

- `permission-engine` — `access-checker`에서 본 lifecycle을 Pass 2로 호출
- `authorization-ontology-cerbos-mapping` — REGISTERED 상태에서 Cerbos 정책 판정 호출
- `authorization-graph-store` — DELEGATED 상태에서 ACL 그래프 탐색 호출
- `coordinate-storage` — bitmap은 `VersionedBitmap { prefix, v, mask }` 형식, resource_policies의 `cerbos_policy_ref` 내부에서 VersionedIndex 참조 가능

## 위임 ^delegates

- **Cerbos policy 내용**: `authorization-ontology-cerbos-mapping` — 본 스펙은 policy 존재·ref만 다룸
- **ACL 그래프 탐색 알고리즘**: `authorization-graph-store`
- **bitmap 발급·갱신**: `permission-engine-bridge`

## 방법 ^method

### 구현 순서

1. **Phase 1 — 스키마 + 상태 머신**
   - `resource_policies` 테이블 마이그레이션
   - `ResourcePolicyRegistry` 클래스 (CRUD + 전이 API)
   - FSM 검증 테스트 (역전이 거부, 동시성)

2. **Phase 2 — 체크 통합**
   - `access-checker.ts` 신규 파일
   - 기존 `permission-middleware`에 Pass 1 + Pass 2 통합
   - Cerbos 연결은 `authorization-ontology-cerbos-mapping` 경로 재사용

3. **Phase 3 — 캐시·관측**
   - L1/L2 캐시 + invalidation
   - decision-observation 연동
   - 감사 배치 스크립트

4. **Phase 4 — 마이그레이션**
   - 기존 리소스에 `resource_policies` row 소급 생성 (모두 UNREGISTERED)
   - 이미 공유된 리소스는 analyze 후 REGISTERED로 승격
   - 감사 후 FSM 활성화

각 phase는 별도 `todo` 문서로 승격해 추적한다.

### 테스트 전략

- **FSM 테스트**: 전이 합법성 (UNREGISTERED → REGISTERED OK, REGISTERED → UNREGISTERED FAIL)
- **체크 알고리즘**: 각 상태에서 owner/non-owner/admin actor 조합 시나리오
- **트랜잭션 안전성**: 생성 중 실패 시 resource와 policy 모두 롤백
- **캐시 일관성**: 전이 후 L1/L2 invalidation 타이밍

## 주의사항

- **default deny는 데이터 구조에서 나온다**: UNREGISTERED 기본값이 소유자 외 거절을 자동 보장. 코드 규율에 의존하지 않음.
- **Pass 1 먼저**: bitmap 체크 없이 Pass 2만 호출하면 안 됨 — 타입 레벨 거절이 먼저 와야 Cerbos 부하 감소.
- **policy ref 무결성**: `cerbos_policy_ref`가 실제 존재하는지 주기 감사 필수. 참조 유실이 곧 권한 허용 불일치.
- **역전이 금지 엄수**: 접근 범위 축소는 policy 변경으로. 상태 되돌리기는 의미 모호 + 감사 복잡도 ↑.
- **직접 DB 접근 bypass**: 본 lifecycle은 API 레이어 방어. DB 직접 접근까지 보호하려면 RLS 별도 설계 필요 — 추후 스펙으로 분리.

## 용어

- **ResourceInstancePolicy**: `resource_policies` 테이블의 한 행. 리소스 인스턴스의 권한 상태와 policy reference를 표현.
- **2-pass check**: 타입 레벨 bitmap + 인스턴스 레벨 policy의 순차 판정.
- **Hybrid sync**: 생성 시 flag만, 공유 시 policy 등록하는 지연 정책 등록 전략.
- **Default deny by construction**: 상태 기본값으로 deny를 보장하는 방식. 규율 기반 deny와 대비.
