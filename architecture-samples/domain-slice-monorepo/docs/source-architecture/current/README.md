# Current Domain Slice References

These documents are the implementation-oriented adaptation of the raw
architecture notes. Use this folder for current decisions; use `../raw/` only
for source traceability.

## Shared Terms

Use **Domain Slice Architecture** as the umbrella name. Do not describe the
system as pure Hexagonal Architecture. The current architecture combines
DDD-inspired modeling, CQRS, adapter boundaries, module composition,
OpenAPI/event/logging contracts, governance metadata, tests, and optional
BFF/read model surfaces.

## Shared Slice Boundary

```text
domain/             # identity, state shape, invariant behavior
application/        # commands, ports, use cases, transaction boundary
infrastructure/     # persistence, outbox, external adapters
presentation/       # HTTP/BFF/input adapters
metadata/           # OpenMetadata and cache-key seed
<domain>.module.ts  # composition layout
```

## Responsibility Topology

| Surface | Topology | Rule |
|---|---|---|
| `*.ids.ts` | Entry | stable identity only |
| `*.types.ts` | Component | state/data shape only |
| `*.entity.ts` | System | invariant behavior only |
| `commands`, `queries`, `ports` | Interface | contract only |
| `use-cases` | System | orchestration and consistency boundary |
| `persistence/*.schema.ts` | Component | physical data shape |
| `persistence/*.repository.ts` | System | adapter behavior |
| `outbox/*.outbox.ts` | System | event publication adapter |
| `transaction/*.transaction.ts` | System | transaction adapter |
| `logging/*.logger.ts` | System | observable event adapter |
| `read-model/*.read-model.ts` | System | query projection adapter |
| `presentation/http` | Interface | protocol adapter |
| `presentation/bff` | Interface/System | UI composition boundary |
| `metadata` | Layout | governance seed |
| `<domain>.module.ts` | Layout | provider wiring only |

## Shared Dependency Rules

- `domain` imports no framework, database, HTTP, queue, logger, or cache implementation.
- `application` imports `domain` and application-owned ports only.
- `infrastructure` implements application ports for persistence, outbox, transaction, logging, and read-model access.
- `presentation` calls use cases or inbound application interfaces.
- module/composition files may import infrastructure adapters.

## Read Model vs BFF

| Question | Read model | BFF model |
|---|---|---|
| Primary consumer | query/application/data pipeline | UI screen/client |
| Shape stability | business/query stable | UI iteration-driven |
| Ownership | domain read side or projector | experience layer |
| Cache key | domain-purpose prefix | screen/composition prefix |
| Contract | query port/event projection | OpenAPI/GraphQL/client contract |

Read model and BFF model may share storage only when the UI composition is
stable and the owner is documented.

## Document Map

| Doc | Owns |
|---|---|
| [01-domain-slice-reference.md](01-domain-slice-reference.md) | slice boundary application and expansion rule |
| [02-command-query-contracts.md](02-command-query-contracts.md) | command/query/OpenAPI/cross-domain query contracts |
| [03-transaction-events-cache.md](03-transaction-events-cache.md) | transaction API, outbox, saga, cache DSL |
| [04-governance-logging-testing-bff.md](04-governance-logging-testing-bff.md) | metadata, logging, error, tests, BFF guardrails |
