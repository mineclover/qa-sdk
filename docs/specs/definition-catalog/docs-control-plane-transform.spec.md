---
def:
  id: docs-control-plane-transform
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: cli
  tags: [contract, metadata, dry-run]
  links:
    - target: docs-control-plane
      type: refines
    - target: docs-control-plane-interface
      type: depends_on
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/metadata-transform.ts
---

# Docs Control Plane Transform

## 목적 ^purpose

`qa-sdk docs transform metadata`가 definition markdown frontmatter 변경을 어떻게 dry-run preview로 계산하는지 정의한다. 이 문서는 metadata transform의 selector/change-set/guardrail contract를 소유하고, source file write authority는 별도 apply PRD가 생기기 전까지 소유하지 않는다.

## 명령 표면 ^defines

```bash
qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run] [--json]
```

## 지원 rule surface

- top-level keys: `select` 또는 `match`, `set`, `tags`, `links`, `sources`
- selector keys: `ids`, `stableIds`, `defIds`, `paths`, `familyIds`, `kinds`, `metadata`
- `set`: `lifecycle`, `level`, `svc`, `sources`
- `tags`: string array 또는 `{ add, remove }`
- `links`: `{ add, remove }` with definition link types
- `sources`: string array 또는 `{ set, add, remove }`

## guardrails

- `--apply` is unsupported.
- Protected fields: `id`, `def.id`, `defId`.
- Transform preview targets definition markdown only.
- PRD JSON, PRD markdown, session, and evidence sources are refused.
- Diagnostics with severity `error` make the command fail without writing.

## 구현 경계

- `metadata-transform.ts` owns rule loading, validation, matching, change-set preview, and diagnostics.
- `commands/docs.ts` owns command parsing, structured errors, text/JSON output, and exit code policy.
