# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

* Standardizing on create*HandlerRegistry(catalog?: Catalog) allows command groups to access shared state while remaining physically separate from index.ts.

---


## 2026-04-06 - US-001
- Refactored motion, spec, ingest, gate, and query command groups to use group-file authority.
- Moved runSpec handlers and dependencies from index.ts to commands/spec.ts.
- Removed duplicate metadata (descriptors, specs, trees, registries) from index.ts.
- Updated index.ts USAGE and TREE_COMMAND_GROUPS to use imported group metadata.
- Cleaned up unused imports in index.ts.
- Files changed:
  - packages/cli/src/index.ts
  - packages/cli/src/commands/spec.ts
  - packages/cli/src/command-groups/spec.commands.ts
- **Learnings:**
  - Group files should be the SSOT for command metadata to avoid ReferenceErrors when removing direct imports.
  - Circular dependencies can be avoided by moving handler wrappers from index.ts to command implementation files.
---

## 2026-04-06 - US-001 (Continued)
- Completed group-file authority for motion, spec, ingest, gate, and query groups by adding missing options and args to their command descriptors.
- Verified that help output (e.g., qa-sdk spec list --help) now correctly displays detailed options and arguments.
- Restored specific usage strings in group files to maintain compatibility with USAGE contract tests.
- Files changed:
  - packages/cli/src/command-groups/spec.commands.ts
  - packages/cli/src/command-groups/ingest.commands.ts
  - packages/cli/src/command-groups/gate.commands.ts
  - packages/cli/src/command-groups/query.commands.ts
  - packages/cli/src/command-groups/motion.commands.ts
- **Learnings:**
  - Runtime help data (args/options) must be explicitly defined in CommandDescriptors for generateHelp to include them.
  - USAGE contract tests often rely on exact strings in the top-level help; keep usage fields consistent with these expectations.
---

## 2026-04-06 - US-002
- Finished group-file authority for root, scan, git, prefix, facet, test, and catalog command groups.
- Moved root command handlers and descriptors to packages/cli/src/command-groups/root.commands.ts.
- Updated scan and git command groups with missing options in their descriptors.
- Removed duplicate authored metadata (descriptors, specs, trees) from index.ts for all targeted groups.
- Refactored index.ts dispatchers to use imported handler registries.
- Cleaned up unused imports and redundant run* functions in index.ts.
- Files changed:
  - packages/cli/src/index.ts
  - packages/cli/src/command-groups/root.commands.ts
  - packages/cli/src/command-groups/scan.commands.ts
  - packages/cli/src/command-groups/git.commands.ts
- **Learnings:**
  - Group files should include detailed options in CommandDescriptors to support automated help generation.
  - Type definitions like RestCommandHandler should be centrally imported to avoid duplicate declarations and ReferenceErrors.
---

## 2026-04-06 - US-003
- Made dkg command group physically authoritative.
- Moved DKG_GROUP_HANDLER_REGISTRY and related handlers from index.ts to packages/cli/src/command-groups/dkg.commands.ts.
- Refactored index.ts to import createDkgHandlerRegistry and use it for command dispatching.
- Removed duplicate DKG-related imports, descriptors, and helper functions (e.g., parsePage) from index.ts.
- Verified that dkg subtree help (e.g., dkg decisions --help, dkg transition --help) works correctly.
- **Learnings:**
  - Standardizing on create*HandlerRegistry(catalog?: Catalog) allows command groups to access shared state while remaining physically separate from index.ts.
  - Centralizing large command groups like dkg significantly reduces index.ts complexity and duplication.
---

## 2026-04-06 - US-004
- Refactored index.ts to become an assembly entry by migrating remaining command data to group files.
- Created packages/cli/src/command-groups/obs.commands.ts and packages/cli/src/command-groups/def.commands.ts.
- Migrated Obsidian and Definition Catalog command metadata and handler registries to their respective group files.
- Moved 'spec drift' command from index.ts to packages/cli/src/command-groups/spec.commands.ts.
- Removed remaining authored metadata (descriptors, specs, trees) and dispatch logic from index.ts.
- Verified that all command groups (service, flow, quality, review, dkg, etc.) use handler registries or delegated routers.
- Files changed:
  - packages/cli/src/index.ts
  - packages/cli/src/command-groups/obs.commands.ts
  - packages/cli/src/command-groups/def.commands.ts
  - packages/cli/src/command-groups/spec.commands.ts
- **Learnings:**
  - Using a Proxy for handler registries (e.g., for 'def' commands) maintains pattern consistency even when delegating to a complex sub-router like cliDef.
  - Consolidating special argument handling (like --vault in obs) into group-level wrappers keeps index.ts focused on high-level wiring.
---
