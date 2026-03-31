# Definition Topology Move Plan

규칙:
- 전략: `anchored`
- 실제 subsystem bucket이 갈라지는 지점(anchor)부터 `contains` 체인을 파일 경로 계층으로 투영한다.
- root 문서(contains 부모 없음)는 현재 위치를 유지한다.
- active 문서만 대상으로 본다. `deprecated`/`archived`는 일단 제외한다.
- child 문서는 `anchor-dir/<post-anchor-ancestor-id...>/<filename>`으로 이동시킨다.

요약: root 26건, move 대상 387건, blocked 0건

## Root Documents

- `definition-authoring-guide` → `docs/guides/definition-authoring-guide.md`
- `cli-flow-store` → `docs/specs/cli/cli-flow-store.spec.md`
- `decision-service-system` → `docs/specs/decision-service/decision-service-system.md`
- `decode-service-system` → `docs/specs/decode-service/decode-service-system.md`
- `harness-architecture` → `docs/specs/definition-catalog/definition-harness-architecture.spec.md`
- `definition-service-system` → `docs/specs/definition-service/definition-service-system.md`
- `motion-workspace-service-spec` → `docs/specs/motion-content/motion-workspace-service.spec.md`
- `motion-workspace-spec` → `docs/specs/motion-content/motion-workspace.spec.md`
- `motion-workspace-system` → `docs/specs/motion-workspace/motion-workspace-system.md`
- `quality-gates-system` → `docs/specs/quality-gates/quality-gates-system.md`
- `registry-service-modules` → `docs/specs/registry-service/registry-service-modules.md`
- `content-service-spec` → `docs/specs/services/content-service.spec.md`
- `dashboard-service-spec` → `docs/specs/services/dashboard-service.spec.md`
- `gateway-service-spec` → `docs/specs/services/gateway-service.spec.md`
- `infra-controller-spec` → `docs/specs/services/infra-controller.spec.md`
- `monitor-service-spec` → `docs/specs/services/monitor-service.spec.md`
- `payment-service-spec` → `docs/specs/services/payment-service.spec.md`
- `shopping-backend-spec` → `docs/specs/services/shopping-backend.spec.md`
- `spec-analyzer-scanner` → `docs/specs/spec-verification/spec-analyzer-scanner.md`
- `spec-verification-system` → `docs/specs/spec-verification/spec-verification-system.md`
- `decision-definition-bridge` → `docs/specs/system/decision-definition-bridge.spec.md`
- `dual-coordinate-system` → `docs/specs/system/dual-coordinate-system.spec.md`
- `system-concepts` → `docs/specs/system/system-concepts.spec.md`
- `system-data-flow` → `docs/specs/system/system-data-flow.spec.md`
- `system-root` → `docs/specs/system/system-root.md`
- `viteplus-sdk-smoke-system` → `docs/specs/viteplus-sdk-smoke/viteplus-sdk-smoke.md`

## Proposed Moves

- `axis-decision-guide`
  current: `docs/guides/axis-decision-guide.md`
  target: `docs/specs/decision-flow/axis-decision-guide.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > axis-decision-guide`
- `cookbook-guide`
  current: `docs/guides/cookbook.md`
  target: `docs/specs/guides-system/cookbook.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > cookbook-guide`
- `definition-runtime-guide`
  current: `docs/guides/definition-runtime-guide.md`
  target: `docs/specs/guides-system/definition-runtime-guide.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > definition-runtime-guide`
- `prefix-type-guide`
  current: `docs/guides/prefix-type-guide.md`
  target: `docs/specs/guides-system/prefix-type-guide.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > prefix-type-guide`
- `quickstart-guide`
  current: `docs/guides/quickstart.md`
  target: `docs/specs/guides-system/quickstart.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > quickstart-guide`
- `scenario-authoring-guide`
  current: `docs/guides/scenario-authoring-guide.md`
  target: `docs/specs/guides-system/scenario-authoring-guide.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > scenario-authoring-guide`
- `scope-classification-guide`
  current: `docs/guides/scope-classification-guide.md`
  target: `docs/specs/guides-system/scope-classification-guide.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > scope-classification-guide`
- `sdk-usage-guide`
  current: `docs/guides/sdk-usage-guide.md`
  target: `docs/specs/guides-system/sdk-usage-guide.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > sdk-usage-guide`
- `sdk-vite-onboarding-guide`
  current: `docs/guides/sdk-vite-onboarding-guide.md`
  target: `docs/specs/guides-system/sdk-vite-onboarding-guide.md`
  anchor: `guides-system`
  chain: `system-root > system-support > guides-system > sdk-vite-onboarding-guide`
- `address-index`
  current: `docs/specs/address-index/address-index.md`
  target: `docs/specs/index-meta-system/address-index.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > address-index`
- `address-context-format`
  current: `docs/specs/apm-system/address-context-format.spec.md`
  target: `docs/specs/apm-system/apm-schema-system/address-context-format.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-schema-system > address-context-format`
- `address-context-storage`
  current: `docs/specs/apm-system/address-context-storage.spec.md`
  target: `docs/specs/apm-system/apm-schema-system/address-context-storage.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-schema-system > address-context-storage`
- `codegen-cli-contract`
  current: `docs/specs/apm-system/codegen-cli-contract.spec.md`
  target: `docs/specs/apm-system/apm-codegen-system/codegen-cli-contract.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-codegen-system > codegen-cli-contract`
- `codegen-schema-output`
  current: `docs/specs/apm-system/codegen-schema-output.spec.md`
  target: `docs/specs/apm-system/apm-codegen-system/codegen-schema-output.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-codegen-system > codegen-schema-output`
- `dsl-schema-domain-model`
  current: `docs/specs/apm-system/dsl-schema-domain-model.spec.md`
  target: `docs/specs/apm-system/apm-schema-system/dsl-schema-domain-model.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-schema-system > dsl-schema-domain-model`
- `dsl-schema-versioning`
  current: `docs/specs/apm-system/dsl-schema-versioning.spec.md`
  target: `docs/specs/apm-system/apm-schema-system/dsl-schema-versioning.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-schema-system > dsl-schema-versioning`
- `log-ingest-bridge`
  current: `docs/specs/apm-system/log-ingest-bridge.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/log-ingest-bridge.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > log-ingest-bridge`
- `log-ingest-forwarder`
  current: `docs/specs/apm-system/log-ingest-forwarder.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/log-ingest-bridge/log-ingest-forwarder.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > log-ingest-bridge > log-ingest-forwarder`
- `log-ingest-wiring`
  current: `docs/specs/apm-system/log-ingest-wiring.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/log-ingest-bridge/log-ingest-wiring.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > log-ingest-bridge > log-ingest-wiring`
- `logger-contract`
  current: `docs/specs/apm-system/logger-contract.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/logger-contract.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > logger-contract`
- `logger-runtime-rules`
  current: `docs/specs/apm-system/logger-runtime-rules.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/logger-runtime-rules.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > logger-runtime-rules`
- `runtime-flow-paths`
  current: `docs/specs/apm-system/runtime-flow-paths.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/runtime-flow-paths.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > runtime-flow-paths`
- `runtime-flow-rollout`
  current: `docs/specs/apm-system/runtime-flow-rollout.spec.md`
  target: `docs/specs/apm-system/apm-runtime-system/runtime-flow-rollout.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > apm-runtime-system > runtime-flow-rollout`
- `metrics-spec`
  current: `docs/specs/apm/metrics.spec.md`
  target: `docs/specs/apm-system/metrics.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > metrics-spec`
- `browser-capture-contract`
  current: `docs/specs/browser-system/browser-capture-contract.spec.md`
  target: `docs/specs/browser-system/browser-runtime-system/browser-capture-contract.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > browser-runtime-system > browser-capture-contract`
- `browser-lifecycle-states`
  current: `docs/specs/browser-system/browser-lifecycle-states.spec.md`
  target: `docs/specs/browser-system/browser-lifecycle-system/browser-lifecycle-states.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > browser-lifecycle-system > browser-lifecycle-states`
- `browser-monitor-api`
  current: `docs/specs/browser-system/browser-monitor-api.spec.md`
  target: `docs/specs/browser-system/browser-runtime-system/browser-monitor-api.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > browser-runtime-system > browser-monitor-api`
- `browser-monitor-operations`
  current: `docs/specs/browser-system/browser-monitor-operations.spec.md`
  target: `docs/specs/browser-system/browser-runtime-system/browser-monitor-operations.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > browser-runtime-system > browser-monitor-operations`
- `browser-session-patterns`
  current: `docs/specs/browser-system/browser-session-patterns.spec.md`
  target: `docs/specs/browser-system/browser-lifecycle-system/browser-session-patterns.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > browser-lifecycle-system > browser-session-patterns`
- `browser-session-spec`
  current: `docs/specs/browser/session.spec.md`
  target: `docs/specs/ingest/session.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > browser-session-spec`
- `browser-transport-spec`
  current: `docs/specs/browser/transport.spec.md`
  target: `docs/specs/browser-system/transport.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > browser-transport-spec`
- `cli-contract-spec`
  current: `docs/specs/cli/cli-contract.spec.md`
  target: `docs/specs/apm-system/cli-contract.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > cli-contract-spec`
- `trace-context-spec`
  current: `docs/specs/collection/context.spec.md`
  target: `docs/specs/browser-system/context.spec.md`
  anchor: `browser-system`
  chain: `system-root > system-frontend > browser-system > trace-context-spec`
- `masking-spec`
  current: `docs/specs/collection/masking.spec.md`
  target: `docs/specs/permission/masking.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > masking-spec`
- `collection-transport-spec`
  current: `docs/specs/collection/transport.spec.md`
  target: `docs/specs/apm-system/transport.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > collection-transport-spec`
- `dlq-store-spec`
  current: `docs/specs/data-model/dlq-store.spec.md`
  target: `docs/specs/ingest/dlq-store.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > dlq-store-spec`
- `graph-spec`
  current: `docs/specs/data-model/graph.spec.md`
  target: `docs/specs/storage-system/graph.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > graph-spec`
- `record-spec`
  current: `docs/specs/data-model/record.spec.md`
  target: `docs/specs/ingest/record.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > record-spec`
- `scenario-store-spec`
  current: `docs/specs/data-model/scenario-spec-store.spec.md`
  target: `docs/specs/storage-system/scenario-spec-store.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > scenario-store-spec`
- `session-spec`
  current: `docs/specs/data-model/session.spec.md`
  target: `docs/specs/ingest/session.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > session-spec`
- `trace-spec`
  current: `docs/specs/data-model/trace.spec.md`
  target: `docs/specs/ingest/trace.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > trace-spec`
- `transmission-spec`
  current: `docs/specs/data-model/transmission.spec.md`
  target: `docs/specs/ingest/transmission.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > transmission-spec`
