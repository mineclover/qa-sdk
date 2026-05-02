---
def:
  id: authorization-management-usecases
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [security, observability, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-ontology-auth-chain
      type: depends_on
    - target: authorization-ontology-application-enforcement
      type: depends_on
    - target: authorization-ontology-permission-engine-bridge
      type: depends_on
    - target: authorization-ontology-audit-layer
      type: depends_on
---

# Authorization Management Usecases — 구현된 권한 관리 유스케이스

## 목적 ^purpose

현재 인프라가 제공할 수 있는 권한 관리 유스케이스를 구현 완료 기준으로 정리한다. 이 문서는 목표나 잔여 작업이 아니라, 현재 코드와 테스트로 증명된 권한 관리 capability의 색인이다.

## 정의 ^defines

### UC-01 — Proxy Route 권한 topology 생성

- **관여 패키지**: `infra-engine`, `authorization-ontology`
- **입력**: Nginx/Zitadel proxy config, route별 policy map
- **출력**: `proxy_route`, `nginx_proxy`, upstream service, policy relation graph
- **핵심 relation**: `enforced_at`, `matches_resource`, `protects`
- **검증**: `packages/infra-engine/__tests__/commands/authz.test.ts`

### UC-02 — Application Middleware 권한 적용 모델링

- **관여 패키지**: `authorization-ontology`
- **입력**: service, domain resource, middleware, policy, action, deployment
- **출력**: service 내부 fine-grained authorization graph
- **핵심 relation**: `matches_resource`, `enforced_at`, `protects`, `evaluated_by`, `deployed_by`
- **검증**: `packages/authorization-ontology/src/index.test.ts`

### UC-03 — Cerbos Resource Policy 선언 투영

- **관여 패키지**: `authorization-ontology`
- **입력**: Cerbos-like `resourcePolicy` object
- **출력**: policy/resource/action graph
- **핵심 relation**: `protects`, `allows_action`, `denies_action`
- **검증**: `projectCerbosResourcePolicy()` 테스트

### UC-04 — Cerbos Derived Roles 투영

- **관여 패키지**: `authorization-ontology`
- **입력**: Cerbos-like `derivedRoles` object
- **출력**: derived role, parent role, imported derived role graph
- **핵심 relation**: `imports_derived_role`, `derives_role_from`
- **검증**: `projectCerbosDerivedRoles()` 테스트

### UC-05 — permission-engine bitmask 권한 투영

- **관여 패키지**: `permission-engine`, `authorization-ontology`
- **입력**: `PermissionSetSnapshot` 또는 grant list
- **출력**: `domain_role -> grants_feature -> permission_feature` graph
- **핵심 relation**: `grants_feature`, `denies_feature`, `materializes_permission`
- **검증**: `packages/authorization-ontology/src/permission-engine-bridge.test.ts`

### UC-06 — Role / Org Role 계보 투영

- **관여 패키지**: `permission-engine`, `authorization-ontology`
- **입력**: `DomainRoleDef`, `OrgRoleDef`
- **출력**: domain role inheritance, org role assignment graph
- **핵심 relation**: `derives_role_from`, `assigns_role`, `denies_role`
- **검증**: 실제 `RoleRegistry`, `OrgRoleRegistry` runtime proof test

### UC-07 — User Override / 최종 권한 감사 투영

- **관여 패키지**: `permission-engine`, `authorization-ontology`
- **입력**: `UserPermissionEngine.audit()` result
- **출력**: final decision graph + source role + override policy graph
- **핵심 relation**: `decision_*`, `has_role`, `grants_feature`, `denies_feature`, `overrides_permission`
- **검증**: 실제 `UserPermissionEngine.audit()` runtime proof test

### UC-08 — Permission Middleware Feedback 투영

- **관여 패키지**: `permission-engine`, `authorization-ontology`
- **입력**: `PermissionMiddleware.check()` result
- **출력**: token/schema/version/domain/feature feedback decision graph
- **피드백 종류**: `VERSION_MISMATCH`, `SCHEMA_MISMATCH`, `NO_DOMAIN_CLAIM`, `FEATURE_NOT_FOUND`, `PERMISSION_DENIED`
- **검증**: 실제 `PermissionMiddleware.check()` runtime proof test

### UC-09 — Column-level Policy Propagation

- **관여 패키지**: `authorization-ontology`
- **입력**: source column, target column, transform, propagation rule
- **출력**: lineage 기반 policy propagation graph
- **핵심 relation**: `derives_from`, `inherits_policy_from`, `downgrades_policy_from`, `requires_manual_review`
- **검증**: `projectColumnPolicyPropagation()` 테스트

### UC-10 — Decision Observation

- **관여 패키지**: `authorization-ontology`
- **입력**: Cerbos decision 또는 direct authorization decision
- **출력**: principal/resource/action/policy/enforcement point가 연결된 decision graph
- **핵심 relation**: `decision_principal`, `decision_resource`, `decision_action`, `decision_policy`, `decision_enforcement`
- **검증**: `projectAuthorizationDecision()`, `projectCerbosDecisionObservation()` 테스트

### UC-11 — Authorization Graph Audit

- **관여 패키지**: `authorization-ontology`
- **입력**: policy graph, proxy graph, app graph, decision graph의 merge 결과
- **출력**: route/resource/decision 연결 누락 report
- **핵심 검사**: missing policy, missing enforcement, missing upstream, dangling relation, policy-action mismatch
- **검증**: `auditAuthorizationGraph()` 테스트

### UC-12 — Authorization Monitor Web

- **관여 패키지**: `authorization-monitor-web`, `rlsc`
- **입력**: 샘플 authorization graph view model
- **출력**: proxy gate와 application gate 비교 시각화
- **관측 주소**: `data-qa-address`
- **검증**: `pnpm --filter @qa-sdk/authorization-monitor-web build`, dev server `200 OK`

## 소비 ^consumes

- `infra-engine` authz graph command
- `permission-engine` runtime result
- `authorization-ontology` projector/audit APIs
- `authorization-monitor-web` visualization surface
