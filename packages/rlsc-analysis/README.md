# @qa-sdk/rlsc-analysis

Screen analysis package for RLSC. It owns the screen document model, metadata helpers, DOM collection, layout analysis, identifier extraction, and issue detection.

This package does not depend on Three.js or perspective rendering.

## Metadata

Use metadata helpers when application code can mark component boundaries before collection.

```ts
import { createMetadataAttributes, annotateElement } from '@qa-sdk/rlsc-analysis';

const attrs = createMetadataAttributes({
  componentId: 'CheckoutForm.SubmitButton',
  qaAddress: 'checkout:form:submit',
  debugLabel: 'Submit order',
});

annotateElement(buttonElement, attrs);
```

Standard attributes:

- `data-qa-address`
- `data-component-id`
- `data-debug-label`
- `data-boundary`

## Analysis-Only Usage

```ts
import { analyzeAreas, createNodeIndex, detectAreaOverflow } from '@qa-sdk/rlsc-analysis';

const result = analyzeAreas(doc, { textOccupancies });
const containmentLeaks = detectAreaOverflow(doc);
const index = createNodeIndex(doc);
const selected = index.findByXPath('/article[1]/section[3]/article[4]/span[1]');
```

The preferred identifier order is:

```txt
componentId > qaAddress > cssSelector > nodeId
```

## Browser Collection

Browser-only APIs are exported from `@qa-sdk/rlsc-analysis/browser`.

```ts
import { collectLayoutWithText, scanScreen } from '@qa-sdk/rlsc-analysis/browser';

const { doc, textPrepared } = collectLayoutWithText(document.body, {
  addressAttribute: 'data-qa-address',
});

const result = scanScreen(document.body, {
  includeText: true,
  collect: { addressAttribute: 'data-qa-address' },
});

const node = result.byXPath('/body[1]/main[1]/button[1]');
```

Keep pure analysis imports separate from browser collection imports when building non-browser tooling.

Browser collection records stable re-identification metadata when available:

- `identifier.componentId`
- `identifier.qaAddress`
- `identifier.cssSelector`
- `identifier.xpath`
- `debugLabel`
- `boundary`
