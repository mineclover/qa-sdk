# Review Checklist

## Domain

- [ ] identity and state shape are separated
- [ ] entity does not import framework/infrastructure
- [ ] invariant behavior is tested

## Application

- [ ] use case imports ports, not adapters
- [ ] transaction boundary is explicit
- [ ] outbox/idempotency decision is documented for writes

## Contracts

- [ ] OpenAPI/event contract is separate from domain entity
- [ ] logging vocabulary has trace/correlation fields
- [ ] cache key prefix/version/id shape is defined

## Read Side and BFF

- [ ] read model and BFF model are not accidentally conflated
- [ ] UI composition logic does not mutate domain state
- [ ] cache invalidation path is named

## Tests

- [ ] domain tests cover invariant failures
- [ ] application tests cover port interactions
- [ ] contract tests cover API/event shape
- [ ] scenario tests cover read/write/logging side effects when relevant

## Documentation

- [ ] definition-catalog source links point to changed code/sample
- [ ] architecture sample is updated if the convention changed
- [ ] scaffold catalog matches generated files

