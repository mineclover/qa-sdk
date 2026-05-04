[PRD]
# PRD: RLSC Screen Analysis and Perspective Packages

## Overview

Split the current RLSC screen inspection work into two independent packages while preserving the existing `packages/rlsc` package for backwards compatibility.

`@qa-sdk/rlsc-analysis` owns DOM metadata annotation, DOM metadata collection, screen document creation, layout analysis, identifier extraction, and issue detection. `@qa-sdk/rlsc-perspective` owns interactive 3D perspective visualization of collected screen structure, including hover/select, component grouping, identifier copy, and visual debug feedback. The perspective package consumes `RLSCDocument` and issue data; it does not scan the DOM directly.

`packages/rlsc-demo` remains as an executable browser demo that proves the two packages work together end to end.

## Goals

- Create `@qa-sdk/rlsc-analysis` as the analysis package for DOM metadata, screen scanning, `RLSCDocument`, and issue detection.
- Create `@qa-sdk/rlsc-perspective` as the visualization package for 3D perspective inspection.
- Keep existing `packages/rlsc` working as a compatibility package.
- Make `rlsc-demo` consume the new packages instead of owning reusable perspective logic.
- Support component-level grouping using metadata such as `data-qa-address` and `data-component-id`.
- Provide metadata annotation helpers so applications can consistently write `data-qa-address`, `data-component-id`, and debug labels into DOM elements.
- Allow users to hover/select a visual layer, inspect its identifier, and copy it for debugging workflows.
- Surface containment leak and text overflow issues visually in the perspective view.

## Decisions

- `RLSCDocument` ownership: `@qa-sdk/rlsc-analysis` is the source of truth. Existing `rlsc` may re-export it for compatibility.
- Perspective fallback: public API uses `renderer: "auto" | "webgl" | "canvas"` rather than separate fallback APIs.
- Copy format: default is plain identifier; optional JSON copy format may be supported.
- Preferred identifier order: `componentId`, then `qaAddress`, then `cssSelector`, then `nodeId`.
- Grouping presets for v1: `dom-node`, `componentId`, `qaAddress`, and `role`.
- Three.js ownership: `@qa-sdk/rlsc-perspective` owns `three` as a normal dependency.
- DOM scanning boundary: `@qa-sdk/rlsc-perspective` never scans DOM directly; callers pass `RLSCDocument` and optional issue data from `@qa-sdk/rlsc-analysis`.
- Browser verification: UI stories require local dev server verification with screenshot or pixel checks.

## Quality Gates

These commands must pass for every user story:

- `pnpm --filter @qa-sdk/rlsc-analysis build` - Build analysis package
- `pnpm --filter @qa-sdk/rlsc-analysis test` - Test analysis package
- `pnpm --filter @qa-sdk/rlsc-perspective build` - Build perspective package
- `pnpm --filter @qa-sdk/rlsc-demo build` - Build demo app

For compatibility stories, also include:

- `pnpm --filter rlsc build` - Build existing compatibility package
- `pnpm --filter rlsc test` - Test existing compatibility package

For UI stories, also include:

- Start local dev server for `@qa-sdk/rlsc-demo`
- Verify in browser with screenshot or pixel check
- Confirm hover/select/copy interactions work in the browser

## User Stories

### US-001: Create Analysis Package Skeleton

**Description:** As a developer, I want a dedicated `@qa-sdk/rlsc-analysis` package so that screen scanning and layout analysis can be used independently of visualization.

**Acceptance Criteria:**

- [ ] Add `packages/rlsc-analysis/package.json`
- [ ] Add TypeScript and tsup configuration consistent with existing package patterns
- [ ] Export a public package entry point from `packages/rlsc-analysis/src/index.ts`
- [ ] Package builds independently
- [ ] Package does not depend on Three.js or visual rendering libraries

### US-002: Move Core Types and Analysis APIs

**Description:** As a developer, I want `@qa-sdk/rlsc-analysis` to own the screen document model and analysis APIs so that analysis has a single source of truth.

**Acceptance Criteria:**

- [ ] `@qa-sdk/rlsc-analysis` exports `RLSCDocument`, `RLSCNode`, `LayoutRect`, and related analysis types
- [ ] `@qa-sdk/rlsc-analysis` exports `analyzeAreas`, `createAreaDocument`, and `detectAreaOverflow`
- [ ] Existing unit tests for area analysis are available under the analysis package
- [ ] Analysis APIs can be imported without importing browser DOM collector or Three.js

### US-003: Add Metadata Annotation Helpers

**Description:** As an application developer, I want helpers for writing screen metadata into DOM elements so that components can be consistently identified before collection.

