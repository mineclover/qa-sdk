---
def:
  id: authorization-management-usage-rule
  level: leaf
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [security, observability]
  links:
    - target: authorization-management-usecases
      type: refines
    - target: authorization-ontology-system
      type: depends_on
---

# Authorization Management Usage — 소비 규칙

## 목적 ^purpose

현재 권한 관리 시스템을 사용할 때 어떤 계층에서 어떤 권한 처리를 선택하고, 어떤 피드백을 반드시 남겨야 하는지 정의한다.

## 체크리스트

### 1. Proxy 권한을 사용할 때

- route-level 보호가 목적이면 proxy enforcement를 사용한다.
- route는 반드시 `proxy_route` resource로 식별한다.
- proxy enforcement point는 `nginx_proxy`, `caddy`, `authentik_proxy`, `cloud_lb` 중 하나로 선언한다.
- route는 upstream service와 `matches_resource`로 연결되어야 한다.
- route별 policy map을 통해 `policy -> protects -> proxy_route`를 남긴다.
- proxy에서 객체/컬럼/row 단위 권한을 처리하려 하지 않는다.

### 2. Application 권한을 사용할 때

- 객체, row, column, action 단위 판단은 application enforcement로 처리한다.
- 보호 대상은 `domain_resource` 또는 data resource로 선언한다.
- service 내부 middleware는 `service_middleware` enforcement point로 선언한다.
- application graph는 `domain_resource -> enforced_at -> service_middleware`를 가져야 한다.
- decision observation은 `decision_resource`, `decision_action`, `decision_policy`, `decision_enforcement`를 모두 남긴다.

### 3. Cerbos 정책을 사용할 때

- Cerbos는 선언형 policy decision point로 유지한다.
- Cerbos JSON 문자열 또는 object source는 `projectCerbosPolicySource()`로 직접 투영한다.
- Cerbos YAML 문자열은 `projectCerbosPolicySource({ sourceType: "yaml" })`로 투영한다.
- `resourcePolicy.resource`는 `policy -> protects -> resource`로 투영한다.
- `rules.effect`는 `allows_action` 또는 `denies_action`으로 투영한다.
- roles, derivedRoles, condition은 relation metadata에 보존한다.

### 4. permission-engine을 사용할 때

- O(1) runtime check는 `permission-engine`이 담당한다.
- `authorization-ontology`는 `PermissionSetSnapshot`, role definition, audit result, middleware feedback을 graph로 투영한다.
- `PermissionSet`의 bitmask grant는 `grants_feature`로 남긴다.
- `ScopedEngine` scope key는 `permission_scope`로 남긴다.
- `RoleRegistry` parent/deny는 `derives_role_from`, `denies_feature`, `denies_role`로 남긴다.
- `OrgRoleRegistry` assignment는 `assigns_role`로 남긴다.
- `UserOverrideStore` deny는 `denies_feature`와 `overrides_permission`으로 남긴다.

### 5. Middleware feedback을 남길 때

- domain claim 자체가 없으면 `NO_DOMAIN_CLAIM`이다.
- domain claim은 있으나 feature bit가 꺼져 있으면 `PERMISSION_DENIED`다.
- feature 정의가 없으면 `FEATURE_NOT_FOUND`다.
- schema hash가 다르면 `SCHEMA_MISMATCH`다.
- permission version이 낮으면 `VERSION_MISMATCH`다.
- 위 피드백은 `projectPermissionEngineMiddlewareFeedback()`으로 decision graph에 남긴다.

### 6. Audit을 실행할 때

- policy graph, proxy graph, application graph, decision graph를 `mergeAuthorizationGraphs()`로 합친다.
- 합친 graph에 대해 `auditAuthorizationGraph()`를 실행한다.
- proxy route는 policy, enforcement, upstream 연결을 모두 가져야 한다.
- domain resource는 policy와 service middleware enforcement를 가져야 한다.
- allow decision은 policy의 allow action과 연결되어야 한다.
- audit issue는 운영 알림 또는 monitor-web 표면으로 전달한다.

### 7. 문서 분류 규칙

- 구현 완료된 capability는 `.spec.md`에 기록한다.
- 이번에 실행 가능한 보강 항목은 `.todo.md`에 기록한다.
- 사용/소비 체크리스트는 `.rule.md`에 기록한다.
- 방향과 단계는 `.plan.md`에 기록한다.
- 왜 그렇게 결정했는지의 배경은 필요할 때 `.memo.md`로 분리한다.
