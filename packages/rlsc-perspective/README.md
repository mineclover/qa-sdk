# @qa-sdk/rlsc-perspective

Interactive 3D perspective viewer for RLSC screen documents.

This package renders an existing `RLSCDocument`. It does not scan the DOM, annotate DOM elements, or run layout analysis. Callers pass document and issue data from `@qa-sdk/rlsc-analysis`.

## Usage

```ts
import { createPerspectiveViewer } from '@qa-sdk/rlsc-perspective';

const viewer = createPerspectiveViewer(container, doc, {
  renderer: 'auto',
  groupBy: 'componentId',
  projectionMode: 'orthographic',
  overflowIssues: analysis.overflowIssues,
  textOccupancies,
  onSelect(event) {
    console.log(event.selection?.preferredIdentifier);
  },
});

viewer.update(nextDoc);
viewer.setView('top');
viewer.setProjectionMode('perspective');
viewer.clearSelection();
viewer.dispose();
```

## Renderer

The public renderer option is kept for API compatibility:

```ts
renderer: 'auto' | 'webgl' | 'canvas';
```

The current implementation renders with CSS 3D DOM elements. This keeps each screen node inspectable as a real DOM element while preserving 3D depth through `translateZ(...)`.

## Projection

The viewer supports two projection modes:

- `orthographic` — default. Keeps 3D depth without perspective distortion, so top view preserves x/y alignment across stacked layers.
- `perspective` — enables CSS perspective for a stronger spatial depth cue.

Use `setProjectionMode()` to switch modes without recreating the viewer.

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