- `utils-spec`
  current: `docs/specs/data-model/utils.spec.md`
  target: `docs/specs/storage-system/utils.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > utils-spec`
- `verdict-spec`
  current: `docs/specs/data-model/verdict.spec.md`
  target: `docs/specs/storage-system/verdict.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > verdict-spec`
- `decision-standard-checklist`
  current: `docs/specs/decision-flow/decision-standard-checklist.spec.md`
  target: `docs/specs/decision-flow/decision-standard-group/decision-standard-checklist.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > decision-standard-group > decision-standard-checklist`
- `decision-standard-process`
  current: `docs/specs/decision-flow/decision-standard-process.spec.md`
  target: `docs/specs/decision-flow/decision-standard-group/decision-standard-process.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > decision-standard-group > decision-standard-process`
- `df-axis-model`
  current: `docs/specs/decision-flow/df-axis-model.spec.md`
  target: `docs/specs/decision-flow/df-model-group/df-axis-model.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-model-group > df-axis-model`
- `df-causal-mapping`
  current: `docs/specs/decision-flow/df-causal-mapping.spec.md`
  target: `docs/specs/decision-flow/df-analysis-group/df-causal-mapping.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-analysis-group > df-causal-mapping`
- `df-cli-persistence`
  current: `docs/specs/decision-flow/df-cli-persistence.spec.md`
  target: `docs/specs/decision-flow/df-interface-group/df-cli-persistence.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-interface-group > df-cli-persistence`
- `df-cli-query`
  current: `docs/specs/decision-flow/df-cli-query.spec.md`
  target: `docs/specs/decision-flow/df-interface-group/df-cli-query.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-interface-group > df-cli-query`
- `df-ingest-emission`
  current: `docs/specs/decision-flow/df-ingest-emission.spec.md`
  target: `docs/specs/decision-flow/df-interface-group/df-ingest-emission.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-interface-group > df-ingest-emission`
- `df-narrative-context`
  current: `docs/specs/decision-flow/df-narrative-context.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-context.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-context`
- `df-narrative-proof-coordinate-space`
  current: `docs/specs/decision-flow/df-narrative-proof-coordinate-space.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-proofs/df-narrative-proof-coordinate-space.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-proofs > df-narrative-proof-coordinate-space`
- `df-narrative-proof-core-gates`
  current: `docs/specs/decision-flow/df-narrative-proof-core-gates.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-proofs/df-narrative-proof-core-gates.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-proofs > df-narrative-proof-core-gates`
- `df-narrative-proof-operational-cases`
  current: `docs/specs/decision-flow/df-narrative-proof-operational-cases.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-proofs/df-narrative-proof-operational-cases.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-proofs > df-narrative-proof-operational-cases`
- `df-narrative-proof-story-assembly`
  current: `docs/specs/decision-flow/df-narrative-proof-story-assembly.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-proofs/df-narrative-proof-story-assembly.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-proofs > df-narrative-proof-story-assembly`
- `df-narrative-proofs`
  current: `docs/specs/decision-flow/df-narrative-proofs.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-proofs.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-proofs`
- `df-narrative-structure`
  current: `docs/specs/decision-flow/df-narrative-structure.spec.md`
  target: `docs/specs/decision-flow/df-narrative-group/df-narrative-structure.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-narrative-group > df-narrative-structure`
- `df-observation-space`
  current: `docs/specs/decision-flow/df-observation-space.spec.md`
  target: `docs/specs/decision-flow/df-model-group/df-observation-space.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-model-group > df-observation-space`
- `df-serialization`
  current: `docs/specs/decision-flow/df-serialization.spec.md`
  target: `docs/specs/decision-flow/df-model-group/df-serialization.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-model-group > df-serialization`
- `df-state-model`
  current: `docs/specs/decision-flow/df-state-model.spec.md`
  target: `docs/specs/decision-flow/df-model-group/df-state-model.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-model-group > df-state-model`
- `df-time-analysis`
  current: `docs/specs/decision-flow/df-time-analysis.spec.md`
  target: `docs/specs/decision-flow/df-analysis-group/df-time-analysis.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-analysis-group > df-time-analysis`
- `df-vector-analysis`
  current: `docs/specs/decision-flow/df-vector-analysis.spec.md`
  target: `docs/specs/decision-flow/df-analysis-group/df-vector-analysis.spec.md`
  anchor: `df-system`
  chain: `system-root > system-design-tools > df-system > df-analysis-group > df-vector-analysis`
- `definition-addressing`
  current: `docs/specs/definition-catalog/definition-addressing.spec.md`
  target: `docs/specs/definition-catalog/definition-taxonomy/definition-addressing.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-taxonomy > definition-addressing`
- `definition-harness-cli`
  current: `docs/specs/definition-catalog/definition-harness-cli.spec.md`
  target: `docs/specs/definition-catalog/definition-harness/definition-harness-cli.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-harness > definition-harness-cli`
- `definition-harness-derive`
  current: `docs/specs/definition-catalog/definition-harness-derive.spec.md`
  target: `docs/specs/definition-catalog/definition-harness/definition-harness-derive.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-harness > definition-harness-derive`
- `definition-harness-persistence`
  current: `docs/specs/definition-catalog/definition-harness-persistence.spec.md`
  target: `docs/specs/definition-catalog/definition-harness/definition-harness-persistence.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-harness > definition-harness-persistence`
- `definition-level`
  current: `docs/specs/definition-catalog/definition-level.spec.md`
  target: `docs/specs/definition-catalog/definition-taxonomy/definition-level.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-taxonomy > definition-level`
- `definition-mgmt-consistency-rules`
  current: `docs/specs/definition-catalog/definition-mgmt-consistency-rules.spec.md`
  target: `docs/specs/definition-catalog/definition-management/definition-mgmt-consistency-rules.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-management > definition-mgmt-consistency-rules`
- `definition-mgmt-coordinates`
  current: `docs/specs/definition-catalog/definition-mgmt-coordinates.spec.md`
  target: `docs/specs/definition-catalog/definition-management/definition-mgmt-coordinates.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-management > definition-mgmt-coordinates`
- `definition-mgmt-feedback-loop`
  current: `docs/specs/definition-catalog/definition-mgmt-feedback-loop.spec.md`
  target: `docs/specs/definition-catalog/definition-management/definition-mgmt-feedback-loop.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-management > definition-mgmt-feedback-loop`
- `definition-mgmt-graph-links`
  current: `docs/specs/definition-catalog/definition-mgmt-graph-links.spec.md`
  target: `docs/specs/definition-catalog/definition-management/definition-mgmt-graph-links.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-management > definition-mgmt-graph-links`
- `definition-mgmt-state-tracking`
  current: `docs/specs/definition-catalog/definition-mgmt-state-tracking.spec.md`
  target: `docs/specs/definition-catalog/definition-management/definition-mgmt-state-tracking.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-management > definition-mgmt-state-tracking`
- `definition-mgmt-verification-loop`
  current: `docs/specs/definition-catalog/definition-mgmt-verification-loop.spec.md`
  target: `docs/specs/definition-catalog/definition-management/definition-mgmt-verification-loop.spec.md`
  anchor: `definition-catalog-spec`
  chain: `system-root > system-design-tools > definition-catalog-spec > definition-management > definition-mgmt-verification-loop`
- `dkg-skill-cascade`
  current: `docs/specs/dkg-system/dkg-skill-cascade.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-cascade.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-cascade`
- `dkg-skill-catalog-registry`
  current: `docs/specs/dkg-system/dkg-skill-catalog-registry.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-catalog/dkg-skill-catalog-registry.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-catalog > dkg-skill-catalog-registry`
- `dkg-skill-catalog-types`
  current: `docs/specs/dkg-system/dkg-skill-catalog-types.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-catalog/dkg-skill-catalog-types.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-catalog > dkg-skill-catalog-types`
- `dkg-skill-catalog`
  current: `docs/specs/dkg-system/dkg-skill-catalog.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-catalog.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-catalog`
- `dkg-skill-decision`
  current: `docs/specs/dkg-system/dkg-skill-decision.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-decision.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-decision`
- `dkg-skill-migrator`
  current: `docs/specs/dkg-system/dkg-skill-migrator.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-migrator.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-migrator`
- `dkg-skill-version-event`
  current: `docs/specs/dkg-system/dkg-skill-version-event.spec.md`
  target: `docs/specs/dkg-system/dkg-skills-system/dkg-skill-version-event.spec.md`
  anchor: `dkg-system`
  chain: `system-root > system-design-tools > dkg-system > dkg-skills-system > dkg-skill-version-event`
- `event-core-pattern`
  current: `docs/specs/event-vocabulary/core-pattern.spec.md`
  target: `docs/specs/event-vocab-system/core-pattern.spec.md`
  anchor: `event-vocab-system`
  chain: `system-root > system-support > event-vocab-system > event-core-pattern`
- `graph-hint-spec`
  current: `docs/specs/event-vocabulary/graph-hint.spec.md`
  target: `docs/specs/event-vocab-system/graph-hint.spec.md`
  anchor: `event-vocab-system`
  chain: `system-root > system-support > event-vocab-system > graph-hint-spec`
- `payload-guide`
  current: `docs/specs/event-vocabulary/payload-guide.spec.md`
  target: `docs/specs/event-vocab-system/payload-guide.spec.md`
  anchor: `event-vocab-system`
  chain: `system-root > system-support > event-vocab-system > payload-guide`
- `gate-engine-aware-query`
  current: `docs/specs/gate/gate-engine-aware-query.spec.md`
  target: `docs/specs/gate/gate-engine-group/gate-engine-aware-query.spec.md`
  anchor: `gate-system`
  chain: `system-root > system-infra > gate-system > gate-engine-group > gate-engine-aware-query`
- `gate-engine-core`
  current: `docs/specs/gate/gate-engine-core.spec.md`
  target: `docs/specs/gate/gate-engine-group/gate-engine-core.spec.md`
  anchor: `gate-system`
  chain: `system-root > system-infra > gate-system > gate-engine-group > gate-engine-core`
- `gate-engine-decorator`
  current: `docs/specs/gate/gate-engine-decorator.spec.md`
  target: `docs/specs/gate/gate-engine-group/gate-engine-decorator.spec.md`
  anchor: `gate-system`
  chain: `system-root > system-infra > gate-system > gate-engine-group > gate-engine-decorator`
- `address-scenarios-parse`
  current: `docs/specs/index-meta-system/address-scenarios-parse.spec.md`
  target: `docs/specs/index-meta-system/address-scenarios-group/address-scenarios-parse.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > address-scenarios-group > address-scenarios-parse`
- `address-scenarios-runtime`
  current: `docs/specs/index-meta-system/address-scenarios-runtime.spec.md`
  target: `docs/specs/index-meta-system/address-scenarios-group/address-scenarios-runtime.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > address-scenarios-group > address-scenarios-runtime`
