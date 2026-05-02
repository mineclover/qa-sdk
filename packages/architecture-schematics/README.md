# @qa-sdk/scaffold

Internal NestJS schematics for generating Domain Slice Architecture code.

## Usage

```bash
nest g @qa-sdk/scaffold:domain payment \
  --parentModule src/app.module.ts \
  --includeReadModel
```

The `domain` schematic creates:

- domain entity and domain exception skeleton
- identity/type/entity/exception domain files
- command DTO, application use case, repository port, and outbox port
- Drizzle repository/schema skeleton and outbox adapter
- optional query read model port
- OpenMetadata/cache-key seed manifest
- Nest controller with trace/lock decorator placeholders
- Nest module registration in the selected parent module

## Options

| Option | Required | Description |
|---|---:|---|
| `name` | yes | Domain name, e.g. `payment` or `assignment`. |
| `parentModule` | yes | Parent bounded-context Nest module to update. |
| `includeReadModel` | no | Adds query-side read model files. |
| `skipFormat` | no | Skips the built-in Prettier formatting pass. |

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
