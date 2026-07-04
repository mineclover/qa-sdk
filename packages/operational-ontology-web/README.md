# operational-ontology-web

Operational ontology store JSON을 사람이 읽을 수 있는 topology, record browser, health view로 확인하는 Vite 앱이다. 런타임 입력은 `public/samples/*.json`과 사용자가 업로드한 store JSON이며, graph rendering은 `viz-core/ontology-graph`를 사용한다.

## 실행

```bash
pnpm --filter @qa-sdk/operational-ontology-web dev
pnpm --filter @qa-sdk/operational-ontology-web build
pnpm --filter @qa-sdk/operational-ontology-web test
```

`test`는 production build 후 `dist/index.html`, JS/CSS asset, bundled sample store JSON의 최소 계약을 확인한다.
