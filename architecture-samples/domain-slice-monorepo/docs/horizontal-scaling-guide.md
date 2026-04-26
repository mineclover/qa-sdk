# Horizontal Scaling Guide

## Scaling boundaries

Scale by runtime responsibility, not by source folder.

| Runtime | Scales by | Keep shared state out of |
|---|---|---|
| API | HTTP request rate, latency, CPU | process memory |
| Worker | queue lag, event age, retry pressure | local filesystem |
| Database | connection saturation, write latency | application pods |
| Cache | key cardinality, hit ratio, eviction rate | domain entity logic |

## API rules

- API pods must be stateless.
- Idempotency keys belong in persistence or cache, never in process memory.
- Controllers call use cases only.
- Use cases depend on ports only.
- Repository and outbox adapters are the composition boundary.

## Worker rules

- Workers consume events through a contract package.
- Projectors own read-model updates and can scale independently from API pods.
- Queue lag is the first scaling metric.
- Retry and dead-letter policy must be observable before increasing max replicas.

## Metadata and cache rules

- Every read model has an OpenMetadata seed entry.
- Cache prefix is managed as DSL metadata, then rendered as `prefix:version:id`.
- Cache keys must include version before business identifiers.

## Deployment baseline

- `infra/docker-compose.yml` is the local template.
- `infra/k8s/api-deployment.yaml` is the stateless API scaling template.
- `infra/k8s/worker-deployment.yaml` is the queue consumer scaling template.

## Expansion path

1. Add a new domain slice under `apps/api/src/modules/<domain>`.
2. Put public API/event contracts in `packages/contracts`.
3. Add metadata seed under the domain slice.
4. Add worker projector only when async read-model ownership exists.
5. Add HPA metric only after the metric is emitted and observed.

