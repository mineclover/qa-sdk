# @qa-sdk/scaffold

Internal NestJS schematics for generating Domain Slice Architecture code.

## Usage

```bash
nest g @qa-sdk/scaffold:domain payment \
  --parentModule src/app.module.ts \
  --includeReadModel

qa-scaffold domain payment \
  --parent-module src/app.module.ts \
  --read-model
```

The `domain` schematic creates:

- domain entity and domain exception skeleton
- identity/type/entity/exception domain files
- command DTO, application use case, repository/outbox/transaction/logger ports
- Drizzle database token, repository/schema skeleton, outbox adapter, and transaction unit of work
- optional query read model port and adapter
- optional BFF composition surface and controller
- OpenMetadata/cache-key seed manifest
- Nest controller with trace/lock decorator placeholders
- Nest module registration in the selected parent module

## Options

| Option | Required | Description |
|---|---:|---|
| `name` | yes | Domain name, e.g. `payment` or `assignment`. |
| `parentModule` | yes | Parent bounded-context Nest module to update. |
| `includeReadModel` | no | Adds query-side read model files. |
| `includeBff` | no | Adds UI-facing BFF files and implies read model files. |
| `skipFormat` | no | Skips the built-in Prettier formatting pass. |

For the `qa-scaffold domain` CLI wrapper, use `--parent-module`, `--read-model`, `--bff`,
and `--skip-format`.

## Architecture Grammar

```bash
qa-scaffold catalog
qa-scaffold validate src/payment
```

`catalog` prints the managed template artifacts and dependency rules. `validate` checks the
basic layer grammar:

- domain files do not import NestJS, Drizzle, or infrastructure code
- application files do not import infrastructure or Drizzle directly
- presentation files do not import infrastructure repositories directly
