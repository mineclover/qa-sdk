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

  - id: browser-layout-inspector.extension.comparison-dimensions.render.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [comparison-a-and-b-have-rendered-dom-rects]
      fixtures: [contained-positioned-element-fixture]
    when:
      operation: browser-layout-inspector.render-comparison-corner-dimensions
    then:
      returns:
        overlay_dimensions: left-right-top-bottom-corresponding-corner-signed-css-pixels
      effects: [four-viewport-fixed-dimension-lines-are-rendered-around-comparison]
      invariants: [containment-and-overlap-remain-signed-not-absolute, lines-are-removed-when-a-or-b-is-cleared, dimension-lines-do-not-capture-page-pointers]

  - id: browser-layout-inspector.extension.comparison-gap-and-copy.write.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: state-transition
    mode: write
    given:
      predicates: [comparison-a-and-b-have-rendered-dom-rects, comparison-has-a-disjoint-axis-and-an-overlapping-projection, measurement-label-is-clicked]
      fixtures: [horizontal-gap-positioned-element-fixture]
    when:
      operation: browser-layout-inspector.render-gap-and-copy-measurement-label
    then:
      returns:
        gap_dimension: positive-edge-to-edge-css-pixels
        clipboard: exact-clicked-label-text
      effects: [gap-line-is-rendered-only-for-a-real-gap, clicked-label-copies-and-confirms]
      invariants: [overlap-or-containment-does-not-create-a-gap-line, only-labels-accept-pointer-events, clipboard-fallback-does-not-mutate-page-layout]

  - id: browser-layout-inspector.extension.comparison-label-drag.write.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: state-transition
    mode: write
    given:
      predicates: [comparison-dimension-label-is-visible, label-is-hovered-or-pointer-dragged]
      fixtures: [contained-positioned-element-fixture]
    when:
      operation: browser-layout-inspector.hover-or-drag-measurement-label
    then:
      returns:
        label: viewport-relative-offset-from-its-dimension-line
      effects: [hover-uses-distinct-visual-emphasis, drag-repositions-label-without-moving-line, click-without-drag-copies-label]
      invariants: [drag-does-not-copy, label-offset-survives-overlay-refresh-for-the-tab-session, non-label-overlay-remains-pointer-transparent]

  - id: browser-layout-inspector.extension.comparison-zero-and-drag-highlight.render.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [comparison-corresponding-corner-offset-is-zero-or-label-is-being-dragged]
      fixtures: [same-top-and-bottom-fixture, contained-positioned-element-fixture]
    when:
      operation: browser-layout-inspector.render-comparison-dimension-state
    then:
      returns:
        dimensions: non-zero-corresponding-corners-only
        drag_state: active-dimension-line-and-end-ticks-emphasized
      effects: [zero-value-dimension-and-label-are-omitted, dragging-label-emphasizes-matching-line]
      invariants: [zero-suppression-does-not-hide-nonzero-or-gap-dimensions, release-removes-drag-emphasis, drag-never-moves-measurement-line]

  - id: browser-layout-inspector.extension.work-item-selector.write.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: state-transition
    mode: write
    given:
      predicates: [normal-or-comparison-work-item-exists, selected-element-has-matched-css-or-stable-identity-selector]
      fixtures: [positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.set-work-item-selector
    then:
      returns:
        selector_candidates: matched-css-and-stable-identification-candidates-ranked-for-use
        selected_selector: current-work-item-display-and-copy-selector
      effects: [side-panel-work-item-label-and-comparison-summary-update-without-changing-underlying-element]
      invariants: [matched-unique-css-is-ranked-first, stable-unique-id-or-data-selector-precedes-nonunique-matched-css, unsupported-selector-is-rejected, selector-choice-is-tab-local]

  - id: browser-layout-inspector.extension.side-panel.workspace-panels.query.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: query-projection
    mode: read
    given:
      predicates: [side-panel-is-open, inspectable-document-content-script-is-injected]
      fixtures: [mv3-manifest-fixture, positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.get-workspace-overview
    then:
      returns:
        panels: [measurement-selection, css-inspector, dom-tree, page-style-export]
        dom_tree: bounded-page-dom-nodes-with-selectable-selectors
        page_styles: readable-author-css-and-inaccessible-cssom-diagnostics
      invariants: [extension-overlay-is-excluded-from-dom-tree, tree-selection-updates-normal-selection, page-style-extraction-does-not-bypass-cross-origin-cssom]

  - id: browser-layout-inspector.measurement-core.query.v1
    owner_system: browser-layout-inspector
    contract_kind: query-projection
    mode: read
    given:
      predicates: [two-css-pixel-rects-or-two-viewport-points-are-provided]
      fixtures: [deterministic-layout-rect-fixture]
    when:
      operation: browser-layout-inspector.measure-layout
    then:
      returns:
        comparison: signed-corner-deltas-and-positive-real-gaps
        ruler: viewport-width-height-distance-angle-and-four-guides
        tolerance_match: deterministic-css-pixel-pass-or-fail-result
      invariants: [browser-dom-is-not-required, overlap-and-containment-do-not-produce-gaps, guide-edges-replaceable-as-a-single-ruler-result]

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
      invariants: [action-opens-side-panel-not-popup, side-panel-keeps-open-during-page-picking, all-urls-host-permission-excludes-browser-protected-pages]

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

  - id: browser-layout-inspector.css-inspector.query.v1
    owner_system: browser-layout-inspector
    contract_kind: query-projection
    mode: read
    given:
      predicates: [target-element-is-rendered, stylesheet-cssom-is-readable]
      fixtures: [positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.inspectCssDeclarations
    then:
      returns:
        source_declarations: inline-and-matched-author-declarations-as-individual-rows
        computed_declarations: complete-sorted-final-browser-values
      invariants: [source-candidates-remain-distinct-from-final-computed-values, inaccessible-cssom-is-reported-not-bypassed, empty-inline-style-is-a-valid-editable-state]

  - id: browser-layout-inspector.extension.inline-declaration.write.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: state-transition
    mode: write
    given:
      predicates: [selected-element-exists, declaration-property-is-valid]
      fixtures: [positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.set-or-remove-inline-declaration
    then:
      returns:
        state: refreshed-css-inspector-with-current-inline-declarations
      effects: [selected-element-inline-style-is-updated, side-panel-receives-state-change]
      invariants: [only-selected-element-inline-style-is-mutated, remove-reveals-underlying-cascade, restore-reverts-only-extension-recorded-inline-properties, author-stylesheet-rules-are-read-only]

  - id: browser-layout-inspector.extension.inline-declaration.invalid-property.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: validation-failure
    mode: write
    given:
      predicates: [selected-element-exists, declaration-property-is-invalid]
      fixtures: [positioned-grid-element-fixture]
    when:
      operation: browser-layout-inspector.set-or-remove-inline-declaration
    then:
      returns:
        error: invalid-css-property-message
      invariants: [page-style-is-not-mutated, state-remains-readable]

  - id: browser-layout-inspector.extension.ruler.guides.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: interactive-session
    mode: write
    given:
      predicates: [completed-ruler-exists, optional-8px-snap-is-configured]
      fixtures: [viewport-pointer-fixture]
    when:
      operation: browser-layout-inspector.complete-ruler
    then:
      returns:
        guides: unique-horizontal-and-vertical-viewport-coordinates
      effects: [completed-ruler-automatically-replaces-four-fixed-guide-edges, clear-removes-guide-overlay-and-state]
      invariants: [snap-is-opt-in, angle-is-derived-from-ruler-start-and-end, guide-replacement-does-not-accumulate-prior-rulers, guides-are-tab-session-only]

  - id: browser-layout-inspector.extension.work-items.write.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: state-transition
    mode: write
    given:
      predicates: [normal-selection-and-or-comparison-and-or-ruler-exist-in-current-tab]
      fixtures: [positioned-element-fixture, viewport-pointer-fixture]
    when:
      operation: browser-layout-inspector.focus-or-clear-work-item
    then:
      returns:
        work_items: individually-addressable-normal-selection-comparison-a-comparison-b-and-ruler-box
        selected_snapshot: focus-target-for-css-inspector
      effects: [focused-item-is-marked-active, cleared-item-overlay-is-removed]
      invariants: [normal-selection-is-independent-from-comparison-b, clearing-a-also-clears-dependent-b, clearing-ruler-does-not-clear-element-selections, state-remains-tab-local]

  - id: browser-layout-inspector.extension.auto-select-hide.write.v1
    owner_system: browser-layout-inspector-extension
    contract_kind: state-transition
    mode: write
    given:
      predicates: [content-script-is-injected-into-active-tab, auto-select-picker-is-active, hovered-element-is-not-editable-control]
      fixtures: [positioned-element-fixture]
    when:
      operation: browser-layout-inspector.auto-select-then-delete-or-backspace
    then:
      returns:
        selected_snapshot: latest-hovered-element
      effects: [normal-selection-updates-on-hover, selected-element-gets-reversible-display-none-inline-declaration]
      invariants: [delete-and-backspace-are-captured-only-in-auto-select-mode, editable-controls-keep-native-delete-and-backspace-behavior, escape-exits-auto-select]

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
      invariants: [capture-is-limited-to-visible-viewport, all-urls-host-permission-excludes-browser-protected-pages, output-includes-current-page-overlay]

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
  - id: TU-browser-layout-inspector-extension-comparison-dimensions
    contract: browser-layout-inspector.extension.comparison-dimensions.render.v1
    level: integration
    given_fixture: contained-positioned-element-fixture
    when: select-measurement-a; select-measurement-b
    assertions: [four-corner-dimension-line-nodes, signed-containment-labels, pointer-events-none]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-comparison-gap-and-copy
    contract: browser-layout-inspector.extension.comparison-gap-and-copy.write.v1
    level: integration
    given_fixture: horizontal-gap-positioned-element-fixture
    when: select-measurement-a; select-measurement-b; click-dimension-label
    assertions: [horizontal-gap-node-only-when-projections-overlap, exact-positive-gap-label, clipboard-text-equals-clicked-label]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-comparison-label-drag
    contract: browser-layout-inspector.extension.comparison-label-drag.write.v1
    level: integration
    given_fixture: contained-positioned-element-fixture
    when: hover-label; pointer-down-move-up; click-label
    assertions: [hover-color-feedback, offset-transform-after-drag, click-copy-after-drag]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-comparison-zero-and-drag-highlight
    contract: browser-layout-inspector.extension.comparison-zero-and-drag-highlight.render.v1
    level: integration
    given_fixture: same-top-and-bottom-fixture-and-contained-positioned-element-fixture
    when: select-measurement-a; select-measurement-b; drag-label
    assertions: [zero-top-bottom-nodes-omitted, active-line-and-tick-color-during-drag, emphasis-clears-on-drop]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-work-item-selector
    contract: browser-layout-inspector.extension.work-item-selector.write.v1
    level: integration
    given_fixture: positioned-grid-element-fixture
    when: get-state; set-work-item-selector
    assertions: [ranked-matched-css-and-unique-id-candidates, selected-selector-state-and-visible-summary-update, element-identity-stays-unchanged]
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
  - id: TU-browser-layout-inspector-css-inspector
    contract: browser-layout-inspector.css-inspector.query.v1
    level: unit
    given_fixture: positioned-grid-element-fixture
    when: inspectCssDeclarations(target)
    assertions: [individual-inline-and-author-declaration-rows, complete-sorted-computed-declarations, source-computed-separation]
    test_file: packages/browser-layout-inspector/test/inspector.test.ts
  - id: TU-browser-layout-inspector-extension-inline-declaration
    contract: browser-layout-inspector.extension.inline-declaration.write.v1
    level: integration
    given_fixture: positioned-grid-element-fixture
    when: apply-style; remove-style; restore-selected
    assertions: [inline-declaration-state-refresh, computed-cascade-revealed-after-remove, exact-restore]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-inline-declaration-invalid
    contract: browser-layout-inspector.extension.inline-declaration.invalid-property.v1
    level: integration
    given_fixture: positioned-grid-element-fixture
    when: apply-style(invalid-property)
    assertions: [rejected-response, unchanged-page-style]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-ruler-guides
    contract: browser-layout-inspector.extension.ruler.guides.v1
    level: integration
    given_fixture: viewport-pointer-fixture
    when: enable-snap; complete-ruler; clear-guides; complete-next-ruler
    assertions: [8px-snapped-coordinates, angle, automatic-four-guide-nodes, guide-clear, next-ruler-replaces-guides]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-side-panel-workspace
    contract: browser-layout-inspector.extension.side-panel.workspace-panels.query.v1
    level: integration
    given_fixture: mv3-manifest-fixture-and-positioned-grid-element-fixture
    when: load-side-panel; get-dom-tree; extract-page-styles
    assertions: [four-purpose-panel-nodes, page-dom-tree-excludes-overlay, tree-node-selection-updates-normal-inspector-target, readable-page-css-extraction]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-measurement-core
    contract: browser-layout-inspector.measurement-core.query.v1
    level: unit
    given_fixture: deterministic-layout-rect-fixture
    when: measure-element-comparison; measure-ruler; match-css-pixels
    assertions: [signed-corner-deltas, real-gap-only, four-ruler-guides, tolerance-boundary-result]
    test_file: packages/browser-layout-inspector/test/inspector.test.ts
  - id: TU-browser-layout-inspector-extension-work-items
    contract: browser-layout-inspector.extension.work-items.write.v1
    level: integration
    given_fixture: positioned-element-fixture-and-viewport-pointer-fixture
    when: focus-work-item; clear-work-item
    assertions: [independent-normal-a-b-ruler-list, css-inspector-focus-switch, dependent-b-clear-with-a, ruler-clear-isolated]
    test_file: packages/browser-layout-inspector-extension/test/extension/inspect.test.ts
  - id: TU-browser-layout-inspector-extension-auto-select-hide
    contract: browser-layout-inspector.extension.auto-select-hide.write.v1
    level: integration
    given_fixture: positioned-element-fixture
    when: start-auto-select; hover; press-delete-or-backspace
    assertions: [hover-updates-normal-selection, reversible-display-none-mutation, key-capture-scoped-to-auto-select]
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
  - id: IU-browser-layout-inspector-extension-comparison-dimensions
    contract: browser-layout-inspector.extension.comparison-dimensions.render.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:Overlay.showCornerDimensions
    inputs: [comparison-a-rect, comparison-b-rect]
    effects: [four-signed-corner-dimension-lines]
    must_not_own: [measurement-state-persistence, page-layout-mutation, pointer-event-capture]
  - id: IU-browser-layout-inspector-extension-comparison-gap-and-copy
    contract: browser-layout-inspector.extension.comparison-gap-and-copy.write.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:Overlay.gapDimensions
    inputs: [comparison-a-rect, comparison-b-rect, trusted-label-click]
    effects: [projected-positive-gap-line, clipboard-text-write-with-fallback]
    must_not_own: [page-layout-mutation, global-pointer-capture, measurement-persistence]
  - id: IU-browser-layout-inspector-extension-comparison-label-drag
    contract: browser-layout-inspector.extension.comparison-label-drag.write.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:Overlay.startLabelPointer
    inputs: [measurement-label-pointer-events, viewport-pointer-delta]
    effects: [label-hover-emphasis, tab-local-label-offset-transition, copy-on-click-without-drag]
    must_not_own: [dimension-line-mutation, page-pointer-capture, cross-tab-persistence]
  - id: IU-browser-layout-inspector-extension-comparison-zero-and-drag-highlight
    contract: browser-layout-inspector.extension.comparison-zero-and-drag-highlight.render.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:Overlay.nonZeroDimension
    inputs: [rounded-corner-delta, active-dimension-label]
    effects: [zero-dimension-suppression, active-line-and-tick-emphasis]
    must_not_own: [geometry-value-normalization, measurement-line-position-mutation, persistent-storage]
  - id: IU-browser-layout-inspector-extension-work-item-selector
    contract: browser-layout-inspector.extension.work-item-selector.write.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.setWorkItemSelector
    inputs: [work-item-role, candidate-selector]
    effects: [tab-local-work-item-selector-preference]
    must_not_own: [dom-element-reselection, css-rule-mutation, cross-tab-persistence]
  - id: IU-browser-layout-inspector-extension-side-panel
    contract: browser-layout-inspector.extension.side-panel.session.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/background.ts:chrome.sidePanel.setPanelBehavior
    inputs: [extension-action-click]
    effects: [open-side-panel-on-action, active-tab-state-surface]
    must_not_own: [popup-default-surface, browser-protected-page-access]
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
  - id: IU-browser-layout-inspector-css-inspector
    contract: browser-layout-inspector.css-inspector.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector
    source_target: packages/browser-layout-inspector/src/css-inspector.ts:inspectCssDeclarations
    inputs: [target-element, readable-cssom, computed-style]
    effects: [declaration-level-source-and-computed-read-model]
    must_not_own: [css-mutation, cascade-winner-inference, cssom-access-bypass]
  - id: IU-browser-layout-inspector-extension-inline-declaration
    contract: browser-layout-inspector.extension.inline-declaration.write.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.removeStyle
    inputs: [selected-element, property]
    effects: [reversible-inline-declaration-mutation, refreshed-inspector-state]
    must_not_own: [author-stylesheet-mutation, persistent-storage, cross-origin-cssom-access]
  - id: IU-browser-layout-inspector-extension-ruler-guides
    contract: browser-layout-inspector.extension.ruler.guides.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.replaceRulerGuides
    inputs: [completed-ruler, snap-setting]
    effects: [automatic-tab-local-guide-replacement, fixed-overlay-lines, angle-projection]
    must_not_own: [page-css-mutation, persistent-cross-tab-storage]
  - id: IU-browser-layout-inspector-extension-side-panel-workspace
    contract: browser-layout-inspector.extension.side-panel.workspace-panels.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-overview.ts:collectPageDomTree
    inputs: [page-document, readable-document-stylesheets]
    effects: [bounded-selectable-dom-tree, readable-page-style-css-projection]
    must_not_own: [extension-overlay-inclusion, cross-origin-cssom-bypass, page-style-mutation]
  - id: IU-browser-layout-inspector-measurement-core
    contract: browser-layout-inspector.measurement-core.query.v1
    unit_kind: projection
    owned_by: browser-layout-inspector
    source_target: packages/browser-layout-inspector/src/measurement.ts:measureElementComparison
    inputs: [css-pixel-rects, viewport-points, tolerance-expectation]
    effects: [dom-free-comparison-ruler-guide-and-match-projections]
    must_not_own: [dom-query, overlay-rendering, browser-test-framework-assertion]
  - id: IU-browser-layout-inspector-extension-work-items
    contract: browser-layout-inspector.extension.work-items.write.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.focusWorkItem
    inputs: [work-item-id, normal-selection, comparison-anchor-and-target, ruler-box]
    effects: [inspector-focus-transition, isolated-tab-local-work-item-clear]
    must_not_own: [cross-tab-selection-persistence, stylesheet-mutation]
  - id: IU-browser-layout-inspector-extension-auto-select-hide
    contract: browser-layout-inspector.extension.auto-select-hide.write.v1
    unit_kind: interaction-controller
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/page-tools.ts:PageToolController.onPointerMove
    inputs: [auto-select-pointer-move, delete-or-backspace-key-event]
    effects: [hover-selection-transition, reversible-display-none-inline-mutation]
    must_not_own: [editable-control-key-interception, stylesheet-mutation, persistent-storage]
  - id: IU-browser-layout-inspector-extension-capture-viewport
    contract: browser-layout-inspector.extension.capture-viewport.v1
    unit_kind: projection
    owned_by: browser-layout-inspector-extension
    source_target: packages/browser-layout-inspector-extension/src/background.ts:chrome.tabs.captureVisibleTab
    inputs: [active-tab-user-grant]
    effects: [viewport-png-data-url]
    must_not_own: [full-page-stitching, browser-protected-page-access, automatic-upload]
```
