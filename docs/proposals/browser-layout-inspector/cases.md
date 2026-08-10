# Browser Layout Inspector — Cases

```yaml bdd
bdd_contracts:
  - id: browser-layout-inspector.css-provenance.query.v1
    owner_system: browser-layout-inspector
    contract_kind: query-projection
    mode: read
    given:
      predicates: [target-element-is-in-a-browser-document, stylesheet-cssom-is-readable]
      fixtures: [matching-selector-fixture]
    when:
      operation: browser-layout-inspector.collectCssInfluences
    then:
      returns:
        matched_selectors: individual-selector-units
        inline_style: separate-source-unit
      invariants: [comma-separated-selectors-are-split-safely, inaccessible-cssom-is-reported-not-bypassed]

  - id: browser-layout-inspector.computed-style.query.v1
    owner_system: browser-layout-inspector
    contract_kind: query-projection
    mode: read
    given:
      predicates: [target-element-is-rendered]
      fixtures: [computed-style-fixture]
    when:
      operation: browser-layout-inspector.extractComputedStyle
    then:
      returns:
        properties: final-computed-values-only
      invariants: [property-allow-list-is-preserved]

  - id: browser-layout-inspector.geometry.query.v1
    owner_system: browser-layout-inspector
    contract_kind: query-projection
    mode: read
    given:
      predicates: [target-and-reference-have-dom-rects]
      fixtures: [positioned-element-fixture]
    when:
      operation: browser-layout-inspector.extractElementMetrics-and-extractPosition
    then:
      returns:
        viewport_and_document_rects: css-pixels
        relative_edge_gaps: signed-css-pixels
      invariants: [document-position-includes-scroll-offset, negative-gap-means-overlap]

  - id: browser-layout-inspector.extension.page-tools.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: interactive-session
    mode: write
    given:
      predicates: [content-script-is-injected-into-active-tab, target-elements-are-rendered]
      fixtures: [positioned-element-fixture]
    when:
      operation: select-element-or-measure-two-elements-or-mutate-selected-inline-style
    then:
      returns:
        selected_snapshot: css-provenance-final-style-and-geometry
        measurement: anchor-target-signed-relative-position
      effects: [page-overlay-shows-selection-or-measurement, selected-inline-style-updates-immediately, side-panel-receives-state-change]
      invariants: [picker-click-is-captured-only-while-picker-is-active, restore-reverts-only-extension-recorded-inline-properties, state-is-tab-local-and-not-persisted]

  - id: browser-layout-inspector.extension.side-panel.session.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [extension-action-is-clicked, active-tab-is-inspectable, side-panel-api-is-available]
      fixtures: [mv3-manifest-fixture]
    when:
      operation: browser-layout-inspector.side-panel.get-state
    then:
      returns:
        panel_surface: persistent-side-panel
        state: current-tab-page-tool-state
      invariants: [action-opens-side-panel-not-popup, side-panel-keeps-open-during-page-picking, no-persistent-host-permission-is-added]

  - id: browser-layout-inspector.extension.ruler.measurement.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: interactive-session
    mode: write
    given:
      predicates: [content-script-is-injected-into-active-tab, ruler-mode-is-active]
      fixtures: [viewport-pointer-fixture]
    when:
      operation: browser-layout-inspector.drag-ruler
    then:
      returns:
        ruler: start-end-width-height-and-diagonal-css-px
      effects: [page-overlay-shows-free-drag-ruler]
      invariants: [measurement-is-independent-of-dom-element-selection, pointer-events-are-captured-only-while-ruler-is-active, release-finishes-ruler-without-clicking-page]

  - id: browser-layout-inspector.extension.css-output.query.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [selected-element-has-computed-style-snapshot, css-source-candidates-are-available]
      fixtures: [positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.formatInspectionAsCss
    then:
      returns:
        css: copyable-computed-rule-followed-by-labelled-source-candidates
      invariants: [computed-final-values-are-not-presented-as-cascade-provenance, grid-and-flex-layout-properties-are-included, no-json-dump-is-required-for-side-panel-output]

  - id: browser-layout-inspector.extension.json-exchange.query.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [current-tab-page-tool-state-is-available]
      fixtures: [positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.formatLayoutExchangeJson
    then:
      returns:
        exchange: schema-version-export-time-page-environment-and-current-measurement-state
      invariants: [schema-version-is-browser-layout-inspector.exchange.v1, css-remains-default-side-panel-output, json-is-created-only-by-explicit-copy-or-download, exchange-has-no-extension-runtime-internals]

  - id: browser-layout-inspector.extension.ruler.guides.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: interactive-session
    mode: write
    given:
      predicates: [completed-ruler-exists, optional-8px-snap-is-configured]
      fixtures: [viewport-pointer-fixture]
    when:
      operation: browser-layout-inspector.pin-ruler-guides
    then:
      returns:
        guides: unique-horizontal-and-vertical-viewport-coordinates
      effects: [dashed-guides-remain-visible-through-scroll-and-ruler-restarts]
      invariants: [snap-is-opt-in, angle-is-derived-from-ruler-start-and-end, clear-removes-only-extension-guides, guides-are-tab-session-only]

  - id: browser-layout-inspector.extension.capture-viewport.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [extension-action-granted-active-tab, active-tab-is-visible]
      fixtures: [active-tab-fixture]
    when:
      operation: browser-layout-inspector.capture-visible-tab
    then:
      returns:
        png: current-viewport-data-url
      invariants: [capture-is-limited-to-visible-viewport, no-persistent-host-permission-is-required, output-includes-current-page-overlay]

test_units:
  - id: TU-browser-layout-inspector-css-provenance
    contract: browser-layout-inspector.css-provenance.query.v1
    level: unit
    given_fixture: matching-selector-fixture
    when: collectCssInfluences(target)
    assertions: [individual-selector-units, safe-comma-splitting, inline-source-unit]
    test_file: packages/browser-layout-inspector/test/inspector.test.ts
  - id: TU-browser-layout-inspector-computed-style
    contract: browser-layout-inspector.computed-style.query.v1
    level: unit
    given_fixture: computed-style-fixture
    when: extractComputedStyle(target, properties)
    assertions: [final-computed-values-only, property-allow-list-is-preserved]
    test_file: packages/browser-layout-inspector/test/inspector.test.ts
  - id: TU-browser-layout-inspector-geometry
    contract: browser-layout-inspector.geometry.query.v1
    level: unit
    given_fixture: positioned-element-fixture
    when: extractElementMetrics(target); extractPosition(target, reference)
    assertions: [viewport-and-document-rects, signed-relative-edge-gaps]
    test_file: packages/browser-layout-inspector/test/inspector.test.ts
  - id: TU-browser-layout-inspector-extension-page-tools
    contract: browser-layout-inspector.extension.page-tools.v1
    level: integration
    given_fixture: positioned-element-fixture
    when: start-picker; click-page; apply-style; hide; restore; measure
    assertions: [selected-snapshot, immediate-style-effect, exact-restore, two-element-signed-measurement]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-side-panel
    contract: browser-layout-inspector.extension.side-panel.session.v1
    level: integration
    given_fixture: mv3-manifest-fixture
    when: load-extension-service-worker; inspect-runtime-manifest
    assertions: [side-panel-default-path, no-action-popup, side-panel-permission, side-panel-api]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-ruler
    contract: browser-layout-inspector.extension.ruler.measurement.v1
    level: integration
    given_fixture: viewport-pointer-fixture
    when: start-ruler; pointer-down; drag; pointer-up
    assertions: [start-end-css-points, absolute-width-height, diagonal-distance, picker-finished]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-css-output
    contract: browser-layout-inspector.extension.css-output.query.v1
    level: integration
    given_fixture: positioned-grid-element-fixture
    when: formatInspectionAsCss(inspection)
    assertions: [computed-css-rule, grid-layout-property, labelled-author-source-candidate]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-json-exchange
    contract: browser-layout-inspector.extension.json-exchange.query.v1
    level: integration
    given_fixture: positioned-grid-element-fixture
    when: formatLayoutExchangeJson(current-page-tool-state)
    assertions: [schema-version, export-time, page-url-and-viewport-context, selected-inspection-and-current-tool-state]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-ruler-guides
    contract: browser-layout-inspector.extension.ruler.guides.v1
    level: integration
    given_fixture: viewport-pointer-fixture
    when: enable-snap; drag-ruler; pin-guides; clear-guides
    assertions: [8px-snapped-coordinates, angle, persistent-guide-nodes, guide-clear]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-capture-viewport
    contract: browser-layout-inspector.extension.capture-viewport.v1
    level: integration
    given_fixture: active-tab-fixture
    when: load-mv3-runtime
    assertions: [capture-visible-tab-api-available, active-tab-permission-present]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
    note: Playwright cannot reproduce extension-action activeTab grant; pixel capture remains a manual acceptance check.

implementation_units:
  - id: IU-browser-layout-inspector-css-influences
    contract: browser-layout-inspector.css-provenance.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector
    source_target: packages/browser-layout-inspector/src/css-influences.ts:collectCssInfluences
    inputs: [element, document-style-sheets]
    effects: [selector-source-projection]
    must_not_own: [css-mutation, cross-origin-access-bypass]
  - id: IU-browser-layout-inspector-computed-style
    contract: browser-layout-inspector.computed-style.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector
    source_target: packages/browser-layout-inspector/src/computed-style.ts:extractComputedStyle
    inputs: [element, optional-property-list]
    effects: [computed-style-snapshot]
    must_not_own: [cascade-winner-inference]
  - id: IU-browser-layout-inspector-geometry
    contract: browser-layout-inspector.geometry.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector
    source_target: packages/browser-layout-inspector/src/metrics.ts:extractElementMetrics
    inputs: [target, optional-reference]
    effects: [css-pixel-geometry-and-position]
    must_not_own: [layout-mutation, device-pixel-conversion]
  - id: IU-browser-layout-inspector-extension-page-tools
    contract: browser-layout-inspector.extension.page-tools.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController
    inputs: [page-pointer-events, selected-element, requested-inline-property]
    effects: [overlay-rendering, tab-local-inline-style-mutation, reversible-measurement-state]
    must_not_own: [stylesheet-persistence, host-permission-expansion, cross-origin-cssom-access]
  - id: IU-browser-layout-inspector-extension-side-panel
    contract: browser-layout-inspector.extension.side-panel.session.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/background.ts:chrome.sidePanel.setPanelBehavior
    inputs: [extension-action-click]
    effects: [open-side-panel-on-action, active-tab-state-surface]
    must_not_own: [popup-default-surface, persistent-host-permission]
  - id: IU-browser-layout-inspector-extension-ruler
    contract: browser-layout-inspector.extension.ruler.measurement.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.onMouseDown
    inputs: [viewport-pointer-down-move-up]
    effects: [free-drag-ruler-overlay, viewport-css-pixel-measurement]
    must_not_own: [dom-element-selection, stylesheet-mutation, persistent-guide-storage]
  - id: IU-browser-layout-inspector-extension-css-output
    contract: browser-layout-inspector.extension.css-output.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/css-output.ts:formatInspectionAsCss
    inputs: [computed-style-snapshot, css-influence-candidates]
    effects: [copyable-css-text]
    must_not_own: [cascade-winner-inference, css-mutation, json-only-ui-output]
  - id: IU-browser-layout-inspector-extension-json-exchange
    contract: browser-layout-inspector.extension.json-exchange.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/json-output.ts:formatLayoutExchangeJson
    inputs: [current-page-tool-state, page-measurement-environment]
    effects: [versioned-json-exchange-artifact]
    must_not_own: [automatic-export, remote-upload, extension-runtime-state]
  - id: IU-browser-layout-inspector-extension-ruler-guides
    contract: browser-layout-inspector.extension.ruler.guides.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.pinRulerGuides
    inputs: [completed-ruler, snap-setting]
    effects: [tab-local-guide-coordinates, fixed-overlay-lines, angle-projection]
    must_not_own: [page-css-mutation, persistent-cross-tab-storage]
  - id: IU-browser-layout-inspector-extension-capture-viewport
    contract: browser-layout-inspector.extension.capture-viewport.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/background.ts:chrome.tabs.captureVisibleTab
    inputs: [active-tab-user-grant]
    effects: [viewport-png-data-url]
    must_not_own: [full-page-stitching, persistent-host-permission, automatic-upload]
```