- `address-separation-decision`
  current: `docs/specs/index-meta-system/address-separation-decision.spec.md`
  target: `docs/specs/index-meta-system/address-separation-group/address-separation-decision.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > address-separation-group > address-separation-decision`
- `address-separation-rollout`
  current: `docs/specs/index-meta-system/address-separation-rollout.spec.md`
  target: `docs/specs/index-meta-system/address-separation-group/address-separation-rollout.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > address-separation-group > address-separation-rollout`
- `dx-lifecycle-contract`
  current: `docs/specs/index-meta-system/dx-lifecycle-contract.spec.md`
  target: `docs/specs/index-meta-system/dx-lifecycle-group/dx-lifecycle-contract.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > dx-lifecycle-group > dx-lifecycle-contract`
- `dx-lifecycle-tooling`
  current: `docs/specs/index-meta-system/dx-lifecycle-tooling.spec.md`
  target: `docs/specs/index-meta-system/dx-lifecycle-group/dx-lifecycle-tooling.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > dx-lifecycle-group > dx-lifecycle-tooling`
- `index-meta-store-contract`
  current: `docs/specs/index-meta-system/index-meta-store-contract.spec.md`
  target: `docs/specs/index-meta-system/index-meta-store-group/index-meta-store-contract.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > index-meta-store-group > index-meta-store-contract`
- `index-meta-store-resolution`
  current: `docs/specs/index-meta-system/index-meta-store-resolution.spec.md`
  target: `docs/specs/index-meta-system/index-meta-store-group/index-meta-store-resolution.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > index-meta-store-group > index-meta-store-resolution`
- `sdk-api-surface`
  current: `docs/specs/index-meta-system/sdk-api-surface.spec.md`
  target: `docs/specs/index-meta-system/sdk-system/sdk-api-surface.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-system > sdk-api-surface`
- `sdk-constants`
  current: `docs/specs/index-meta-system/sdk-constants.spec.md`
  target: `docs/specs/index-meta-system/sdk-system/sdk-constants.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-system > sdk-constants`
- `sdk-dim-views`
  current: `docs/specs/index-meta-system/sdk-dim-views.spec.md`
  target: `docs/specs/index-meta-system/sdk-system/sdk-dim-views.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-system > sdk-dim-views`
- `behavior-traversal-axis`
  current: `docs/specs/indexing-core-system/behavior-traversal-axis.spec.md`
  target: `docs/specs/indexing-core-system/behavior-traversal-group/behavior-traversal-axis.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > behavior-traversal-group > behavior-traversal-axis`
- `behavior-traversal-query`
  current: `docs/specs/indexing-core-system/behavior-traversal-query.spec.md`
  target: `docs/specs/indexing-core-system/behavior-traversal-group/behavior-traversal-query.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > behavior-traversal-group > behavior-traversal-query`
- `bench-browser`
  current: `docs/specs/indexing-core-system/bench-browser.spec.md`
  target: `docs/specs/indexing-core-system/benchmark-system/bench-browser.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > benchmark-system > bench-browser`
- `bench-cross-index`
  current: `docs/specs/indexing-core-system/bench-cross-index.spec.md`
  target: `docs/specs/indexing-core-system/benchmark-system/bench-cross-index.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > benchmark-system > bench-cross-index`
- `bench-encode-decode`
  current: `docs/specs/indexing-core-system/bench-encode-decode.spec.md`
  target: `docs/specs/indexing-core-system/benchmark-system/bench-encode-decode.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > benchmark-system > bench-encode-decode`
- `bench-range-calc`
  current: `docs/specs/indexing-core-system/bench-range-calc.spec.md`
  target: `docs/specs/indexing-core-system/benchmark-system/bench-range-calc.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > benchmark-system > bench-range-calc`
- `bigint-addressing-rollout`
  current: `docs/specs/indexing-core-system/bigint-addressing-rollout.spec.md`
  target: `docs/specs/indexing-core-system/bigint-addressing-group/bigint-addressing-rollout.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > bigint-addressing-group > bigint-addressing-rollout`
- `bigint-addressing-runtime`
  current: `docs/specs/indexing-core-system/bigint-addressing-runtime.spec.md`
  target: `docs/specs/indexing-core-system/bigint-addressing-group/bigint-addressing-runtime.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > bigint-addressing-group > bigint-addressing-runtime`
- `conv-acceleration`
  current: `docs/specs/indexing-core-system/conv-acceleration.spec.md`
  target: `docs/specs/indexing-core-system/conventions-system/conv-acceleration.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > conventions-system > conv-acceleration`
- `conv-naming`
  current: `docs/specs/indexing-core-system/conv-naming.spec.md`
  target: `docs/specs/indexing-core-system/conventions-system/conv-naming.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > conventions-system > conv-naming`
- `conv-reserved-entries`
  current: `docs/specs/indexing-core-system/conv-reserved-entries.spec.md`
  target: `docs/specs/indexing-core-system/conventions-system/conv-reserved-entries.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > conventions-system > conv-reserved-entries`
- `coord-states-taxonomy`
  current: `docs/specs/indexing-core-system/coord-states-taxonomy.spec.md`
  target: `docs/specs/indexing-core-system/coord-states-group/coord-states-taxonomy.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-states-group > coord-states-taxonomy`
- `coord-states-versioning`
  current: `docs/specs/indexing-core-system/coord-states-versioning.spec.md`
  target: `docs/specs/indexing-core-system/coord-states-group/coord-states-versioning.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-states-group > coord-states-versioning`
- `data-design-catalog`
  current: `docs/specs/indexing-core-system/data-design-catalog.spec.md`
  target: `docs/specs/indexing-core-system/data-design-group/data-design-catalog.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > data-design-group > data-design-catalog`
- `data-design-compression`
  current: `docs/specs/indexing-core-system/data-design-compression.spec.md`
  target: `docs/specs/indexing-core-system/data-design-group/data-design-compression.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > data-design-group > data-design-compression`
- `dim-ops-cross-select`
  current: `docs/specs/indexing-core-system/dim-ops-cross-select.spec.md`
  target: `docs/specs/indexing-core-system/dim-ops-system/dim-ops-cross-select.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > dim-ops-system > dim-ops-cross-select`
- `dim-ops-deploy-resolve`
  current: `docs/specs/indexing-core-system/dim-ops-deploy-resolve.spec.md`
  target: `docs/specs/indexing-core-system/dim-ops-system/dim-ops-deploy-resolve.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > dim-ops-system > dim-ops-deploy-resolve`
- `dim-ops-env-inject`
  current: `docs/specs/indexing-core-system/dim-ops-env-inject.spec.md`
  target: `docs/specs/indexing-core-system/dim-ops-system/dim-ops-env-inject.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > dim-ops-system > dim-ops-env-inject`
- `dim-ops-patterns`
  current: `docs/specs/indexing-core-system/dim-ops-patterns.spec.md`
  target: `docs/specs/indexing-core-system/dim-ops-system/dim-ops-patterns.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > dim-ops-system > dim-ops-patterns`
- `index-arch-layers`
  current: `docs/specs/indexing-core-system/index-arch-layers.spec.md`
  target: `docs/specs/indexing-core-system/index-arch-group/index-arch-layers.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > index-arch-group > index-arch-layers`
- `index-arch-traceability`
  current: `docs/specs/indexing-core-system/index-arch-traceability.spec.md`
  target: `docs/specs/indexing-core-system/index-arch-group/index-arch-traceability.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > index-arch-group > index-arch-traceability`
- `slot-marker-capacity`
  current: `docs/specs/indexing-core-system/slot-marker-capacity.spec.md`
  target: `docs/specs/indexing-core-system/slot-marker-group/slot-marker-capacity.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > slot-marker-group > slot-marker-capacity`
- `slot-marker-concept`
  current: `docs/specs/indexing-core-system/slot-marker-concept.spec.md`
  target: `docs/specs/indexing-core-system/slot-marker-group/slot-marker-concept.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > slot-marker-group > slot-marker-concept`
- `slot-marker-patterns`
  current: `docs/specs/indexing-core-system/slot-marker-patterns.spec.md`
  target: `docs/specs/indexing-core-system/slot-marker-group/slot-marker-patterns.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > slot-marker-group > slot-marker-patterns`
- `table-accessor-api`
  current: `docs/specs/indexing-core-system/table-accessor-api.spec.md`
  target: `docs/specs/indexing-core-system/table-system-group/table-accessor-api.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > table-system-group > table-accessor-api`
- `table-dimref-types`
  current: `docs/specs/indexing-core-system/table-dimref-types.spec.md`
  target: `docs/specs/indexing-core-system/table-system-group/table-dimref-types.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > table-system-group > table-dimref-types`
- `table-schema-def`
  current: `docs/specs/indexing-core-system/table-schema-def.spec.md`
  target: `docs/specs/indexing-core-system/table-system-group/table-schema-def.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > table-system-group > table-schema-def`
- `acceleration-spec`
  current: `docs/specs/indexing/acceleration.md`
  target: `docs/specs/indexing-core-system/acceleration.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > acceleration-spec`
- `address-index-spec`
  current: `docs/specs/indexing/address-index.spec.md`
  target: `docs/specs/indexing-core-system/address-index.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > address-index-spec`
- `dsl-bundle-spec`
  current: `docs/specs/indexing/dsl-bundle.md`
  target: `docs/specs/indexing-core-system/dsl-bundle.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > dsl-bundle-spec`
- `event-schema-spec`
  current: `docs/specs/indexing/event-schema.md`
  target: `docs/specs/indexing-core-system/event-schema.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > event-schema-spec`
- `coord-acceleration-design`
  current: `docs/specs/indexing/foundation-acceleration.md`
  target: `docs/specs/indexing-core-system/coord-foundation/foundation-acceleration.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-foundation > coord-acceleration-design`
- `coord-closed-space`
  current: `docs/specs/indexing/foundation-closed-space.md`
  target: `docs/specs/indexing-core-system/coord-foundation/foundation-closed-space.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-foundation > coord-closed-space`
- `coord-layer-separation`
  current: `docs/specs/indexing/foundation-layer-separation.md`
  target: `docs/specs/indexing-core-system/coord-foundation/foundation-layer-separation.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-foundation > coord-layer-separation`
- `coord-stride-stability`
  current: `docs/specs/indexing/foundation-stride-stability.md`
  target: `docs/specs/indexing-core-system/coord-foundation/foundation-stride-stability.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-foundation > coord-stride-stability`
- `coord-version-series`
  current: `docs/specs/indexing/foundation-version-series.md`
  target: `docs/specs/indexing-core-system/coord-foundation/foundation-version-series.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-foundation > coord-version-series`
- `coord-foundation`
  current: `docs/specs/indexing/foundation.md`
  target: `docs/specs/indexing-core-system/foundation.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-foundation`
- `address-spec`
  current: `docs/specs/indexing/index-meta/address.spec.md`
  target: `docs/specs/index-meta-system/address.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > address-spec`
