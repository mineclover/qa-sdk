# demo-dkg-config

`DEMO_DKG_CONFIG` — DKG bootstrap 설정 SSOT (decision-flow flow schema 포함).

- **tier**: logic
- **의존**: `decision-flow` (flow schema 데이터)
- **소비**: `dkg-enrichment.bootstrapDkg`, CLI `dkg-config-loader`, registry seed

`demo-snapshot`은 `DEMO_CATALOG`만 제공한다. DKG 설정은 본 패키지에서 import.

```ts
import { DEMO_DKG_CONFIG } from "demo-dkg-config";
```
