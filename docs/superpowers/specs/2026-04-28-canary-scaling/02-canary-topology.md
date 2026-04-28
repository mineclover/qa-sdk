# Enterprise-PM Canary & Scaling — Canary Topology

> v1/v2 두 버전을 동시에 띄우고, qa-sdk catalog version axis로 식별·승격하며, gateway가 단일 라우팅 책임을 진다.

## 1. v1/v2 동시 배포 표현 (docker-compose)

기존 단일 `sim-approval-api` entry는 제거한다. 대신 두 개의 entry를 둔다 — `sim-approval-api-v1`(stable)과 `sim-approval-api-v2`(candidate). 두 entry는 같은 Dockerfile을 공유하고, 서로 다른 이미지 태그와 `SIM_SERVICE_VERSION` env 만으로 구분된다.

```yaml
sim-approval-api-v1:
  image: qa-sdk/sim-approval-api:${APPROVAL_V1_TAG}   # catalog 산출 — 예: "v3"
  build:
    context: ../..
    dockerfile: simulations/enterprise-pm/services/approval-api/Dockerfile
    args:
      SERVICE_VERSION: ${APPROVAL_V1_TAG}
  environment:
    SIM_SERVICE_VERSION: ${APPROVAL_V1_TAG}    # 컨테이너 자기 버전 stamp용
    SIM_DB_WRITE_URL: postgres://qa-sdk-db:5432/...
    SIM_DB_READ_URL:  postgres://qa-sdk-db-replica:5432/...
  labels:
    sim.role: approval-api
    sim.version: ${APPROVAL_V1_TAG}
  # replica: docker compose up -d --scale sim-approval-api-v1=N

sim-approval-api-v2:
  image: qa-sdk/sim-approval-api:${APPROVAL_V2_TAG}   # 예: "v4-candidate"
  build:
    context: ../..
    dockerfile: simulations/enterprise-pm/services/approval-api/Dockerfile
    args:
      SERVICE_VERSION: ${APPROVAL_V2_TAG}
  environment:
    SIM_SERVICE_VERSION: ${APPROVAL_V2_TAG}
    SIM_DB_WRITE_URL: postgres://qa-sdk-db:5432/...
    SIM_DB_READ_URL:  postgres://qa-sdk-db-replica:5432/...
  labels:
    sim.role: approval-api
    sim.version: ${APPROVAL_V2_TAG}
  # replica: docker compose up -d --scale sim-approval-api-v2=N
```

승격 시 흐름은 다음과 같다.

1. v2 이미지 태그가 catalog에서 `v4`로 latest 갱신된다.
2. compose가 v1 entry를 stop 한다.
3. v2를 stable로 명명 변경한다 (또는 `compose down` v1 + `compose up` v2).

이미지 태그·라벨·env 식별자는 모두 `03-identifier-grammar.md`의 typed builder를 통해 만들어진다. 임의 문자열 보간은 금지한다.

## 2. qa-sdk catalog version axis 통합

서비스 버전을 임의 문자열로 다루지 않는다. catalog의 version axis 위에 정수 좌표로 등록하고, 그 좌표가 곧 이미지 태그가 된다.

### 2.1 service prefix 등록

각 시뮬 서비스마다 `sim.svc.*` prefix를 등록하고 version axis를 붙인다. headroom 64 버전으로 잡아 향후 후속 시뮬도 같은 패턴을 재사용할 수 있다.

```ts
// simulations/enterprise-pm/contracts/service-version.catalog.ts
export const SIM_SERVICE_PREFIXES = {
  approvalApi: {
    prefix: "sim.svc.approval",
    versionAxis: { kind: "version", capacity: 64 },   // 64 버전 헤드룸
    refEntries: [
      { version: "v1", state: "retired" },
      { version: "v2", state: "retired" },
      { version: "v3", state: "stable" },
      { version: "v4", state: "candidate" },
    ],
  },
  // 다른 시뮬 서비스도 후속에 같은 패턴 (auth, pm, ...)
} as const;
```

state 값은 `retired | stable | candidate` 3종으로 고정하고, 같은 prefix 안에서 stable·candidate는 각각 0개 또는 1개만 존재한다 (controller가 invariant로 강제).

### 2.2 빌드 파이프라인의 catalog 입력