- `adr-merge-dedup`
  current: `docs/specs/indexing/index-meta/adr-merge-dedup.md`
  target: `docs/specs/indexing-core-system/adr-merge-dedup.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > adr-merge-dedup`
- `canonical-format-spec`
  current: `docs/specs/indexing/index-meta/canonical-format.spec.md`
  target: `docs/specs/index-meta-system/canonical-format.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > canonical-format-spec`
- `index-codec-spec`
  current: `docs/specs/indexing/index-meta/codec.spec.md`
  target: `docs/specs/index-meta-system/codec.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > index-codec-spec`
- `invariants-spec`
  current: `docs/specs/indexing/index-meta/invariants.spec.md`
  target: `docs/specs/index-meta-system/invariants.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > invariants-spec`
- `meta-registry-spec`
  current: `docs/specs/indexing/index-meta/registry.spec.md`
  target: `docs/specs/registry-system/registry.spec.md`
  anchor: `registry-system`
  chain: `system-root > system-infra > registry-system > meta-registry-spec`
- `resolver-spec`
  current: `docs/specs/indexing/index-meta/resolver.spec.md`
  target: `docs/specs/index-meta-system/resolver.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > resolver-spec`
- `sdk-scenarios`
  current: `docs/specs/indexing/index-meta/scenarios-sdk.spec.md`
  target: `docs/specs/index-meta-system/scenarios-sdk.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios`
- `user-scenarios`
  current: `docs/specs/indexing/index-meta/scenarios.spec.md`
  target: `docs/specs/index-meta-system/scenarios.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > user-scenarios`
- `sdk-scenario-cli-simulation`
  current: `docs/specs/indexing/index-meta/sdk-scenario-cli-simulation.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-cli-simulation.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-cli-simulation`
- `sdk-scenario-entry-modes`
  current: `docs/specs/indexing/index-meta/sdk-scenario-entry-modes.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-entry-modes.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-entry-modes`
- `sdk-scenario-inactive-entries`
  current: `docs/specs/indexing/index-meta/sdk-scenario-inactive-entries.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-inactive-entries.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-inactive-entries`
- `sdk-scenario-lifecycle`
  current: `docs/specs/indexing/index-meta/sdk-scenario-lifecycle.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-lifecycle.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-lifecycle`
- `sdk-scenario-multi-service`
  current: `docs/specs/indexing/index-meta/sdk-scenario-multi-service.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-multi-service.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-multi-service`
- `sdk-scenario-reserved-tokens`
  current: `docs/specs/indexing/index-meta/sdk-scenario-reserved-tokens.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-reserved-tokens.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-reserved-tokens`
- `sdk-scenario-schema-evolution`
  current: `docs/specs/indexing/index-meta/sdk-scenario-schema-evolution.spec.md`
  target: `docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-schema-evolution.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > sdk-scenarios > sdk-scenario-schema-evolution`
- `table-schema-api-spec`
  current: `docs/specs/indexing/index-meta/table-schema-api.spec.md`
  target: `docs/specs/index-meta-system/table-schema-spec/table-schema-api.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > table-schema-spec > table-schema-api-spec`
- `table-schema-compiled-spec`
  current: `docs/specs/indexing/index-meta/table-schema-compiled.spec.md`
  target: `docs/specs/index-meta-system/table-schema-spec/table-schema-compiled.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > table-schema-spec > table-schema-compiled-spec`
- `table-schema-types-spec`
  current: `docs/specs/indexing/index-meta/table-schema-types.spec.md`
  target: `docs/specs/index-meta-system/table-schema-spec/table-schema-types.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > table-schema-spec > table-schema-types-spec`
- `table-schema-usage-spec`
  current: `docs/specs/indexing/index-meta/table-schema-usage.spec.md`
  target: `docs/specs/index-meta-system/table-schema-spec/table-schema-usage.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > table-schema-spec > table-schema-usage-spec`
- `table-schema-spec`
  current: `docs/specs/indexing/index-meta/table-schema.spec.md`
  target: `docs/specs/index-meta-system/table-schema.spec.md`
  anchor: `index-meta-system`
  chain: `system-root > system-libraries > index-meta-system > table-schema-spec`
- `layout-sim-formats`
  current: `docs/specs/indexing/layout-sim-formats.md`
  target: `docs/specs/indexing-core-system/layout-sim-formats.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > layout-sim-formats`
- `ontology-eval`
  current: `docs/specs/indexing/ontology-evaluation.md`
  target: `docs/specs/indexing-core-system/ontology-evaluation.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > ontology-eval`
- `coord-patterns`
  current: `docs/specs/indexing/patterns.md`
  target: `docs/specs/indexing-core-system/patterns.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > coord-patterns`
- `indexing-pipeline`
  current: `docs/specs/indexing/pipeline.md`
  target: `docs/specs/pipeline-system/pipeline.md`
  anchor: `pipeline-system`
  chain: `system-root > system-infra > pipeline-system > indexing-pipeline`
- `schema-layer-architecture-spec`
  current: `docs/specs/indexing/schema-layer-architecture.md`
  target: `docs/specs/indexing-core-system/schema-layer-spec/schema-layer-architecture.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > schema-layer-spec > schema-layer-architecture-spec`
- `schema-layer-categories-spec`
  current: `docs/specs/indexing/schema-layer-categories.md`
  target: `docs/specs/indexing-core-system/schema-layer-spec/schema-layer-categories.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > schema-layer-spec > schema-layer-categories-spec`
- `schema-layer-fragments-spec`
  current: `docs/specs/indexing/schema-layer-fragments.md`
  target: `docs/specs/indexing-core-system/schema-layer-spec/schema-layer-fragments.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > schema-layer-spec > schema-layer-fragments-spec`
- `schema-layer-implementation-spec`
  current: `docs/specs/indexing/schema-layer-implementation.md`
  target: `docs/specs/indexing-core-system/schema-layer-spec/schema-layer-implementation.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > schema-layer-spec > schema-layer-implementation-spec`
- `schema-layer-validation-spec`
  current: `docs/specs/indexing/schema-layer-validation.md`
  target: `docs/specs/indexing-core-system/schema-layer-spec/schema-layer-validation.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > schema-layer-spec > schema-layer-validation-spec`
- `schema-layer-spec`
  current: `docs/specs/indexing/schema-layer.md`
  target: `docs/specs/indexing-core-system/schema-layer.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > schema-layer-spec`
- `signal-model-spec`
  current: `docs/specs/indexing/signal-model.md`
  target: `docs/specs/indexing-core-system/signal-model.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > signal-model-spec`
- `tag-search-spec`
  current: `docs/specs/indexing/tag-search.spec.md`
  target: `docs/specs/indexing-core-system/tag-search.spec.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > tag-search-spec`
- `version-operations`
  current: `docs/specs/indexing/version-operations.md`
  target: `docs/specs/indexing-core-system/version-operations.md`
  anchor: `indexing-core-system`
  chain: `system-root > system-libraries > indexing-core-system > version-operations`
- `partial-binder-api`
  current: `docs/specs/indexing/weighted-index/partial-binder-api.spec.md`
  target: `docs/specs/weighted-index-system/partial-binder-spec/partial-binder-api.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > partial-binder-spec > partial-binder-api`
- `partial-binder-math`
  current: `docs/specs/indexing/weighted-index/partial-binder-math.spec.md`
  target: `docs/specs/weighted-index-system/partial-binder-spec/partial-binder-math.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > partial-binder-spec > partial-binder-math`
- `partial-binder-patterns`
  current: `docs/specs/indexing/weighted-index/partial-binder-patterns.spec.md`
  target: `docs/specs/weighted-index-system/partial-binder-spec/partial-binder-patterns.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > partial-binder-spec > partial-binder-patterns`
- `partial-binder-validation`
  current: `docs/specs/indexing/weighted-index/partial-binder-validation.spec.md`
  target: `docs/specs/weighted-index-system/partial-binder-spec/partial-binder-validation.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > partial-binder-spec > partial-binder-validation`
- `partial-binder-spec`
  current: `docs/specs/indexing/weighted-index/partial-binder.spec.md`
  target: `docs/specs/weighted-index-system/partial-binder.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > partial-binder-spec`
- `range-query-spec`
  current: `docs/specs/indexing/weighted-index/range-query.spec.md`
  target: `docs/specs/weighted-index-system/range-query.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > range-query-spec`
- `infra-logger-spec`
  current: `docs/specs/infra/logger.spec.md`
  target: `docs/specs/apm-system/logger.spec.md`
  anchor: `apm-system`
  chain: `system-root > system-support > apm-system > infra-logger-spec`
- `ingest-admin-endpoints`
  current: `docs/specs/ingest/ingest-admin-endpoints.spec.md`
  target: `docs/specs/ingest/admin-api-system/ingest-admin-endpoints.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > admin-api-system > ingest-admin-endpoints`
- `ingest-admin-operations`
  current: `docs/specs/ingest/ingest-admin-operations.spec.md`
  target: `docs/specs/ingest/admin-api-system/ingest-admin-operations.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > admin-api-system > ingest-admin-operations`
- `ingest-interface-contract`
  current: `docs/specs/ingest/ingest-interface-contract.spec.md`
  target: `docs/specs/ingest/ingest-api-system/ingest-interface-contract.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > ingest-api-system > ingest-interface-contract`
- `ingest-interface-pipeline`
  current: `docs/specs/ingest/ingest-interface-pipeline.spec.md`
  target: `docs/specs/ingest/ingest-api-system/ingest-interface-pipeline.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > ingest-api-system > ingest-interface-pipeline`
- `ingest-runtime-middleware`
  current: `docs/specs/ingest/ingest-runtime-middleware.spec.md`
  target: `docs/specs/ingest/ingest-infra-system/ingest-runtime-middleware.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > ingest-infra-system > ingest-runtime-middleware`
- `ingest-runtime-operations`
  current: `docs/specs/ingest/ingest-runtime-operations.spec.md`
  target: `docs/specs/ingest/ingest-infra-system/ingest-runtime-operations.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > ingest-infra-system > ingest-runtime-operations`
- `pipeline-phase-flow`
  current: `docs/specs/ingest/pipeline-phase-flow.spec.md`
  target: `docs/specs/pipeline-system/pipeline-phase-flow.spec.md`
  anchor: `pipeline-system`
  chain: `system-root > system-infra > pipeline-system > pipeline-phase-flow`
- `perm-codec-interop`
  current: `docs/specs/permission/perm-codec-interop.spec.md`
  target: `docs/specs/permission/perm-codec-system/perm-codec-interop.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-codec-system > perm-codec-interop`
- `perm-codec-stack`
  current: `docs/specs/permission/perm-codec-stack.spec.md`
  target: `docs/specs/permission/perm-codec-system/perm-codec-stack.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-codec-system > perm-codec-stack`
