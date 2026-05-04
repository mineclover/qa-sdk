# @qa-sdk/rlsc-perspective

Interactive 3D perspective viewer for RLSC screen documents.

This package renders an existing `RLSCDocument`. It does not scan the DOM, annotate DOM elements, or run layout analysis. Callers pass document and issue data from `@qa-sdk/rlsc-analysis`.

## Usage

```ts
import { createPerspectiveViewer } from "@qa-sdk/rlsc-perspective";

const viewer = createPerspectiveViewer(container, doc, {
  renderer: "auto",
  groupBy: "componentId",
  overflowIssues: analysis.overflowIssues,
  textOccupancies,
  onSelect(event) {
    console.log(event.selection?.preferredIdentifier);
  },
});

viewer.update(nextDoc);
viewer.clearSelection();
viewer.dispose();
```

## Renderer

The public renderer option is:

```ts
renderer: "auto" | "webgl" | "canvas"
```

`auto` uses WebGL when available and falls back to canvas in headless or GPU-disabled environments.

## Grouping

The v1 grouping presets are:

- `dom-node`
- `componentId`
- `qaAddress`
- `role`

Hover highlights the active layer. Click selects a layer and exposes selection details through `onSelect`.

## Copy Workflow

Copy defaults to the plain preferred identifier:

```txt
componentId > qaAddress > cssSelector > nodeId
```

Use `copyFormat: "json"` when the consumer needs the full selection payload, including issue details.

## Debug Issues

The viewer can mark:

- containment leaks from `overflowIssues`
- text overflow from `textOccupancies`
- custom issues through `issues`

Issue data is attached to the selected layer so a consumer can feed precise debugging context into reports, tests, or prompts.
