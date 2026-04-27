# Surface Map

## Responsibility Topology

| Surface | Responsibility |
|---|---|
| `domain/*.ids.ts` | Entry / stable identity |
| `domain/*.types.ts` | Component / state shape |
| `domain/*.entity.ts` | System / invariant behavior |
| `application/commands` | Interface / command contract |
| `application/ports` | Interface / outbound contract |
| `application/use-cases` | System / orchestration |
| `application/queries` | Interface / read-side contract |
| `infrastructure/persistence` | Component + System / schema and adapter |
| `infrastructure/outbox` | System / reliable publish adapter |
| `infrastructure/transaction` | System / unit of work |
| `infrastructure/read-model` | System / read-side projection |
| `infrastructure/adapters` | System / cross-domain query adapters (in-process / http) |
| `presentation/http` | Interface / HTTP adapter |
| `presentation/bff` | Interface/System / UI composition boundary |
| `metadata` | Layout / governance seed (OpenMetadata + cache key DSL + `topology` SSOT) |

## Slice Topology (5-way)

| topology | aggregate | use-case | transaction | outbox | read-model | bff |
|---|---|---|---|---|---|---|
| `service` | yes | yes | yes | yes (boundary) | optional | optional |
| `read-model` | absent | rare | absent | absent | yes | optional |
| `bff` | absent | rare | absent | absent | optional | yes |
| `command-only` | absent | yes | yes | optional | absent | absent |
| `read-mostly` | absent | rare | absent | absent | yes | optional |

위상은 `metadata/openmetadata.seed.json` top-level `topology` 필드가 SSOT. 상세 + validator 룰 분기는 `topology-taxonomy.md`.

## Read Model vs BFF

| Question | Read Model | BFF |
|---|---|---|
| Primary consumer | query/application/data pipeline | UI screen/client |
| Shape stability | business/query stable | UI iteration-driven |
| Ownership | domain read side or projector | experience layer |
| Cache key | domain-purpose prefix | screen/composition prefix |
| Contract | query port/event projection | OpenAPI/GraphQL/client contract |
| Topology | `read-model` (또는 `read-mostly`) | `bff` |

If a BFF starts owning business decisions, move that behavior into application/domain and keep BFF as composition.

## Slice Grouping (Registry Marker)

Validator `isDomainSliceProperlyGrouped` 가 두 형태를 허용:

1. **전통**: `apps/api/src/modules/<domain>/<slice>` (architecture-samples).
2. **시뮬레이션**: 부모에 `<domain>-slices.registry.ts` 마커. 예 — `services/pm-api/src/pm/pm-slices.registry.ts` + `services/pm-api/src/pm/assignment/`.
3. **Top-level slice**: 인접 같은 깊이의 `<slice>-slices.registry.ts` 마커도 허용 (예: `src/density/` + `src/density-slices.registry.ts`).

마커가 없으면 `domain-slice-under-modules` ERROR.

## Cross-Domain Access

다른 슬라이스 / 다른 서비스의 read 가 필요할 때:
- `application/ports/<dependency>-query.port.ts` 추상 + AlwaysTrue/Optional 기본 구현 (fail-open)
- `infrastructure/adapters/in-process-<dependency>-query.adapter.ts` (구조적 타이핑 — 정적 의존 회피)
- `infrastructure/adapters/http-<dependency>-query.adapter.ts` (`AbortSignal.timeout` 필수)

상세: `cross-domain-ports.md`.

## Horizontal Scaling

- API scales by stateless HTTP metrics.
- Worker scales by queue lag/event age.
- Read model projector scales independently from API.
- Cache does not remove the need for idempotency.
- OpenMetadata seed follows data ownership, not deployment topology.
