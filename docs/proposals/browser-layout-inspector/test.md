# Browser Layout Inspector — Test Design

- Unit: CSSOM fixture proves each matching comma-list selector is emitted separately.
- Unit: requested computed properties return browser-final values, separate from CSS source candidates.
- Unit: synthetic DOM rects prove viewport, document-scroll, and signed edge-gap semantics.
- Build: the MV3 package bundles the content script with the library and emits `manifest.json` + popup.
- Extension integration: Playwright loads the MV3 extension and verifies background → injected content script → CSS source/final style/geometry response, page-click selection, A→B signed measurement, immediate inline style/hide effect, and exact restore. The isolated test manifest adds loopback-only host access because real `activeTab` is granted only by a browser-action click.
- Side Panel integration: the live MV3 runtime manifest has `side_panel.default_path`, no action popup, `sidePanel` permission, and the Side Panel API required for action-click behavior. Content-script state pushes keep an open panel synchronized after a page click.
- Ruler integration: an actual mouse down → move → up sequence returns viewport start/end coordinates, absolute width/height, and diagonal distance. It is deliberately independent of the DOM A→B edge-gap tool.
- CSS output integration: the selected grid fixture is projected as a CSS block containing final computed values (including Grid/Flex layout fields), followed by clearly labelled matched source candidates rather than a JSON dump.
- JSON exchange integration: an explicitly formatted `browser-layout-inspector.exchange.v1` artifact contains its export timestamp, page URL, viewport/scroll/DPR context, selected inspection, A→B state, Ruler state, snap and guides. CSS remains the default Side Panel output.
- Ruler guide integration: optional 8px snap changes only Ruler points; a completed ruler reports angle and can pin four viewport-fixed edge guides that clear as one tab-local set.
- PNG export acceptance: production uses `activeTab` after the user opens the extension action to capture the visible viewport. Playwright cannot simulate that user grant; its integration check verifies the activeTab permission and `captureVisibleTab` API boundary, while the actual download is a manual acceptance check.
- Deferred browser integration: a second-origin stylesheet fixture verifies the `inaccessibleStylesheets` diagnostic.
