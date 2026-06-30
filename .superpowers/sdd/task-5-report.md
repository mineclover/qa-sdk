# Task 5 Report: Rebuild Semantic Materialization During Sync

## Summary
- `SyncService.run()` now rebuilds semantic grounding immediately after the FTS index rebuild, using the same `DocRecord[]` snapshot.
- The sync path keeps the existing search-index rebuild behavior and logging intact, then logs the semantic materialization report.
- Added a regression proving stale semantic terms are replaced when the same document is rematerialized.

## Changes
- `packages/definition-service/src/modules/sync/sync.service.ts`
  - Injected `SemanticGroundingService`.
  - Made `rebuildSearchIndex()` return the `DocRecord[]` snapshot used for indexing.
  - Reused that snapshot to call `semantic.materializeDocuments(allDocs)`.
  - Logged the semantic grounding materialization report after the FTS rebuild.
- `packages/definition-service/src/modules/semantic-grounding/semantic-grounding.service.test.ts`
  - Added a regression covering rematerialization of the same document with updated title and tags.

## Verification
- `../../node_modules/.bin/vitest run src/modules/semantic-grounding/semantic-grounding.service.test.ts`
  - PASS: `7` tests passed.
- `pnpm --filter @qa-sdk/definition-service typecheck`
  - FAIL before source typechecking because the workspace has a pre-existing dependency resolution issue in `packages/visbug-bridge`:
    - `rlsc-analysis@workspace:*` is missing from the workspace.
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit --pretty false`
  - FAIL with pre-existing baseline errors only in:
    - `src/core/sync-engine.ts`
    - `src/modules/graph/graph.service.ts`
    - `src/modules/graphql/doc.resolver.ts`
- `git diff --check`
  - PASS

## Notes
- I did not modify any files outside the Task 5 scope.
- The semantic materialization report is intentionally logged after FTS rebuild so both systems consume the same post-sync document snapshot.