빌드 스크립트는 catalog에서 직접 태그를 조회한다. 환경변수 보간으로 `latest`/`HEAD` 같은 임의 라벨을 끼워넣지 않는다.

```bash
# scripts/sim-build.sh
APPROVAL_V1_TAG=$(qa-sdk catalog get-version --prefix=sim.svc.approval --state=stable)
APPROVAL_V2_TAG=$(qa-sdk catalog get-version --prefix=sim.svc.approval --state=candidate)
docker compose build \
  --build-arg APPROVAL_V1_TAG=$APPROVAL_V1_TAG \
  --build-arg APPROVAL_V2_TAG=$APPROVAL_V2_TAG
```

이미지 태그는 catalog가 정한 version과 1:1 대응한다. catalog 외부에서 만든 태그는 빌드에 들어올 수 없다 (`03-identifier-grammar.md` §"image tag" 참조).

### 2.3 catalog 상태 전이 = 카나리 승격

승격은 별도 배포 시스템이 아니라 catalog 자체의 state 전이로 표현된다.

```
v3 stable + v4 candidate
   ↓ controller가 100% 승격 + dwellTime 통과
v3 retired + v4 stable
   ↓
controller → POST /catalog/transition { prefix: sim.svc.approval, from: v4-candidate, to: v4-stable }
```

이 전이는 audit-recorder + ingest 모두에 자동 기록된다 (catalog 자체가 그렇게 설계). 전이 실패 시 fail-closed: controller는 weight를 0으로 강제하고 v1 stable로 라우팅을 되돌린다. 상세 폴리시는 `05-error-and-scenarios.md` §"fail policy" 참조.

## 3. gateway 책임 (단일 라우팅 책임)

라우팅 결정은 **gateway 한 곳**에서만 한다. controller는 weight를 push 만 하고, approval-api는 자기 버전을 stamp 만 한다. 라우팅 표를 보고 upstream을 선택하는 책임은 gateway가 단독으로 진다.

### 3.1 라우팅 결정 흐름

```
incoming request
   │
   ├─ x-canary-override header?  → 강제 라우팅 (디버그/smoke, 내부 IP만)
   │
   ├─ user_id 추출 (JWT subject)
   │
   ├─ stickyHash = hash(user_id) % 100
   │
   ├─ routing.weight (controller가 push, gateway 메모리)
   │
   └─ if stickyHash < weight → upstream = approval-api-v2
      else                  → upstream = approval-api-v1

   ↓
   inject header: x-service-version: v3 (또는 v4)
   ↓
   proxy with traceparent
```

`x-service-version` 헤더 값은 `03-identifier-grammar.md` §"service-version header"의 builder로 생성한다. 직접 문자열 조합 금지.

### 3.2 라우팅 테이블 구조

라우팅 테이블은 gateway 메모리 안에 둔다. 외부 KV/DB 의존을 추가하지 않는다.

```ts
interface RoutingTable {
  routes: {
    [serviceName: string]: {
      revision: number;            // controller가 보낸 결정 revision
      stable:    { version: string; upstream: string };
      candidate: { version: string; upstream: string } | null;
      weight: number;              // 0~100, candidate에 보내는 비율
      stickyKey: "user_id";        // sticky 기준
    };
  };
}
```

controller → gateway 통신 규약은 다음과 같다.

- `POST /admin/routing` (gateway 내부 API, controller만 호출)
- payload에 revision 포함, gateway는 자기 revision보다 큰 것만 적용한다.
- controller 재시작 시 gateway가 현재 routing 상태를 회신하고, controller는 그 값을 자신의 출발점으로 sync 한다.

revision 단조증가는 controller가 보장한다. gateway는 들어온 revision이 작거나 같으면 silent drop 한다 (race 방지).

### 3.3 sticky-by-user 일관성 보장

같은 사용자가 요청 사이에 다른 버전을 만나면 비즈니스 일관성이 깨진다. sticky 기준은 다음과 같다.

- JWT가 user_id를 항상 포함한다. auth-api 발급 시 보장 (기존 동작 유지).
- JWT 미포함 요청 (login 등)은 기본 stable로 라우팅한다. "login 직후 카나리 진입" 케이스는 별도 시나리오에서 검증한다.
- 롤백 시에는 stickyHash와 무관하게 v1로 강제한다 (`weight=0`).
- weight가 변하더라도 같은 user_id의 라우팅 결정은 hash 함수가 deterministic 하므로 (weight 변동 폭 안에 들지 않는 한) 그대로 유지된다.

