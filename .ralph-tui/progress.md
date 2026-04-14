# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- Planning-only lifecycle boundary stories should close acceptance criteria in the execution PRD before implementation stories run: record the lifecycle boundary, selected vocabulary value, rejected alternatives, and 5Q rationale in the PRD itself.

---

## 2026-04-15 - US-001
- Confirmed the activation evidence persistence plan is a post-lifecycle public/local follow-up over the completed `qa-sdk ontology registry activate-pack` CLI, not a new allocation lifecycle phase.
- Checked the lifecycle master boundary: after Phase 5 there is no next lifecycle implementation PRD; Phase 6 remains policy-only and scoped prefix implementation stays frozen under `operational-ontology-scoped-prefix-decision`.
- Defined the managed evidence contract as `--output <file>` plus explicit artifact registry append; `--output` alone remains a sidecar-only JSON materialization.
- Chose `activation-evidence` as the artifact kind before implementation, rejected `deployment-output`, `quality-status`, and `prompt-artifact`, and documented the 5Q rationale for adding the vocabulary value in the next story.
- Did not implement persistence, REST activation, remote activation service, or scoped prefix support in this story.
- Files changed: `tasks/prd-ontology-registry-activation-evidence-persistence.md`, `tasks/prd-ontology-registry-activation-evidence-persistence.json`, `.ralph-tui/progress.md`.
- Verification: `pnpm --filter @qa-sdk/cli test -- ontology`; `pnpm --filter @qa-sdk/cli typecheck`; `pnpm --filter @qa-sdk/cli build`; `pnpm --filter operational-ontology test -- programming-artifacts`; `pnpm --filter operational-ontology typecheck`; `pnpm --filter registry-service test -- ontology`; `pnpm --filter registry-service typecheck`; `node packages/cli/dist/index.js def validate`.
- **Learnings:**
  - `ArtifactRegistryPromptArtifactContextProvider` resolves records generically by artifact ref/output path, but `quality-status` is special-cased for governance closure, freshness, ledger, and prompt quality behavior.
  - Reusing `quality-status` for activation proof would make lifecycle evidence look like gate/audit evidence; a new `activation-evidence` kind keeps provider behavior explicit without changing the provider in this story.
  - The existing `programming_artifact_kind` capacity remains 16 after adding a sixth value because `nextPowerOf2(6 * 2) = 16`.
---