**Acceptance Criteria:**

- [ ] Export metadata attribute constants for `data-qa-address`, `data-component-id`, `data-debug-label`, and `data-boundary`
- [ ] Export `createMetadataAttributes()` for frameworks or template code that need plain attribute objects
- [ ] Export `annotateElement()` for applying metadata to an existing DOM element
- [ ] Export a `ScreenMetadata` type
- [ ] Annotation helpers do not require DOM collection or perspective viewer imports

### US-004: Add Metadata and Identifier Extraction

**Description:** As a debugging user, I want DOM elements to expose stable identifiers so that I can identify and copy the component or screen region I selected.

**Acceptance Criteria:**

- [ ] Support `data-qa-address`
- [ ] Support `data-component-id`
- [ ] Produce fallback CSS selector when metadata is missing
- [ ] Export a `ScreenIdentifier` type
- [ ] Preferred identifier order is `componentId`, then `qaAddress`, then `cssSelector`, then `nodeId`

### US-005: Move Browser Collection APIs

**Description:** As a developer, I want the analysis package to collect browser DOM metadata so that it can produce screen documents from live pages.

**Acceptance Criteria:**

- [ ] `@qa-sdk/rlsc-analysis/browser` exports DOM collection APIs
- [ ] Browser collector preserves `data-qa-address` and `data-component-id`
- [ ] Browser collector attaches generated identifiers to collected nodes
- [ ] Monitor APIs continue to support text-aware DOM change tracking
- [ ] Browser APIs remain separate from pure analysis imports

### US-006: Create Perspective Package Skeleton

**Description:** As a developer, I want a dedicated `@qa-sdk/rlsc-perspective` package so that 3D screen visualization can be reused outside the demo.

**Acceptance Criteria:**

- [ ] Add `packages/rlsc-perspective/package.json`
- [ ] Add TypeScript and tsup configuration consistent with existing package patterns
- [ ] Add `three` as a normal dependency
- [ ] Export `createPerspectiveViewer` from the package entry point
- [ ] Package builds independently
- [ ] Package public API accepts `RLSCDocument` and optional issue data as inputs
- [ ] Package does not export DOM scanner or collector APIs

### US-007: Move Perspective Viewer Implementation

**Description:** As a developer, I want the reusable 3D viewer to live in `@qa-sdk/rlsc-perspective` so that demo code does not own library functionality.

**Acceptance Criteria:**

- [ ] Migrate reusable logic from `packages/rlsc-demo/src/layer-scene.ts`
- [ ] Viewer accepts `RLSCDocument` from `@qa-sdk/rlsc-analysis`
- [ ] Viewer exposes `update(doc)` and `dispose()` lifecycle methods
- [ ] Viewer supports `renderer: "auto" | "webgl" | "canvas"`
- [ ] Canvas renderer is used when WebGL is unavailable or explicitly selected
- [ ] Viewer implementation does not call `querySelector`, `getBoundingClientRect`, or DOM collector APIs for screen scanning

### US-008: Add Grouping, Hover, and Selection Model

**Description:** As a debugging user, I want to choose the grouping level and select visual layers so that I can inspect the right component boundary.

**Acceptance Criteria:**

- [ ] Viewer supports `groupBy: "dom-node" | "componentId" | "qaAddress" | "role"`
- [ ] Hover highlights only the hovered layer
- [ ] Non-hovered layers visually recede while hover is active
- [ ] Click selects a layer and keeps it selected
- [ ] Selection can be cleared
- [ ] Selection exposes node id, component id, qa address, role, text hint, and preferred identifier when available

### US-009: Add Copy and Debug Issue Visualization

**Description:** As a debugging user, I want to copy selected identifiers and see layout issues in context so that I can feed precise debugging information back into tools.

**Acceptance Criteria:**

- [ ] Perspective package exposes selected identifier data without requiring demo internals
- [ ] Copy format defaults to plain identifier
- [ ] Optional JSON copy payload can include identifier and issue details
- [ ] Viewer accepts containment leak issues from analysis results
- [ ] Viewer accepts text overflow issues when text analysis data is available
- [ ] Layers with issues are visually marked

### US-010: Preserve Existing RLSC Compatibility

**Description:** As an existing user, I want `rlsc` imports to keep working so that this split does not break current consumers.

**Acceptance Criteria:**

- [ ] Existing `rlsc` import path continues to work
- [ ] Existing `rlsc/analysis`, `rlsc/browser`, and `rlsc/rendering` exports continue to work
- [ ] `rlsc` re-exports selected APIs from new packages where appropriate
- [ ] Existing `pnpm --filter rlsc test` remains passing
- [ ] Existing README documents the compatibility position

