---
def:
  id: authorization-management-hardening-todo
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [security, observability, structural]
  links:
    - target: authorization-management-usecases
      type: refines
    - target: authorization-management-usage-rule
      type: depends_on
    - target: authorization-ontology-system
      type: depends_on
---

# Authorization Management Hardening — 보강 TODO

## 목적 ^purpose

현재 구현된 권한 관리 usecase를 운영 가능한 권한 관리 시스템으로 안정화하기 위해 남은 구현 항목을 추적한다.

## 구현 항목

### Completed — 완료 기록

#### Graph Store / API

- [x] `AuthorizationOntologyGraph` 저장용 store adapter 정의
- [x] graph snapshot 저장/조회 API 추가
- [x] decision observation ingest API 연결
- [x] graph diff API 추가

#### Policy Source Adapter

- [x] Cerbos JSON loader 추가
- [x] Cerbos YAML loader 추가
- [x] Cerbos bundle/sourceRef/version metadata adapter 추가

#### Runtime Feedback

- [x] `PermissionMiddleware` feedback을 ingest event로 전송하는 adapter 추가

#### Audit / Coverage

- [x] route-policy-domain-resource coverage score 계산

#### Monitor Web

- [x] `authorization-monitor-web` live API adapter 추가
- [x] graph store에서 실제 graph를 읽는 모드 추가

### Actionable — 실행 가능

#### Policy Source Adapter

- [ ] Caddy config adapter 추가
- [ ] Authentik outpost/application adapter 추가
- [ ] ArgoCD/Pulumi output에서 route-policy map 자동 생성

#### Runtime Feedback

- [ ] `VERSION_MISMATCH` 발생 시 token refresh/remediation workflow 정의
- [ ] `SCHEMA_MISMATCH` 발생 시 re-authentication workflow 정의
- [ ] `PERMISSION_DENIED`와 `NO_DOMAIN_CLAIM`의 운영 alert severity 분리

#### Audit / Coverage

- [ ] proxy-only 보호 route와 app-only 보호 resource 차이 report
- [ ] allow decision이 policy action과 불일치할 때 gate 실패 처리
- [ ] dangling relation을 build/test gate로 승격
- [ ] column lineage policy propagation 결과를 audit report에 포함

#### Monitor Web

- [ ] audit issue panel 추가
- [ ] RLSC layout snapshot 자동 수집 테스트 추가
- [ ] edge/node alignment regression test 추가

#### Security / Privacy

- [ ] principal/resource/action metadata masking rule 정의
- [ ] PII column lineage graph 공개 범위 정책 정의
- [ ] decision reason에 민감한 condition 값이 노출되지 않게 redaction rule 추가
- [ ] graph export 권한 정책 추가

### Deferred — 조건부 대기

현재 조건부 대기 항목은 없다. 실행 계획이 별도 조건이나 외부 의존성을 확정하기 전까지 남은 미완료 항목은 `Actionable — 실행 가능`에 둔다.

### Parking Lot — 후보 보관

현재 후보 보관 항목은 없다. 새 구현 범위나 아이디어성 후보는 별도 결정 없이 이 문서에 추가하지 않는다.
