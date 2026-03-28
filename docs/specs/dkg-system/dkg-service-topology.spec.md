---
def:
  id: dkg-service-topology
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability, tier-system]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-queries
      type: depends_on
---
# ServiceTopology — 마이크로서비스 prefix 소유권과 계약

## 목적 ^purpose

단일 서비스 관점을 멀티서비스 관점으로 확장한다. 각 서비스가 prefix를 소유(own)하거나 소비(consume)하고, 서비스 간 공유는 계약(SharedContract)으로 관리된다.

## 구성 ^overview

- **ServiceTopologyRegistry**: 서비스 등록, prefix 소유/소비 관계, 공유 계약, 변경 영향 분석, 서비스 해제(draining) 관리
- **SharedContract**: provider-consumer 간 prefix 공유 계약. stableVersion 핀, breakingConditions 선언
- **buildDependencyGraph**: consumer→owner prefix 의존에서 서비스 간 방향 그래프 추출 (순환 감지 포함)
- **buildTimeline**: DKG 그래프에서 decision/observation/version-event를 시간순으로 정렬

---

## 1. 서비스 등록 (ServiceRegistration)

> 타입 정의: packages/spec-core/src/dkg/service-topology.ts — ServiceRegistration

`tier`는 자동 추론에 사용: frontend=L0, backend=L1, infra=L2, system=L3.

## 2. 소유권 역할 (OwnershipRole)

| 역할 | 의미 |
|------|------|
| `owner` | 이벤트를 생산하는 서비스. prefix당 단일 owner |
| `consumer` | 읽기/조회만 하는 서비스 |
| `observer` | 관찰만 하는 서비스 (미사용, 확장 예약) |

`registerService()` 호출 시 ownedPrefixes → owner, consumedPrefixes → consumer로 자동 등록.

## 3. 공유 계약 (SharedContract)

> 타입 정의: packages/spec-core/src/dkg/service-topology.ts — SharedContract

### 계약 버전 핀 검증

`validateContractVersions(versionUsages)` 메서드가 consumer의 실제 사용 version이 stableVersion 이상인지 검증한다.

- `stableVersion`보다 낮은 version 사용 시 `ContractViolation` 발행
- severity: 2단계 이상 차이면 `critical`, 그 외 `warning`

## 4. 변경 영향 분석

### analyzeBreakingChange(prefixId, changeType)

prefix 변경 시 영향 범위를 분석한다:
- 소비 서비스 목록 (`affectedServices`)
- 관련 계약 ID 목록 (`contractIds`)
- `requiresApproval`: consumer 또는 계약이 하나라도 있으면 `true`

### createApprovalRequest(prefixId, changeType, requestedBy)

영향받는 서비스의 팀을 추출하여 승인 요청을 생성한다. 팀이 없으면 `canProceed: true`.

## 5. Draining 모드와 서비스 해제

### drainService(serviceId) → DrainPlan

서비스를 `draining` 상태로 전이하고 이관 계획을 생성한다:

> 타입 정의: packages/spec-core/src/dkg/service-topology.ts — DrainPlan

- consumer가 있는 prefix → `requiresTransfer: true`, `suggestedNewOwner`로 첫 번째 consumer 제안
- 모든 prefix가 이관 불필요하면 `canDeregister: true`

### deregisterService(serviceId)

`draining` 상태에서만 `deregistered`로 전이. draining이 아니면 `false` 반환.

### analyzeDeregistration(serviceId)

서비스 해제 시 cascade 분석: orphanPrefixes, brokenContracts, affectedConsumers.

## 6. 테이블 의존 질의

DKG GraphRegistry와 연동하여 서비스-테이블 관계를 추론한다:

| 메서드 | 설명 |
|--------|------|
| `getTablesForService(serviceId, graph)` | 서비스가 접근하는 테이블 목록 (prefix의 table_ref dim에서 추론) |
| `getServicesForTable(tableId, graph)` | 테이블에 접근하는 서비스 목록 |

## 7. 의존 그래프 (buildDependencyGraph)

> 타입 정의: packages/spec-core/src/dkg/service-topology.ts — DependencyGraph

- `strength`: 계약이 있는 prefix 경유 의존이면 `"strong"`, 없으면 `"weak"`
- 같은 서비스 쌍 간 여러 prefix 경유 시 `via` 배열에 누적

## 8. 변경 이력 타임라인 (buildTimeline)

DKG 그래프에서 decision, observation, version-event를 시간순으로 정렬한다.

> 타입 정의: packages/spec-core/src/dkg/service-topology.ts — TimelineEvent

## 9. 데모 토폴로지 (createDemoTopology)

`createDemoTopology()` 함수가 7개 서비스, 3개 공유 계약을 등록한 데모 토폴로지를 반환한다.

| 서비스 | tier | 소유 prefix | 소비 prefix |
|--------|------|------------|------------|
| shopping-web | frontend | page_view, tracking | permission, endpoint, flow_point, service |
| shopping-backend | backend | cart_event, order_event, permission, event | service, endpoint |
| auth | backend | auth_event, rbac | permission, service, endpoint |
| payment | backend | (없음) | permission, order_event, endpoint, service |
| infra-controller | infra | deploy_event, health_event, pipeline_point 등 10종 | (없음) |
| content-service | frontend | content, relational | service, endpoint |
| gateway | backend | flow_point | service, endpoint, permission |

공유 계약 3건: SC-permission (provider: shopping-backend), SC-endpoint/SC-service (provider: infra-controller).

## 관련 소스

| 파일 | 역할 |
|------|------|
| `packages/spec-core/src/dkg/service-topology.ts` | ServiceTopologyRegistry, buildDependencyGraph, buildTimeline, createDemoTopology |
| `packages/spec-core/src/dkg/skills/service-explorer.ts` | exploreService (ServiceTopology + DKG + Catalog 조합 질의) |
