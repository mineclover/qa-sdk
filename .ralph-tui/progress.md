# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

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