- `perm-migration-algorithm`
  current: `docs/specs/permission/perm-migration-algorithm.spec.md`
  target: `docs/specs/permission/perm-migration-system/perm-migration-algorithm.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-migration-system > perm-migration-algorithm`
- `perm-migration-mapper`
  current: `docs/specs/permission/perm-migration-mapper.spec.md`
  target: `docs/specs/permission/perm-migration-system/perm-migration-mapper.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-migration-system > perm-migration-mapper`
- `perm-permission-code`
  current: `docs/specs/permission/perm-permission-code.spec.md`
  target: `docs/specs/permission/perm-external-system/perm-permission-code.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-external-system > perm-permission-code`
- `perm-resource-model`
  current: `docs/specs/permission/perm-resource-model.spec.md`
  target: `docs/specs/permission/perm-external-system/perm-resource-model.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-external-system > perm-resource-model`
- `perm-service-ref`
  current: `docs/specs/permission/perm-service-ref.spec.md`
  target: `docs/specs/permission/perm-external-system/perm-service-ref.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > perm-external-system > perm-service-ref`
- `permission-model-composition`
  current: `docs/specs/permission/permission-model-composition.spec.md`
  target: `docs/specs/permission/permission-model/permission-model-composition.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > permission-model > permission-model-composition`
- `permission-model-permission-set`
  current: `docs/specs/permission/permission-model-permission-set.spec.md`
  target: `docs/specs/permission/permission-model/permission-model-permission-set.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > permission-model > permission-model-permission-set`
- `permission-model-scoped-engine`
  current: `docs/specs/permission/permission-model-scoped-engine.spec.md`
  target: `docs/specs/permission/permission-model/permission-model-scoped-engine.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > permission-model > permission-model-scoped-engine`
- `permission-model-ternary-mask`
  current: `docs/specs/permission/permission-model-ternary-mask.spec.md`
  target: `docs/specs/permission/permission-model/permission-model-ternary-mask.spec.md`
  anchor: `permission-system`
  chain: `system-root > system-support > permission-system > permission-model > permission-model-ternary-mask`
- `platform-demo-api`
  current: `docs/specs/platform-demo-api/platform-demo-api.md`
  target: `docs/specs/viz-system/platform-demo-api-spec/platform-demo-api.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > platform-demo-api-spec > platform-demo-api`
- `prefix-auth_event`
  current: `docs/specs/prefix-catalog/prefix-auth_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-auth_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-auth_event`
- `prefix-build_event`
  current: `docs/specs/prefix-catalog/prefix-build_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-build_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-build_event`
- `prefix-bundle_observation`
  current: `docs/specs/prefix-catalog/prefix-bundle_observation.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-bundle_observation.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-bundle_observation`
- `prefix-cart_event`
  current: `docs/specs/prefix-catalog/prefix-cart_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-cart_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-cart_event`
- `prefix-cli_event`
  current: `docs/specs/prefix-catalog/prefix-cli_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-cli_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-cli_event`
- `prefix-cli_tracking`
  current: `docs/specs/prefix-catalog/prefix-cli_tracking.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-cli_tracking.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-cli_tracking`
- `prefix-content`
  current: `docs/specs/prefix-catalog/prefix-content.spec.md`
  target: `docs/specs/prefix-catalog/entity-prefix-group/prefix-content.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > entity-prefix-group > prefix-content`
- `prefix-contract_check`
  current: `docs/specs/prefix-catalog/prefix-contract_check.spec.md`
  target: `docs/specs/prefix-catalog/entity-prefix-group/prefix-contract_check.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > entity-prefix-group > prefix-contract_check`
- `prefix-convergence_event`
  current: `docs/specs/prefix-catalog/prefix-convergence_event.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-convergence_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-convergence_event`
- `prefix-data_policy`
  current: `docs/specs/prefix-catalog/prefix-data_policy.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-data_policy.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-data_policy`
- `prefix-decision_event`
  current: `docs/specs/prefix-catalog/prefix-decision_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-decision_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-decision_event`
- `prefix-decision_path`
  current: `docs/specs/prefix-catalog/prefix-decision_path.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-decision_path.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-decision_path`
- `prefix-deploy_event`
  current: `docs/specs/prefix-catalog/prefix-deploy_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-deploy_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-deploy_event`
- `prefix-dkg_decision_event`
  current: `docs/specs/prefix-catalog/prefix-dkg_decision_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-dkg_decision_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-dkg_decision_event`
- `prefix-dkg_event`
  current: `docs/specs/prefix-catalog/prefix-dkg_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-dkg_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-dkg_event`
- `prefix-dkg_observation_event`
  current: `docs/specs/prefix-catalog/prefix-dkg_observation_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-dkg_observation_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-dkg_observation_event`
- `prefix-edge_activity`
  current: `docs/specs/prefix-catalog/prefix-edge_activity.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-edge_activity.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-edge_activity`
- `prefix-endpoint`
  current: `docs/specs/prefix-catalog/prefix-endpoint.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-endpoint.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-endpoint`
- `prefix-engine_event`
  current: `docs/specs/prefix-catalog/prefix-engine_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-engine_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-engine_event`
- `prefix-escalation_event`
  current: `docs/specs/prefix-catalog/prefix-escalation_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-escalation_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-escalation_event`
- `prefix-event_classification`
  current: `docs/specs/prefix-catalog/prefix-event_classification.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-event_classification.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-event_classification`
- `prefix-event`
  current: `docs/specs/prefix-catalog/prefix-event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-event`
- `prefix-execution_context`
  current: `docs/specs/prefix-catalog/prefix-execution_context.spec.md`
  target: `docs/specs/prefix-catalog/entity-prefix-group/prefix-execution_context.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > entity-prefix-group > prefix-execution_context`
- `prefix-flow_point`
  current: `docs/specs/prefix-catalog/prefix-flow_point.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-flow_point.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-flow_point`
- `prefix-forcing_response`
  current: `docs/specs/prefix-catalog/prefix-forcing_response.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-forcing_response.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-forcing_response`
- `prefix-gate_execution`
  current: `docs/specs/prefix-catalog/prefix-gate_execution.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-gate_execution.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-gate_execution`
- `prefix-gate_point`
  current: `docs/specs/prefix-catalog/prefix-gate_point.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-gate_point.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-gate_point`
- `prefix-graph_event`
  current: `docs/specs/prefix-catalog/prefix-graph_event.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-graph_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-graph_event`
- `prefix-harness_guard`
  current: `docs/specs/prefix-catalog/prefix-harness_guard.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-harness_guard.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-harness_guard`
- `prefix-harness_process_step`
  current: `docs/specs/prefix-catalog/prefix-harness_process_step.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-harness_process_step.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-harness_process_step`
- `prefix-harness_transition`
  current: `docs/specs/prefix-catalog/prefix-harness_transition.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-harness_transition.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-harness_transition`
- `prefix-health_event`
  current: `docs/specs/prefix-catalog/prefix-health_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-health_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-health_event`
- `prefix-ingest_record`
  current: `docs/specs/prefix-catalog/prefix-ingest_record.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-ingest_record.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-ingest_record`
- `prefix-metric_aggregate`
  current: `docs/specs/prefix-catalog/prefix-metric_aggregate.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-metric_aggregate.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-metric_aggregate`
- `prefix-metric_point`
  current: `docs/specs/prefix-catalog/prefix-metric_point.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-metric_point.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-metric_point`
- `prefix-model_apply`
  current: `docs/specs/prefix-catalog/prefix-model_apply.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-model_apply.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-model_apply`
- `prefix-observation_event`
  current: `docs/specs/prefix-catalog/prefix-observation_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-observation_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-observation_event`
- `prefix-order_event`
  current: `docs/specs/prefix-catalog/prefix-order_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-order_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-order_event`
- `prefix-page_view`
  current: `docs/specs/prefix-catalog/prefix-page_view.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-page_view.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-page_view`
- `prefix-pattern_anomaly`
  current: `docs/specs/prefix-catalog/prefix-pattern_anomaly.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-pattern_anomaly.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-pattern_anomaly`
- `prefix-pattern_match`
  current: `docs/specs/prefix-catalog/prefix-pattern_match.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-pattern_match.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-pattern_match`
- `prefix-permission`
  current: `docs/specs/prefix-catalog/prefix-permission.spec.md`
  target: `docs/specs/prefix-catalog/policy-prefix-group/prefix-permission.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > policy-prefix-group > prefix-permission`
- `prefix-pipeline_point`
  current: `docs/specs/prefix-catalog/prefix-pipeline_point.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-pipeline_point.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-pipeline_point`
- `prefix-quality_event`
  current: `docs/specs/prefix-catalog/prefix-quality_event.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-quality_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-quality_event`
- `prefix-rbac`
  current: `docs/specs/prefix-catalog/prefix-rbac.spec.md`
  target: `docs/specs/prefix-catalog/policy-prefix-group/prefix-rbac.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > policy-prefix-group > prefix-rbac`
- `prefix-relational`
  current: `docs/specs/prefix-catalog/prefix-relational.spec.md`
  target: `docs/specs/prefix-catalog/relation-prefix-group/prefix-relational.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > relation-prefix-group > prefix-relational`
- `prefix-resource_lifecycle`
  current: `docs/specs/prefix-catalog/prefix-resource_lifecycle.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-resource_lifecycle.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-resource_lifecycle`
- `prefix-rpc_event`
  current: `docs/specs/prefix-catalog/prefix-rpc_event.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-rpc_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-rpc_event`
- `prefix-schema_event`
  current: `docs/specs/prefix-catalog/prefix-schema_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-schema_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-schema_event`
- `prefix-schema_validation`
  current: `docs/specs/prefix-catalog/prefix-schema_validation.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-schema_validation.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-schema_validation`
- `prefix-sdk_lifecycle`
  current: `docs/specs/prefix-catalog/prefix-sdk_lifecycle.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-sdk_lifecycle.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-sdk_lifecycle`
- `prefix-service`
  current: `docs/specs/prefix-catalog/prefix-service.spec.md`
  target: `docs/specs/prefix-catalog/entity-prefix-group/prefix-service.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > entity-prefix-group > prefix-service`
- `prefix-skill_execution`
  current: `docs/specs/prefix-catalog/prefix-skill_execution.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-skill_execution.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-skill_execution`
- `prefix-spec_event`
  current: `docs/specs/prefix-catalog/prefix-spec_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-spec_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-spec_event`
- `prefix-tag_lifecycle`
  current: `docs/specs/prefix-catalog/prefix-tag_lifecycle.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-tag_lifecycle.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-tag_lifecycle`
- `prefix-task_event`
  current: `docs/specs/prefix-catalog/prefix-task_event.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-task_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-task_event`
- `prefix-test_coverage`
  current: `docs/specs/prefix-catalog/prefix-test_coverage.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-test_coverage.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-test_coverage`
