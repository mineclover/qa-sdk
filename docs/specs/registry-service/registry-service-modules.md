---
def:
  id: registry-service-modules
  tier: system
  address: def_document:v2:68642
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: registry-service
  tags: [structural]
  links:
    - target: registry-system
      type: refines
    - target: registry-catalog-module
      type: contains
    - target: registry-prefixes-module
      type: contains
    - target: registry-versions-module
      type: contains
    - target: registry-axes-module
      type: contains
    - target: registry-services-module
      type: contains
    - target: registry-events-module
      type: contains
    - target: registry-workspace-module
      type: contains
    - target: registry-dashboard-module
      type: contains
    - target: registry-seed-module
      type: contains
    - target: registry-ui
      type: contains
---
# Registry Service Nest 모듈 구성

## 목적 ^purpose

`registry-service`의 NestJS 런타임을 기능 단위 모듈로 분해해 HTTP surface, 런타임 seed, 개발용 대시보드, 공용 store/provider 조립 지점을 1:1로 문서화한다. 이 문서는 `AppModule`과 `RuntimeModule`이 어떤 모듈을 어떤 책임으로 조합하는지 빠르게 파악하기 위한 진입점이다.

## 사용 맥락 ^context

Nest 전환 이후 `packages/registry-service/src/app.module.ts`를 확장하거나 특정 API 계약의 구현 위치를 찾을 때 이 문서를 먼저 본다. 요청 경로를 기준으로 어떤 모듈이 담당하는지, startup 시점 side effect가 `SeedModule`에만 머무는지, 개발용 DKG 의존성이 `DashboardModule`에 격리되어 있는지를 확인하는 데 쓴다.

## 설계 의도 ^intent

모듈 문서는 HTTP route 목록을 다시 풀어 쓰는 문서가 아니라, controller/service/provider/export 경계가 왜 그렇게 묶였는지를 남기는 용도다. `registry-service`는 Hono thin adapter를 제거하고 Nest feature module로 수렴했지만, 실제 비즈니스 로직은 shared service와 store provider에 유지하는 패턴을 택했기 때문에 문서도 같은 단위로 끊어야 drift를 줄일 수 있다.

## 구성 ^overview

- `registry-catalog-module`: catalog CRUD, config 관리, decode map 계산을 담당한다.
- `registry-prefixes-module`: prefix owner/profile CRUD와 삭제 보호 규칙을 담당한다.
- `registry-versions-module`: draft 생성부터 activate/deprecate까지의 버전 라이프사이클과 optional activation hook을 담당한다.
- `registry-axes-module`: axis profile CRUD와 entry headroom 규칙, catalog namespace 격리를 담당한다.
- `registry-services-module`: service topology, endpoint registry, applications, service health surface를 묶는다.
- `registry-events-module`: event schema CRUD와 정적 event catalog 조회를 제공한다.
- `registry-workspace-module`: draft workspace 시뮬레이션과 release orchestration을 묶는다.
- `registry-dashboard-module`: `/api/dashboard`, `/api/diagrams`, `/dev`, `/dev/ws`의 개발 관찰 surface를 제공한다.
- `registry-seed-module`: runtime 부팅 시 demo catalog/config/endpoints/events seed와 definition-service sync를 수행한다.

## 관련 소스

- `packages/registry-service/src/app.module.ts` — 앱 기본 모듈 조립
- `packages/registry-service/src/runtime.module.ts` — runtime 전용 `SeedModule` 합성
- `packages/registry-service/src/modules/catalog/catalog.module.ts` — catalog 기능 모듈
- `packages/registry-service/src/modules/prefixes/prefix.module.ts` — prefixes 기능 모듈
- `packages/registry-service/src/modules/versions/version.module.ts` — versions 기능 모듈
- `packages/registry-service/src/modules/axes/axis.module.ts` — axes 기능 모듈
- `packages/registry-service/src/modules/services/service.module.ts` — services 기능 모듈
- `packages/registry-service/src/modules/events/event.module.ts` — events 기능 모듈
- `packages/registry-service/src/modules/workspace/workspace.module.ts` — workspace 기능 모듈
- `packages/registry-service/src/modules/dashboard/dashboard.module.ts` — dashboard 기능 모듈
- `packages/registry-service/src/modules/seed/seed.module.ts` — seed 기능 모듈
