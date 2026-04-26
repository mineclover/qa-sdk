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
| `infrastructure/persistence` | Component + System / schema and adapter |
| `infrastructure/outbox` | System / reliable publish adapter |
| `presentation/http` | Interface / HTTP adapter |
| `presentation/bff` | Interface/System / UI composition boundary |
| `metadata` | Layout / governance seed |

## Read Model vs BFF

| Question | Read Model | BFF |
|---|---|---|
| Primary consumer | query/application/data pipeline | UI screen/client |
| Shape stability | business/query stable | UI iteration-driven |
| Ownership | domain read side or projector | experience layer |
| Cache key | domain-purpose prefix | screen/composition prefix |
| Contract | query port/event projection | OpenAPI/GraphQL/client contract |

If a BFF starts owning business decisions, move that behavior into application/domain and keep BFF as composition.

## Horizontal Scaling

- API scales by stateless HTTP metrics.
- Worker scales by queue lag/event age.
- Read model projector scales independently from API.
- Cache does not remove the need for idempotency.
- OpenMetadata seed follows data ownership, not deployment topology.

