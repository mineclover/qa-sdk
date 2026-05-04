# @qa-sdk/rlsc-analysis

Screen analysis package for RLSC. It owns the screen document model, metadata helpers, DOM collection, layout analysis, identifier extraction, and issue detection.

This package does not depend on Three.js or perspective rendering.

## Metadata

Use metadata helpers when application code can mark component boundaries before collection.

```ts
import { createMetadataAttributes, annotateElement } from "@qa-sdk/rlsc-analysis";

const attrs = createMetadataAttributes({
  componentId: "CheckoutForm.SubmitButton",
  qaAddress: "checkout:form:submit",
  debugLabel: "Submit order",
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
import { analyzeAreas, detectAreaOverflow } from "@qa-sdk/rlsc-analysis";

const result = analyzeAreas(doc, { textOccupancies });
const containmentLeaks = detectAreaOverflow(doc);
```

The preferred identifier order is:

```txt
componentId > qaAddress > cssSelector > nodeId
```

## Browser Collection

Browser-only APIs are exported from `@qa-sdk/rlsc-analysis/browser`.

```ts
import { collectLayoutWithText } from "@qa-sdk/rlsc-analysis/browser";

const { doc, textPrepared } = collectLayoutWithText(document.body, {
  addressAttribute: "data-qa-address",
});
```

Keep pure analysis imports separate from browser collection imports when building non-browser tooling.
