# @qa-sdk/authorization-monitor-web

`@qa-sdk/authorization-monitor-web`는 authorization ontology의 proxy enforcement와 application enforcement를 분리해서 관측하는 독립 Vite 앱이다.

## 먼저 볼 문서

- [authorization-ontology-system.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-system.spec.md) — 전체 권한 온톨로지
- [authorization-ontology-auth-chain.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-auth-chain.spec.md) — proxy/auth chain 모델
- [authorization-ontology-application-enforcement.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-application-enforcement.spec.md) — app middleware enforcement 모델
- [authorization-ontology-audit-layer.spec.md](../../docs/specs/authorization-ontology/authorization-ontology-audit-layer.spec.md) — 선언/적용/관측 audit 모델

## 패키지 역할

- proxy route gate와 application domain-resource gate를 같은 graph로 시각화한다.
- Cerbos policy가 `proxy_route`와 `domain_resource`를 어떻게 보호하는지 보여준다.
- decision observation이 principal/resource/action/policy/enforcement point를 어떻게 연결하는지 보여준다.
- graph adapter/layout/SVG rendering은 `viz-core/ontology-graph`의 공통 ontology visualization model을 사용한다.
- `/authorization-graph-snapshot.json` 또는 `?graph=<url>`로 graph snapshot JSON을 읽고, 실패하면 샘플 graph view model로 fallback한다.
- RLSC 수집을 위해 주요 surface, node, edge에 `data-qa-address`를 부여한다.

## Graph source

기본 경로:

```text
/authorization-graph-snapshot.json
```

임의 graph snapshot URL:

```text
/?graph=/path/to/authorization-graph-snapshot.json
```

payload는 `AuthorizationOntologyGraph` 자체이거나 `{ graphId, snapshotId, graph }` 형태의 snapshot object일 수 있다.

## RLSC 관측

브라우저에서 `rlsc`를 주입해 다음처럼 수집할 수 있다.

```ts
import { collectLayout } from "rlsc";

const doc = collectLayout(document.querySelector("#app")!, {
  addressAttribute: "data-qa-address",
});
```

그래프 canvas는 `authz-monitor:surface:graph-canvas`, 노드는 `authz-monitor:node:<lane>:<anchor>`, edge는 `authz-monitor:edge:<index>:<relation>` 주소로 관측된다.

## 실행

```bash
pnpm --filter @qa-sdk/authorization-monitor-web dev
pnpm --filter @qa-sdk/authorization-monitor-web build
pnpm --filter @qa-sdk/authorization-monitor-web test
```

`test`는 production build 후 `dist/index.html`, JS/CSS asset, `authorization-graph-snapshot.json` 복사, proxy/application resource graph payload, RLSC `data-qa-address` marker를 확인한다.
