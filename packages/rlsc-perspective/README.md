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
    console.log(event.selection?.xpath);
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
- `boundary`
- `componentId`
- `qaAddress`
- `role`

Hover highlights the active layer. Click selects a layer and exposes selection details through `onSelect`.

Use `boundary` when the viewer is being used to inspect the context/component boundary currently under analysis. Boundary grouping reads `node.boundary` or `data-boundary` from documents collected by `@qa-sdk/rlsc-analysis/browser`.

## Copy Workflow

Copy defaults to the plain preferred identifier:

```txt
componentId > qaAddress > cssSelector > nodeId
```

Use `copyFormat: "xpath"` when the consumer wants copy events and keyboard copy to return the selected DOM path. Use `copyFormat: "json"` when the consumer needs the full selection payload, including issue details.

```ts
const viewer = createPerspectiveViewer(container, doc, {
  copyFormat: 'xpath',
  onCopy(event) {
    console.log(event.text);
  },
});
```

Selection payloads expose the identifier and geometry needed for debugging:

- `selection.identifier`
- `selection.preferredIdentifier`
- `selection.xpath`
- `selection.cssSelector`
- `selection.boundary`
- `selection.debugLabel`
- `selection.rect`
- `selection.issues`

When `@qa-sdk/rlsc-analysis/browser` supplies `node.identifier.xpath`, the viewer uses that core XPath. It only falls back to local tree-derived XPath for older documents.

## Debug Issues

The viewer can mark:

- containment leaks from `overflowIssues`
- text overflow from `textOccupancies`
- custom issues through `issues`

Issue data is attached to the selected layer so a consumer can feed precise debugging context into reports, tests, or prompts.

## Host CSS Isolation

Viewer nodes are real DOM buttons so they can receive focus, clicks, and clipboard keyboard events. The renderer explicitly resets button sizing with `min-width: 0`, `min-height: 0`, and `appearance: none` so application-level `button` styles do not distort layer geometry.

This matters for small nodes such as absolutely positioned badges. The layer's `width` and `height` are derived from `RLSCNode.rect`; host UI styles should not change that ratio.