- `prefix-test_event`
  current: `docs/specs/prefix-catalog/prefix-test_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-test_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-test_event`
- `prefix-tracking`
  current: `docs/specs/prefix-catalog/prefix-tracking.spec.md`
  target: `docs/specs/prefix-catalog/entity-prefix-group/prefix-tracking.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > entity-prefix-group > prefix-tracking`
- `prefix-transition_event`
  current: `docs/specs/prefix-catalog/prefix-transition_event.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-transition_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-transition_event`
- `prefix-validation_event`
  current: `docs/specs/prefix-catalog/prefix-validation_event.spec.md`
  target: `docs/specs/prefix-catalog/event-prefix-group/prefix-validation_event.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > event-prefix-group > prefix-validation_event`
- `prefix-version_point`
  current: `docs/specs/prefix-catalog/prefix-version_point.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-version_point.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-version_point`
- `prefix-version_state`
  current: `docs/specs/prefix-catalog/prefix-version_state.spec.md`
  target: `docs/specs/prefix-catalog/observation-prefix-group/prefix-version_state.spec.md`
  anchor: `prefix-catalog-system`
  chain: `system-root > system-design-tools > prefix-catalog-system > observation-prefix-group > prefix-version_state`
- `decision-flow-quality-contract`
  current: `docs/specs/quality-gates/decision-flow-quality-contract.spec.md`
  target: `docs/specs/quality-gates/decision-flow-quality-bundle/decision-flow-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decision-flow-quality-bundle > decision-flow-quality-contract`
- `decode-quality-contract`
  current: `docs/specs/quality-gates/decode-quality-contract.spec.md`
  target: `docs/specs/quality-gates/decode-quality-bundle/decode-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decode-quality-bundle > decode-quality-contract`
- `definition-quality-contract`
  current: `docs/specs/quality-gates/definition-quality-contract.spec.md`
  target: `docs/specs/definition-catalog/definition-quality-contract.spec.md`
  anchor: `definition-quality-gates`
  chain: `quality-gates-system > definition-quality-gates > definition-quality-contract`
- `definition-service-quality-contract`
  current: `docs/specs/quality-gates/definition-service-quality-contract.spec.md`
  target: `docs/specs/quality-gates/definition-service-quality-bundle/definition-service-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > definition-service-quality-bundle > definition-service-quality-contract`
- `gate-decision-flow-build`
  current: `docs/specs/quality-gates/gate-decision-flow-build.spec.md`
  target: `docs/specs/quality-gates/decision-flow-quality-bundle/gate-decision-flow-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decision-flow-quality-bundle > gate-decision-flow-build`
- `gate-decision-flow-test`
  current: `docs/specs/quality-gates/gate-decision-flow-test.spec.md`
  target: `docs/specs/quality-gates/decision-flow-quality-bundle/gate-decision-flow-test.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decision-flow-quality-bundle > gate-decision-flow-test`
- `gate-decision-flow-typecheck`
  current: `docs/specs/quality-gates/gate-decision-flow-typecheck.spec.md`
  target: `docs/specs/quality-gates/decision-flow-quality-bundle/gate-decision-flow-typecheck.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decision-flow-quality-bundle > gate-decision-flow-typecheck`
- `gate-decode-build`
  current: `docs/specs/quality-gates/gate-decode-build.spec.md`
  target: `docs/specs/quality-gates/decode-quality-bundle/gate-decode-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decode-quality-bundle > gate-decode-build`
- `gate-decode-route`
  current: `docs/specs/quality-gates/gate-decode-route.spec.md`
  target: `docs/specs/quality-gates/decode-quality-bundle/gate-decode-route.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decode-quality-bundle > gate-decode-route`
- `gate-decode-test`
  current: `docs/specs/quality-gates/gate-decode-test.spec.md`
  target: `docs/specs/quality-gates/decode-quality-bundle/gate-decode-test.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > decode-quality-bundle > gate-decode-test`
- `gate-definition-quality-cli`
  current: `docs/specs/quality-gates/gate-definition-quality-cli.spec.md`
  target: `docs/specs/definition-catalog/gate-definition-quality-cli.spec.md`
  anchor: `definition-quality-gates`
  chain: `quality-gates-system > definition-quality-gates > gate-definition-quality-cli`
- `gate-definition-quality-spec-tracker`
  current: `docs/specs/quality-gates/gate-definition-quality-spec-tracker.spec.md`
  target: `docs/specs/definition-catalog/gate-definition-quality-spec-tracker.spec.md`
  anchor: `definition-quality-gates`
  chain: `quality-gates-system > definition-quality-gates > gate-definition-quality-spec-tracker`
- `gate-definition-quality-work-domain`
  current: `docs/specs/quality-gates/gate-definition-quality-work-domain.spec.md`
  target: `docs/specs/definition-catalog/gate-definition-quality-work-domain.spec.md`
  anchor: `definition-quality-gates`
  chain: `quality-gates-system > definition-quality-gates > gate-definition-quality-work-domain`
- `gate-definition-service-build`
  current: `docs/specs/quality-gates/gate-definition-service-build.spec.md`
  target: `docs/specs/quality-gates/definition-service-quality-bundle/gate-definition-service-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > definition-service-quality-bundle > gate-definition-service-build`
- `gate-definition-service-context`
  current: `docs/specs/quality-gates/gate-definition-service-context.spec.md`
  target: `docs/specs/quality-gates/definition-service-quality-bundle/gate-definition-service-context.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > definition-service-quality-bundle > gate-definition-service-context`
- `gate-definition-service-sync`
  current: `docs/specs/quality-gates/gate-definition-service-sync.spec.md`
  target: `docs/specs/quality-gates/definition-service-quality-bundle/gate-definition-service-sync.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > definition-service-quality-bundle > gate-definition-service-sync`
- `gate-ingest-build`
  current: `docs/specs/quality-gates/gate-ingest-build.spec.md`
  target: `docs/specs/quality-gates/ingest-quality-bundle/gate-ingest-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > ingest-quality-bundle > gate-ingest-build`
- `gate-ingest-sdk-bridge`
  current: `docs/specs/quality-gates/gate-ingest-sdk-bridge.spec.md`
  target: `docs/specs/quality-gates/ingest-quality-bundle/gate-ingest-sdk-bridge.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > ingest-quality-bundle > gate-ingest-sdk-bridge`
- `gate-ingest-test`
  current: `docs/specs/quality-gates/gate-ingest-test.spec.md`
  target: `docs/specs/quality-gates/ingest-quality-bundle/gate-ingest-test.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > ingest-quality-bundle > gate-ingest-test`
- `gate-query-build`
  current: `docs/specs/quality-gates/gate-query-build.spec.md`
  target: `docs/specs/quality-gates/query-quality-bundle/gate-query-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > query-quality-bundle > gate-query-build`
- `gate-query-gate-integration`
  current: `docs/specs/quality-gates/gate-query-gate-integration.spec.md`
  target: `docs/specs/quality-gates/query-quality-bundle/gate-query-gate-integration.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > query-quality-bundle > gate-query-gate-integration`
- `gate-query-test`
  current: `docs/specs/quality-gates/gate-query-test.spec.md`
  target: `docs/specs/quality-gates/query-quality-bundle/gate-query-test.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > query-quality-bundle > gate-query-test`
- `gate-registry-build`
  current: `docs/specs/quality-gates/gate-registry-build.spec.md`
  target: `docs/specs/quality-gates/registry-quality-bundle/gate-registry-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > registry-quality-bundle > gate-registry-build`
- `gate-registry-service-flow`
  current: `docs/specs/quality-gates/gate-registry-service-flow.spec.md`
  target: `docs/specs/quality-gates/registry-quality-bundle/gate-registry-service-flow.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > registry-quality-bundle > gate-registry-service-flow`
- `gate-registry-test`
  current: `docs/specs/quality-gates/gate-registry-test.spec.md`
  target: `docs/specs/quality-gates/registry-quality-bundle/gate-registry-test.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > registry-quality-bundle > gate-registry-test`
- `gate-work-domain-build`
  current: `docs/specs/quality-gates/gate-work-domain-build.spec.md`
  target: `docs/specs/quality-gates/work-domain-quality-bundle/gate-work-domain-build.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > work-domain-quality-bundle > gate-work-domain-build`
- `gate-work-domain-test`
  current: `docs/specs/quality-gates/gate-work-domain-test.spec.md`
  target: `docs/specs/quality-gates/work-domain-quality-bundle/gate-work-domain-test.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > work-domain-quality-bundle > gate-work-domain-test`
- `gate-work-domain-typecheck`
  current: `docs/specs/quality-gates/gate-work-domain-typecheck.spec.md`
  target: `docs/specs/quality-gates/work-domain-quality-bundle/gate-work-domain-typecheck.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > work-domain-quality-bundle > gate-work-domain-typecheck`
- `ingest-quality-contract`
  current: `docs/specs/quality-gates/ingest-quality-contract.spec.md`
  target: `docs/specs/quality-gates/ingest-quality-bundle/ingest-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > ingest-quality-bundle > ingest-quality-contract`
- `query-quality-contract`
  current: `docs/specs/quality-gates/query-quality-contract.spec.md`
  target: `docs/specs/quality-gates/query-quality-bundle/query-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > query-quality-bundle > query-quality-contract`
- `registry-quality-contract`
  current: `docs/specs/quality-gates/registry-quality-contract.spec.md`
  target: `docs/specs/quality-gates/registry-quality-bundle/registry-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > registry-quality-bundle > registry-quality-contract`
- `work-domain-quality-contract`
  current: `docs/specs/quality-gates/work-domain-quality-contract.spec.md`
  target: `docs/specs/quality-gates/work-domain-quality-bundle/work-domain-quality-contract.spec.md`
  anchor: `quality-gates-system`
  chain: `quality-gates-system > work-domain-quality-bundle > work-domain-quality-contract`
- `query-api-spec`
  current: `docs/specs/server/ingest/query.spec.md`
  target: `docs/specs/ingest/query.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > query-api-spec`
- `scenario-api-spec`
  current: `docs/specs/server/ingest/scenario.spec.md`
  target: `docs/specs/ingest/scenario.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > scenario-api-spec`
- `stream-api-spec`
  current: `docs/specs/server/ingest/stream.spec.md`
  target: `docs/specs/ingest/stream.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > stream-api-spec`
- `verdict-api-spec`
  current: `docs/specs/server/ingest/verdict.spec.md`
  target: `docs/specs/ingest/verdict.spec.md`
  anchor: `ingest-system`
  chain: `system-root > system-infra > ingest-system > verdict-api-spec`
- `registry-client-spec`
  current: `docs/specs/server/registry/client.spec.md`
  target: `docs/specs/registry-system/client.spec.md`
  anchor: `registry-system`
  chain: `system-root > system-infra > registry-system > registry-client-spec`
