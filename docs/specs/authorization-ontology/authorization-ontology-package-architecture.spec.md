---
def:
  tier: component
  id: authorization-ontology-package-architecture
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
source: packages/authorization-ontology/src/index.ts
---

# Authorization Ontology Package Architecture — 패키지 공개 표면

## 목적 ^purpose

`authorization-ontology` 패키지의 공개 타입과 helper를 정의한다. 목표는 Cerbos 정책 투영, realm 구분, principal/resource/action/policy node 생성, 컬럼 리니지 기반 권한 전파를 최소 API로 제공하는 것이다.

## 구성 ^overview

초기 패키지 surface:

- `AuthorizationRealm`
- `AuthorizationNode`
- `AuthorizationRelation`
- `projectCerbosResourcePolicy`
- `projectCerbosPolicySource`
- `evaluateColumnPolicyPropagation`
- `projectColumnPolicyPropagation`
- `createAuthorizationDecisionNode`
- `projectAuthorizationDecision`
- `projectCerbosDecisionObservation`
- `projectEnforcementRoute`
- `normalizeStructuredEnforcementRoute`
- `projectStructuredEnforcementRoute`
- `projectApplicationAuthorizationBinding`
- `normalizeStructuredApplicationAuthorization`
- `projectStructuredApplicationAuthorization`
- `projectPermissionEnginePermissionSet`
- `projectPermissionEngineRoles`
- `projectPermissionEngineAudit`
- `projectPermissionEngineMiddlewareFeedback`
- `parseNginxProxyLocations`
- `projectNginxProxyConfig`
- `mergeAuthorizationGraphs`
- `auditAuthorizationGraph`
- `computeAuthorizationCoverage`
- `AuthorizationGraphStore`
- `InMemoryAuthorizationGraphStore`
- `AuthorizationGraphIngestService`
- `diffAuthorizationGraphs`
- `diffAuthorizationGraphSnapshots`

패키지는 `operational-ontology`에 의존한다. 권한 전용 DB나 PDP를 포함하지 않는다.

Nginx projection은 `NginxProxyConfigProjectionOptions.policyByPath`를 통해 route path별 policy를 받는다. 이 값은 실제 policy repository를 읽는 adapter가 아니라, infra layer가 이미 해석한 route-policy wiring 결과를 ontology graph로 투영하기 위한 주입 지점이다.

audit surface는 Cerbos PDP를 대체하지 않는다. `auditAuthorizationGraph()`는 선언 graph와 관측 graph가 연결되어 있는지 검사하고, 누락된 route policy, decision policy/action/resource 연결, dangling relation을 report한다.

application enforcement surface는 서비스 내부 middleware가 어떤 domain resource와 action을 Cerbos policy로 보호하는지 선언한다. proxy route graph와 달리 보호 대상은 `domain_resource`이고 enforcement point kind는 기본적으로 `service_middleware`다.

permission-engine bridge surface는 `PermissionSetSnapshot`, `DomainRoleDef`, `OrgRoleDef`, `UserPermissionEngine.audit()`, `PermissionMiddleware.check()` 결과와 호환되는 plain object를 graph로 투영한다. 이 bridge는 `permission-engine` 실행 커널을 import하지 않고, bitmask/role/audit/middleware feedback 결과를 관측 가능한 relation으로 변환한다.

graph store surface는 `AuthorizationOntologyGraph` snapshot을 저장하고, 조회/list/delete/diff할 수 있는 최소 계약이다. 초기 adapter는 `InMemoryAuthorizationGraphStore`이며, 운영 DB adapter는 같은 `AuthorizationGraphStore` 인터페이스를 구현한다.

ingest surface는 decision, Cerbos decision, permission-engine audit, permission middleware feedback을 graph snapshot으로 저장한다. `mergeWithLatest`를 사용하면 같은 graphId의 최신 snapshot에 새 observation을 누적하고 diff를 반환한다.

## 구현 참조

- 구현: `packages/authorization-ontology/src/index.ts`
- 테스트: `packages/authorization-ontology/src/index.test.ts`