### 3.4 escape hatch 보안

`x-canary-override` 헤더는 디버그/스모크용이지만, 외부에서 이 헤더만 끼워넣어 candidate를 강제로 부르는 길이 열려서는 안 된다.

- 요청 IP가 시뮬 내부 네트워크에서 온 경우에만 신뢰한다.
- 외부 요청에 들어온 `x-canary-override`는 silent ignore 한다 (에러 응답 X — 외부 공격자에게 정보 노출 X).
- 내부 IP CIDR은 환경변수가 아니라 compose network 정의에서 도출한다.

## 4. approval-api 코드 변경 (v1/v2 공통)

다음 변경은 v1·v2 두 코드 베이스 모두에 동일하게 적용된다. v2가 깨질 시나리오는 별도 항목 (§4.3)에서 의도적으로 도입된 변경분이다.

### 4.1 자기 버전 stamp

모든 응답 헤더, 모든 outbox event payload, 모든 audit log entry에 `serviceVersion: SIM_SERVICE_VERSION` 을 첨부한다. 컨테이너가 자기 정체를 외부로 항상 노출한다 — gateway/controller가 어느 버전이 응답했는지 사후 추적할 수 있어야 한다.

### 4.2 outbox event schemaHash 발행

outbox dispatcher가 이벤트를 발행할 때 `schemaHash`를 함께 보낸다. v1·v2 코드는 빌드 시점에 자기 schema의 contentHash를 산출해 컴파일된 상수로 가진다.

ingest-server는 이벤트 수신 시 schemaHash와 catalog에 등록된 schema 간 호환성을 자동 검증한다. 호환되지 않는 schemaHash는 ingest 단계에서 `schema_drift` 진단으로 격리된다.

schemaHash builder 규약은 `03-identifier-grammar.md` §"outbox schemaHash" 참조.

### 4.3 v2 변경 요건 (시뮬 시나리오에서 의도적으로 만든)

시뮬은 "카나리가 잘 굴러간다"만 보는 게 아니라, "카나리가 깨졌을 때 무엇이 보이는가"도 검증한다. 그래서 v2에는 시나리오별로 의도적인 차이가 들어간다.

- 시나리오 9 (happy): v2 = v1과 schema 호환, behavior 동일. 100% 승격 가능.
- 시나리오 10 (compatibility 회귀): v2 = outbox event에 신규 필수 필드를 추가한다. 구버전 consumer가 깨진다 → `schemaCompatRate < 1.0` 으로 controller가 자동 감지.
- 시나리오 11 (audit spike): v2 = approval state 전이 중 일부 stage를 skip 한다. audit-recorder의 `audit_anomaly` critical 이 트리거된다.

상세 시나리오 단언은 `05-error-and-scenarios.md` §3 참조.

## 5. 신규 패키지 sim-service-catalog

위 §2의 catalog 통합은 enterprise-pm 안에 박지 않는다. 후속 시뮬(auth, pm, …)도 같은 패턴을 쓸 것이므로, 공용 패키지로 둔다.

`packages/sim-service-catalog/`:

- `getServiceVersionTag(prefix, state)` — 빌드 스크립트용. catalog에서 정확히 한 개의 (prefix, state) → version 매핑을 돌려준다. 0개 또는 2개 이상이면 throw.
- `transitionState({ prefix, from, to })` — controller 승격/롤백 시 호출. invariant 위반 (예: stable 중복) 시 throw + audit 기록.
- `getCurrentTopology(prefix)` → `{ stable, candidate, retired }` — gateway/controller 부팅 시 sync. 응답 자체에 catalog revision이 박혀 있어, gateway가 이후 받은 routing push와 정합성을 비교할 수 있다.

이 패키지는 enterprise-pm 시뮬 외부에 둬서 다른 시뮬도 사용 가능하다 (후속 시뮬 확장 대비). qa-sdk catalog 본체에 직접 의존하지 않고, `@qa-sdk/cli`의 `catalog` subcommand가 노출하는 RPC 또는 in-process API만 사용해 의존 방향을 단방향으로 유지한다.

prefix·state·version 식별자 검증은 모두 `03-identifier-grammar.md`의 typed builder/parser를 통과해야 한다 — 패키지 내부에서도 raw 문자열 사용 금지.
