# authorization-ontology

`authorization-ontology`는 Cerbos 정책 선언을 중심으로 principal, resource, action, policy, decision, enforcement point, identity provider를 operational ontology 좌표계로 관리하는 초안 라이브러리다.

목표는 Cerbos를 대체하는 것이 아니라, Cerbos가 직접 다루지 않는 배포 provenance, 프록시 enforcement, ZITADEL/Authentik identity mapping, 컬럼 레벨 lineage 기반 권한 전파, 관측/diff 계층을 보완하는 것이다.

## 패키지 역할

- `AuthorizationRealm`으로 identity/policy/enforcement/infra/application/data/observation 권위 경계를 구분한다.
- `PrincipalRef`, `ResourceRef`, `ActionRef`, `PolicyRef`를 `NodeCoord` 기반 `AuthorizationNode`로 투영한다.
- `projectCerbosResourcePolicy()`로 Cerbos resource policy를 policy/resource/action graph로 변환한다.
- `projectCerbosDerivedRoles()`로 Cerbos derived roles를 policy/derived-role/parent-role graph로 변환한다.
- `projectCerbosDecisionObservation()`로 Cerbos check 결과를 decision/principal/resource/action/policy/enforcement graph로 변환한다.
- `projectEnforcementRoute()`로 Caddy/AuthentiK/Cloud LB route를 enforcement point, upstream resource, Cerbos policy, deployment provenance graph로 변환한다.
- `normalizeStructuredEnforcementRoute()`와 `projectStructuredEnforcementRoute()`로 실제 proxy config parser가 사용할 canonical intermediate shape를 제공한다.
- `parseNginxProxyLocations()`와 `projectNginxProxyConfig()`로 Nginx/Zitadel proxy config의 upstream/location/proxy_pass를 최소 enforcement route graph로 변환한다.
- `evaluateColumnPolicyPropagation()`와 `projectColumnPolicyPropagation()`로 컬럼 리니지 transform에 따른 권한 전파 모드를 계산한다.
- Authentik/ZITADEL/Caddy/LB/Pulumi/ArgoCD는 권한 엔진이 아니라 identity/enforcement/deployment provenance realm으로 모델링한다.

## 설계 기준

- 단일 권한 관리 주체를 전제로 한다.
- Cerbos는 선언형 권한 정책과 decision point의 중심이다.
- Authentik proxy는 경로 차단형 enforcement point다.
- ZITADEL은 SSO/issuer realm이다.
- Pulumi/ArgoCD는 정책과 서비스 wiring provenance다.
- 컬럼 레벨 lineage는 권한 정책 전파 근거다.

## 실행

```bash
pnpm --filter authorization-ontology build
pnpm --filter authorization-ontology test
pnpm --filter authorization-ontology typecheck
```
