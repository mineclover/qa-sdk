# Final Review Fix Report

## Scope
- Purged stale semantic rows during full semantic materialization snapshots.
- Filtered document search totals/results to realized semantic docs only.
- Extended semantic search search-record context and emitted `wrong-scope-or-alias-missing` feedback for no-hit and disagreement cases.

## Changes
- `packages/definition-service/src/modules/docs/docs.service.ts`: filters semantic candidates against realized docs, computes totals from realized semantic docs, and forwards semantic/legacy hit counts to the semantic service.
- `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.ts`: adds snapshot replacement cleanup and mismatch feedback emission.
- `packages/definition-service/src/stores/semantic-grounding-store.ts`: adds stale-doc purge support for semantic terms, aliases, and relations.
- `packages/definition-service/src/modules/sync/sync.service.ts`: full sync now requests snapshot replacement cleanup.
- Tests added/updated in docs, semantic-grounding service, and store coverage for stale candidate totals, snapshot cleanup, and mismatch feedback.

## Verification
- `../../node_modules/.bin/vitest run src/modules/docs/docs.service.test.ts src/modules/semantic-grounding/semantic-grounding.service.test.ts src/stores/semantic-grounding-store.test.ts src/modules/docs/semantic-search.integration.test.ts`
- `../../node_modules/.bin/vitest run`
- `/Users/junwoobang/workflow/qa-sdk/.worktrees/semantic-grounding/node_modules/.pnpm/node_modules/.bin/tsc -p tsconfig.json --noEmit` -> fails on pre-existing baseline errors in `src/core/sync-engine.ts`, `src/modules/graph/graph.service.ts`, and `src/modules/graphql/doc.resolver.ts`

## Notes
- The workspace-wide `pnpm --filter @qa-sdk/definition-service typecheck` also failed early on an unrelated workspace package/dependency resolution issue in `packages/visbug-bridge`.