### US-011: Migrate RLSC Demo to New Packages

**Description:** As a maintainer, I want `rlsc-demo` to consume the new packages so that the demo proves the package split works.

**Acceptance Criteria:**

- [ ] Demo imports pure analysis APIs from `@qa-sdk/rlsc-analysis`
- [ ] Demo imports browser collection APIs from `@qa-sdk/rlsc-analysis/browser`
- [ ] Demo imports perspective viewer APIs from `@qa-sdk/rlsc-perspective`
- [ ] Demo no longer owns reusable perspective renderer logic
- [ ] Demo still supports Run, Mutate DOM, and Start Monitor
- [ ] Demo exposes grouping selection UI
- [ ] Demo shows selected identifier and copy button
- [ ] Demo shows containment leak issue details when selecting affected layers

### US-012: Document Package Boundaries and Usage

**Description:** As a developer, I want clear package documentation so that I can use analysis and visualization independently.

**Acceptance Criteria:**

- [ ] `packages/rlsc-analysis/README.md` explains collection, metadata, identifiers, and analysis
- [ ] `packages/rlsc-perspective/README.md` explains viewer setup, lifecycle, grouping, hover/select, and copy workflow
- [ ] Existing `packages/rlsc/README.md` explains compatibility exports
- [ ] Example code shows analysis-only usage
- [ ] Example code shows analysis plus perspective visualization usage

## Functional Requirements

- FR-1: The system must provide a standalone analysis package named `@qa-sdk/rlsc-analysis`.
- FR-2: The system must provide a standalone perspective visualization package named `@qa-sdk/rlsc-perspective`.
- FR-3: The analysis package must collect DOM layout structure into an `RLSCDocument`-compatible model.
- FR-4: The analysis package must own `RLSCDocument` and related screen analysis types.
- FR-5: The analysis package must support `data-qa-address` and `data-component-id`.
- FR-6: The analysis package must produce stable identifiers for inspected nodes.
- FR-7: The analysis package must detect when a child visual area exceeds its parent visual area.
- FR-8: The analysis package must provide helpers for writing screen metadata into DOM elements.
- FR-9: The perspective package must render screen structure as an interactive 3D hierarchy.
- FR-10: The perspective package must support WebGL and canvas renderers through a `renderer` option.
- FR-11: The perspective package must support hover highlighting.
- FR-12: The perspective package must support click selection.
- FR-13: The perspective package must expose selected identifiers for copy workflows.
- FR-14: The perspective package must visually mark debug issues supplied by analysis.
- FR-15: The perspective package must not scan the DOM directly.
- FR-16: `rlsc-demo` must demonstrate the full workflow from DOM scan to 3D selection and identifier copy.
- FR-17: Existing `rlsc` consumers must not be broken by the split.

## Non-Goals

- Do not remove or deprecate `packages/rlsc` in this phase.
- Do not publish separate external git repositories in this phase.
- Do not build a browser extension in this phase.
- Do not build a full issue-reporting backend.
- Do not require React, Vue, or another UI framework for the viewer package.
- Do not make the analysis package depend on Three.js.
- Do not make the perspective package own DOM scanning, metadata annotation, or layout analysis.
- Do not solve cross-origin iframe inspection in this phase.

## Technical Considerations

- `@qa-sdk/rlsc-analysis` should be free of visualization dependencies.
- `@qa-sdk/rlsc-perspective` should own `three` as a normal dependency.
- `@qa-sdk/rlsc-perspective` should depend only on analysis package types and issue data, not on analysis package browser collectors.
- `rlsc-demo` should keep using Vite.
- Existing `packages/rlsc-demo/src/layer-scene.ts` should be migrated into `packages/rlsc-perspective/src`.
- Existing `detectAreaOverflow()` should become part of the analysis package API.
- Package exports should use subpath-safe ESM/CJS/type declarations consistent with current `rlsc` package patterns.
- `rlsc` can remain as a compatibility package and optionally re-export new package APIs after the split is stable.
- Browser verification should include visual checks for hover/select and issue highlighting.

## Success Metrics

- Developers can use analysis without installing or importing the perspective viewer.
- Developers can use perspective visualization with an existing `RLSCDocument` without granting the viewer DOM scanning responsibility.
- Demo allows selecting a rendered component and copying its identifier.
- Containment leaks are visible in both analysis output and 3D perspective view.
- Existing `rlsc` build and tests continue passing.
- New package quality gates pass reliably.
[/PRD]