- `registry-events-spec`
  current: `docs/specs/server/registry/events.spec.md`
  target: `docs/specs/registry-system/events.spec.md`
  anchor: `registry-system`
  chain: `system-root > system-infra > registry-system > registry-events-spec`
- `registry-services-api-spec`
  current: `docs/specs/server/registry/services.spec.md`
  target: `docs/specs/registry-system/services.spec.md`
  anchor: `registry-system`
  chain: `system-root > system-infra > registry-system > registry-services-api-spec`
- `skill-cli-coord-commands`
  current: `docs/specs/skill-catalog/skill-cli-coord-commands.spec.md`
  target: `docs/specs/skill-catalog/cli-command-group/skill-cli-coord-commands.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > cli-command-group > skill-cli-coord-commands`
- `skill-cli-def-commands`
  current: `docs/specs/skill-catalog/skill-cli-def-commands.spec.md`
  target: `docs/specs/skill-catalog/cli-command-group/skill-cli-def-commands.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > cli-command-group > skill-cli-def-commands`
- `skill-cli-dkg-commands`
  current: `docs/specs/skill-catalog/skill-cli-dkg-commands.spec.md`
  target: `docs/specs/skill-catalog/cli-command-group/skill-cli-dkg-commands.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > cli-command-group > skill-cli-dkg-commands`
- `skill-cli-flow-commands`
  current: `docs/specs/skill-catalog/skill-cli-flow-commands.spec.md`
  target: `docs/specs/skill-catalog/cli-command-group/skill-cli-flow-commands.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > cli-command-group > skill-cli-flow-commands`
- `skill-def-audit`
  current: `docs/specs/skill-catalog/skill-def-audit.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-audit.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-audit`
- `skill-def-bottomup`
  current: `docs/specs/skill-catalog/skill-def-bottomup.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-bottomup.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-bottomup`
- `skill-def-boundary`
  current: `docs/specs/skill-catalog/skill-def-boundary.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-boundary.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-boundary`
- `skill-def-context`
  current: `docs/specs/skill-catalog/skill-def-context.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-context.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-context`
- `skill-def-explore`
  current: `docs/specs/skill-catalog/skill-def-explore.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-explore.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-explore`
- `skill-def-knowledge`
  current: `docs/specs/skill-catalog/skill-def-knowledge.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-knowledge.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-knowledge`
- `skill-def-level`
  current: `docs/specs/skill-catalog/skill-def-level.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-level.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-level`
- `skill-def-link`
  current: `docs/specs/skill-catalog/skill-def-link.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-link.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-link`
- `skill-def-new`
  current: `docs/specs/skill-catalog/skill-def-new.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-new.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-new`
- `skill-def-split`
  current: `docs/specs/skill-catalog/skill-def-split.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-split.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-split`
- `skill-def-state`
  current: `docs/specs/skill-catalog/skill-def-state.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-state.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-state`
- `skill-def-topdown`
  current: `docs/specs/skill-catalog/skill-def-topdown.spec.md`
  target: `docs/specs/skill-catalog/claude-skill-group/skill-def-topdown.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > claude-skill-group > skill-def-topdown`
- `skill-dkg-skill-cascade`
  current: `docs/specs/skill-catalog/skill-dkg-skill-cascade.spec.md`
  target: `docs/specs/skill-catalog/dkg-skill-group/skill-dkg-skill-cascade.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > dkg-skill-group > skill-dkg-skill-cascade`
- `skill-dkg-skill-catalog`
  current: `docs/specs/skill-catalog/skill-dkg-skill-catalog.spec.md`
  target: `docs/specs/skill-catalog/dkg-skill-group/skill-dkg-skill-catalog.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > dkg-skill-group > skill-dkg-skill-catalog`
- `skill-dkg-skill-decision`
  current: `docs/specs/skill-catalog/skill-dkg-skill-decision.spec.md`
  target: `docs/specs/skill-catalog/dkg-skill-group/skill-dkg-skill-decision.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > dkg-skill-group > skill-dkg-skill-decision`
- `skill-dkg-skill-migrator`
  current: `docs/specs/skill-catalog/skill-dkg-skill-migrator.spec.md`
  target: `docs/specs/skill-catalog/dkg-skill-group/skill-dkg-skill-migrator.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > dkg-skill-group > skill-dkg-skill-migrator`
- `skill-dkg-skill-version-event`
  current: `docs/specs/skill-catalog/skill-dkg-skill-version-event.spec.md`
  target: `docs/specs/skill-catalog/dkg-skill-group/skill-dkg-skill-version-event.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > dkg-skill-group > skill-dkg-skill-version-event`
- `skill-e2e-test`
  current: `docs/specs/skill-catalog/skill-e2e-test.spec.md`
  target: `docs/specs/skill-catalog/automation-skill-group/skill-e2e-test.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > automation-skill-group > skill-e2e-test`
- `skill-gform-parser`
  current: `docs/specs/skill-catalog/skill-gform-parser.spec.md`
  target: `docs/specs/skill-catalog/automation-skill-group/skill-gform-parser.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > automation-skill-group > skill-gform-parser`
- `skill-ralph-tui-create-beads-rust`
  current: `docs/specs/skill-catalog/skill-ralph-tui-create-beads-rust.spec.md`
  target: `docs/specs/skill-catalog/ralph-tui-skill-group/skill-ralph-tui-create-beads-rust.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > ralph-tui-skill-group > skill-ralph-tui-create-beads-rust`
- `skill-ralph-tui-create-beads`
  current: `docs/specs/skill-catalog/skill-ralph-tui-create-beads.spec.md`
  target: `docs/specs/skill-catalog/ralph-tui-skill-group/skill-ralph-tui-create-beads.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > ralph-tui-skill-group > skill-ralph-tui-create-beads`
- `skill-ralph-tui-create-json`
  current: `docs/specs/skill-catalog/skill-ralph-tui-create-json.spec.md`
  target: `docs/specs/skill-catalog/ralph-tui-skill-group/skill-ralph-tui-create-json.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > ralph-tui-skill-group > skill-ralph-tui-create-json`
- `skill-ralph-tui-prd`
  current: `docs/specs/skill-catalog/skill-ralph-tui-prd.spec.md`
  target: `docs/specs/skill-catalog/ralph-tui-skill-group/skill-ralph-tui-prd.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > ralph-tui-skill-group > skill-ralph-tui-prd`
- `skill-spec-lifecycle`
  current: `docs/specs/skill-catalog/skill-spec-lifecycle.spec.md`
  target: `docs/specs/skill-catalog/automation-skill-group/skill-spec-lifecycle.spec.md`
  anchor: `skill-catalog-system`
  chain: `system-root > system-support > skill-catalog-system > automation-skill-group > skill-spec-lifecycle`
- `axis-boundary-criteria`
  current: `docs/specs/spec-engine-system/axis-boundary-criteria.spec.md`
  target: `docs/specs/spec-engine-system/spec-reference-system/axis-boundary-criteria.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-reference-system > axis-boundary-criteria`
- `axis-boundary-patterns`
  current: `docs/specs/spec-engine-system/axis-boundary-patterns.spec.md`
  target: `docs/specs/spec-engine-system/spec-reference-system/axis-boundary-patterns.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-reference-system > axis-boundary-patterns`
- `convergence-advisors`
  current: `docs/specs/spec-engine-system/convergence-advisors.spec.md`
  target: `docs/specs/spec-engine-system/convergence-layer-group/convergence-advisors.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > convergence-layer-group > convergence-advisors`
- `convergence-comparators`
  current: `docs/specs/spec-engine-system/convergence-comparators.spec.md`
  target: `docs/specs/spec-engine-system/convergence-layer-group/convergence-comparators.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > convergence-layer-group > convergence-comparators`
- `spec-arch-interceptors`
  current: `docs/specs/spec-engine-system/spec-arch-interceptors.spec.md`
  target: `docs/specs/spec-engine-system/spec-arch-group/spec-arch-interceptors.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-arch-group > spec-arch-interceptors`
- `spec-arch-layers`
  current: `docs/specs/spec-engine-system/spec-arch-layers.spec.md`
  target: `docs/specs/spec-engine-system/spec-arch-group/spec-arch-layers.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-arch-group > spec-arch-layers`
- `spec-arch-nestjs`
  current: `docs/specs/spec-engine-system/spec-arch-nestjs.spec.md`
  target: `docs/specs/spec-engine-system/spec-arch-group/spec-arch-nestjs.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-arch-group > spec-arch-nestjs`
- `spec-architecture-stack`
  current: `docs/specs/spec-engine-system/spec-architecture-stack.spec.md`
  target: `docs/specs/spec-engine-system/spec-architecture-system/spec-architecture-stack.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-architecture-system > spec-architecture-stack`
- `spec-core-identifiers`
  current: `docs/specs/spec-engine-system/spec-core-identifiers.spec.md`
  target: `docs/specs/spec-engine-system/spec-core-types-group/spec-core-identifiers.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-core-types-group > spec-core-identifiers`
- `spec-core-registry`
  current: `docs/specs/spec-engine-system/spec-core-registry.spec.md`
  target: `docs/specs/spec-engine-system/spec-core-types-group/spec-core-registry.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-core-types-group > spec-core-registry`
- `spec-linking-rules`
  current: `docs/specs/spec-engine-system/spec-linking-rules.spec.md`
  target: `docs/specs/spec-engine-system/spec-reference-system/spec-linking-rules.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-reference-system > spec-linking-rules`
- `spec-phases-roadmap`
  current: `docs/specs/spec-engine-system/spec-phases-roadmap.spec.md`
  target: `docs/specs/spec-engine-system/spec-phases-group/spec-phases-roadmap.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-phases-group > spec-phases-roadmap`
- `spec-phases-runtime`
  current: `docs/specs/spec-engine-system/spec-phases-runtime.spec.md`
  target: `docs/specs/spec-engine-system/spec-phases-group/spec-phases-runtime.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-phases-group > spec-phases-runtime`
- `spec-prop-codegen`
  current: `docs/specs/spec-engine-system/spec-prop-codegen.spec.md`
  target: `docs/specs/spec-engine-system/spec-prop-system/spec-prop-codegen.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-prop-system > spec-prop-codegen`
- `spec-prop-dkg-record`
  current: `docs/specs/spec-engine-system/spec-prop-dkg-record.spec.md`
  target: `docs/specs/spec-engine-system/spec-prop-system/spec-prop-dkg-record.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-prop-system > spec-prop-dkg-record`
- `spec-prop-notify`
  current: `docs/specs/spec-engine-system/spec-prop-notify.spec.md`
  target: `docs/specs/spec-engine-system/spec-prop-system/spec-prop-notify.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-prop-system > spec-prop-notify`
- `spec-prop-publish`
  current: `docs/specs/spec-engine-system/spec-prop-publish.spec.md`
  target: `docs/specs/spec-engine-system/spec-prop-system/spec-prop-publish.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-prop-system > spec-prop-publish`
- `spec-temporal-capture`
  current: `docs/specs/spec-engine-system/spec-temporal-capture.spec.md`
  target: `docs/specs/spec-engine-system/spec-architecture-system/spec-temporal-capture.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-architecture-system > spec-temporal-capture`
- `spec-temporal-infra`
  current: `docs/specs/spec-engine-system/spec-temporal-infra.spec.md`
  target: `docs/specs/spec-engine-system/spec-architecture-system/spec-temporal-infra.spec.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-architecture-system > spec-temporal-infra`
- `spec-next-phase`
  current: `docs/specs/spec-engine/next-phase-plan.md`
  target: `docs/specs/spec-engine-system/next-phase-plan.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > spec-next-phase`
- `prefix-guide-deploy-pattern`
  current: `docs/specs/spec-engine/prefix-guide-deploy-pattern.md`
  target: `docs/specs/spec-engine-system/prefix-guide/prefix-guide-deploy-pattern.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > prefix-guide > prefix-guide-deploy-pattern`
- `prefix-guide-env-override`
  current: `docs/specs/spec-engine/prefix-guide-env-override.md`
  target: `docs/specs/spec-engine-system/prefix-guide/prefix-guide-env-override.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > prefix-guide > prefix-guide-env-override`
- `prefix-guide-modeling`
  current: `docs/specs/spec-engine/prefix-guide-modeling.md`
  target: `docs/specs/spec-engine-system/prefix-guide/prefix-guide-modeling.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > prefix-guide > prefix-guide-modeling`
- `prefix-guide-observation-point`
  current: `docs/specs/spec-engine/prefix-guide-observation-point.md`
  target: `docs/specs/spec-engine-system/prefix-guide/prefix-guide-observation-point.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > prefix-guide > prefix-guide-observation-point`
- `prefix-guide`
  current: `docs/specs/spec-engine/prefix-guide.md`
  target: `docs/specs/spec-engine-system/prefix-guide.md`
  anchor: `spec-engine-system`
  chain: `system-root > system-design-tools > spec-engine-system > prefix-guide`
- `spec-analyzer-drift`
  current: `docs/specs/spec-verification/spec-analyzer-drift.md`
  target: `docs/specs/spec-verification/spec-analyzer-system/spec-analyzer-drift.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-analyzer-system > spec-analyzer-drift`
- `spec-analyzer-extractor`
  current: `docs/specs/spec-verification/spec-analyzer-extractor.md`
  target: `docs/specs/spec-verification/spec-analyzer-system/spec-analyzer-extractor.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-analyzer-system > spec-analyzer-extractor`
- `spec-analyzer-types`
  current: `docs/specs/spec-verification/spec-analyzer-types.md`
  target: `docs/specs/spec-verification/spec-analyzer-system/spec-analyzer-types.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-analyzer-system > spec-analyzer-types`
- `spec-tracker-collector`
  current: `docs/specs/spec-verification/spec-tracker-collector.md`
  target: `docs/specs/spec-verification/spec-tracker-system/spec-tracker-collector.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-tracker-system > spec-tracker-collector`
- `spec-tracker-reporter`
  current: `docs/specs/spec-verification/spec-tracker-reporter.md`
  target: `docs/specs/spec-verification/spec-tracker-system/spec-tracker-reporter.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-tracker-system > spec-tracker-reporter`
- `spec-tracker-types`
  current: `docs/specs/spec-verification/spec-tracker-types.md`
  target: `docs/specs/spec-verification/spec-tracker-system/spec-tracker-types.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-tracker-system > spec-tracker-types`
- `spec-tracker-vitest-adapter`
  current: `docs/specs/spec-verification/spec-tracker-vitest-adapter.md`
  target: `docs/specs/spec-verification/spec-tracker-system/spec-tracker-vitest-adapter.md`
  anchor: `spec-verification-system`
  chain: `spec-verification-system > spec-tracker-system > spec-tracker-vitest-adapter`
- `storage-adapters-spec`
  current: `docs/specs/storage/adapters.spec.md`
  target: `docs/specs/storage-system/adapters.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > storage-adapters-spec`
- `storage-schema-spec`
  current: `docs/specs/storage/schema.spec.md`
  target: `docs/specs/storage-system/schema.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > storage-schema-spec`
- `error-handling-convention`
  current: `docs/specs/system/error-handling-convention.spec.md`
  target: `docs/specs/system/system-support/error-handling-convention.spec.md`
  anchor: `system-root`
  chain: `system-root > system-support > error-handling-convention`
- `tag-management-spec`
  current: `docs/specs/system/tag-management.spec.md`
  target: `docs/specs/storage-system/tag-management.spec.md`
  anchor: `storage-system`
  chain: `system-root > system-libraries > storage-system > tag-management-spec`
- `task-pipeline-unit`
  current: `docs/specs/tasks/unit-2-pipeline.md`
  target: `docs/specs/pipeline-system/unit-2-pipeline.md`
  anchor: `pipeline-system`
  chain: `system-root > system-infra > pipeline-system > task-pipeline-unit`
- `docs-explorer-spec`
  current: `docs/specs/ui/docs-explorer.spec.md`
  target: `docs/specs/viz-system/docs-explorer.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > docs-explorer-spec`
- `inspector-engine`
  current: `docs/specs/ui/inspector-engine.spec.md`
  target: `docs/specs/viz-system/inspector-engine.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > inspector-engine`
- `motion-editor-component`
  current: `docs/specs/ui/motion-editor-component.spec.md`
  target: `docs/specs/viz-system/motion-editor-component.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > motion-editor-component`
- `platform-demo-api-spec`
  current: `docs/specs/ui/platform-demo-api.spec.md`
  target: `docs/specs/viz-system/platform-demo-api.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > platform-demo-api-spec`
- `registry-ui-spec`
  current: `docs/specs/ui/registry-ui.spec.md`
  target: `docs/specs/viz-system/registry-ui.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > registry-ui-spec`
- `form-builder-renderer`
  current: `docs/specs/viz-system/form-builder-renderer.spec.md`
  target: `docs/specs/viz-system/viz-roleplay-system/form-builder-renderer.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-roleplay-system > form-builder-renderer`
- `form-builder-structure`
  current: `docs/specs/viz-system/form-builder-structure.spec.md`
  target: `docs/specs/viz-system/viz-roleplay-system/form-builder-structure.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-roleplay-system > form-builder-structure`
- `graph-renderer-live`
  current: `docs/specs/viz-system/graph-renderer-live.spec.md`
  target: `docs/specs/viz-system/viz-surface-system/graph-renderer-live.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-surface-system > graph-renderer-live`
- `graph-renderer-pipeline`
  current: `docs/specs/viz-system/graph-renderer-pipeline.spec.md`
  target: `docs/specs/viz-system/viz-surface-system/graph-renderer-pipeline.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-surface-system > graph-renderer-pipeline`
- `motion-content-contract`
  current: `docs/specs/viz-system/motion-content-contract.spec.md`
  target: `docs/specs/viz-system/viz-language-system/motion-content-contract.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-language-system > motion-content-contract`
- `qa-bridge-runtime`
  current: `docs/specs/viz-system/qa-bridge-runtime.spec.md`
  target: `docs/specs/viz-system/viz-roleplay-system/qa-bridge-runtime.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-roleplay-system > qa-bridge-runtime`
- `rlsc-core-model`
  current: `docs/specs/viz-system/rlsc-core-model.spec.md`
  target: `docs/specs/viz-system/viz-language-system/rlsc-core-model.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-language-system > rlsc-core-model`
- `rlsc-integration`
  current: `docs/specs/viz-system/rlsc-integration.spec.md`
  target: `docs/specs/viz-system/viz-language-system/rlsc-integration.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-language-system > rlsc-integration`
- `viz-panel-layout`
  current: `docs/specs/viz-system/viz-panel-layout.spec.md`
  target: `docs/specs/viz-system/viz-surface-system/viz-panel-layout.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > viz-surface-system > viz-panel-layout`
- `api-client-spec`
  current: `docs/specs/web/api-client.spec.md`
  target: `docs/specs/viz-system/api-client.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > api-client-spec`
- `iframe-protocol-spec`
  current: `docs/specs/web/iframe-protocol.spec.md`
  target: `docs/specs/viz-system/iframe-protocol.spec.md`
  anchor: `viz-system`
  chain: `system-root > system-frontend > viz-system > iframe-protocol-spec`
- `wi-capacity-planning`
  current: `docs/specs/weighted-index-system/wi-capacity-planning.spec.md`
  target: `docs/specs/weighted-index-system/wi-pack-format-system/wi-capacity-planning.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-pack-format-system > wi-capacity-planning`
- `wi-format-registry`
  current: `docs/specs/weighted-index-system/wi-format-registry.spec.md`
  target: `docs/specs/weighted-index-system/wi-pack-format-system/wi-format-registry.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-pack-format-system > wi-format-registry`
- `wi-hex-ops`
  current: `docs/specs/weighted-index-system/wi-hex-ops.spec.md`
  target: `docs/specs/weighted-index-system/wi-pack-format-system/wi-hex-ops.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-pack-format-system > wi-hex-ops`
- `wi-layout-protocol`
  current: `docs/specs/weighted-index-system/wi-layout-protocol.spec.md`
  target: `docs/specs/weighted-index-system/wi-pack-format-system/wi-layout-protocol.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-pack-format-system > wi-layout-protocol`
- `wi-pack-format-def`
  current: `docs/specs/weighted-index-system/wi-pack-format-def.spec.md`
  target: `docs/specs/weighted-index-system/wi-pack-format-system/wi-pack-format-def.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-pack-format-system > wi-pack-format-def`
- `wi-semantic-address`
  current: `docs/specs/weighted-index-system/wi-semantic-address.spec.md`
  target: `docs/specs/weighted-index-system/wi-pack-format-system/wi-semantic-address.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-pack-format-system > wi-semantic-address`
- `wi-trace-axes`
  current: `docs/specs/weighted-index-system/wi-trace-axes.spec.md`
  target: `docs/specs/weighted-index-system/wi-trace-group/wi-trace-axes.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-trace-group > wi-trace-axes`
- `wi-trace-propagation`
  current: `docs/specs/weighted-index-system/wi-trace-propagation.spec.md`
  target: `docs/specs/weighted-index-system/wi-trace-group/wi-trace-propagation.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-trace-group > wi-trace-propagation`
- `wi-trace-protocol`
  current: `docs/specs/weighted-index-system/wi-trace-protocol.spec.md`
  target: `docs/specs/weighted-index-system/wi-trace-group/wi-trace-protocol.spec.md`
  anchor: `wi-system`
  chain: `system-root > system-libraries > wi-system > wi-trace-group > wi-trace-protocol`

## Blocked

- none

