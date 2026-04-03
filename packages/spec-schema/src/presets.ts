/**
 * 표준 schema + fragment 프리셋.
 *
 * schema-layer.md에서 정의한 6 기본 카테고리의 base schema와
 * 공통 fragment를 기본 제공한다.
 *
 * 별도 파일 없이 바로 validate 가능.
 */

import type { SchemaDef, SchemaFragment } from "./schema.types.js";
import type { SchemaRegistry } from "./schema.registry.js";

// ── Fragments ───────────────────────────────────────

export const FRAGMENT_HAS_ACTOR: SchemaFragment = {
  id: "HasActor",
  axes: {
    actor_ref: { axisId: "actor_ref", required: false, multi: false, valueType: "ref" },
  },
};

export const FRAGMENT_HAS_TARGET: SchemaFragment = {
  id: "HasTarget",
  axes: {
    target_ref: { axisId: "target_ref", required: false, multi: false, valueType: "ref" },
  },
};

export const FRAGMENT_HAS_OUTCOME: SchemaFragment = {
  id: "HasOutcome",
  axes: {
    outcome: { axisId: "outcome", required: false, multi: false, valueType: "vocabulary" },
  },
};

export const FRAGMENT_IDENTIFIED: SchemaFragment = {
  id: "Identified",
  axes: {
    identity: { axisId: "identity", required: true, multi: false, valueType: "ref" },
  },
};

export const DEFAULT_FRAGMENTS: readonly SchemaFragment[] = [
  FRAGMENT_HAS_ACTOR,
  FRAGMENT_HAS_TARGET,
  FRAGMENT_HAS_OUTCOME,
  FRAGMENT_IDENTIFIED,
];

// ── Base Schemas ────────────────────────────────────

export const SCHEMA_EVENT_BASE: SchemaDef = {
  id: "event.base",
  version: "v1",
  category: "event",
  use: ["HasActor", "HasTarget"],
  axes: {
    event_kind: { axisId: "event_kind", required: true, multi: false, valueType: "vocabulary" },
    action: { axisId: "action", required: true, multi: false, valueType: "vocabulary" },
  },
  constraints: [
    { rule: "maxCount", axis: "actor_ref", value: 1 },
    { rule: "maxCount", axis: "target_ref", value: 1 },
  ],
};

export const SCHEMA_ENTITY_BASE: SchemaDef = {
  id: "entity.base",
  version: "v1",
  category: "entity",
  use: ["Identified"],
  axes: {
    entity_kind: { axisId: "entity_kind", required: true, multi: false, valueType: "vocabulary" },
    state: { axisId: "state", required: false, multi: false, valueType: "vocabulary" },
  },
};

export const SCHEMA_RELATION_BASE: SchemaDef = {
  id: "relation.base",
  version: "v1",
  category: "relation",
  axes: {
    source_ref: { axisId: "source_ref", required: true, multi: false, valueType: "ref" },
    relation_kind: { axisId: "relation_kind", required: true, multi: false, valueType: "vocabulary" },
    target_ref: { axisId: "target_ref", required: true, multi: false, valueType: "ref" },
    qualifier: { axisId: "qualifier", required: false, multi: true, valueType: "vocabulary" },
  },
};

export const SCHEMA_STATE_BASE: SchemaDef = {
  id: "state.base",
  version: "v1",
  category: "state",
  axes: {
    subject_ref: { axisId: "subject_ref", required: true, multi: false, valueType: "ref" },
    state_kind: { axisId: "state_kind", required: true, multi: false, valueType: "vocabulary" },
    state_value: { axisId: "state_value", required: true, multi: false, valueType: "vocabulary" },
    scope: { axisId: "scope", required: false, multi: false, valueType: "coordinate" },
  },
};

export const SCHEMA_POLICY_BASE: SchemaDef = {
  id: "policy.base",
  version: "v1",
  category: "policy",
  axes: {
    subject: { axisId: "subject", required: true, multi: false, valueType: "ref" },
    action: { axisId: "action", required: true, multi: false, valueType: "vocabulary" },
    resource: { axisId: "resource", required: true, multi: false, valueType: "vocabulary" },
    effect: { axisId: "effect", required: true, multi: false, valueType: "vocabulary" },
    scope: { axisId: "scope", required: false, multi: false, valueType: "coordinate" },
  },
};

export const SCHEMA_OBSERVATION_BASE: SchemaDef = {
  id: "observation.base",
  version: "v1",
  category: "observation",
  axes: {
    observed_ref: { axisId: "observed_ref", required: true, multi: false, valueType: "coordinate" },
    observation_kind: { axisId: "observation_kind", required: true, multi: false, valueType: "vocabulary" },
    metric: { axisId: "metric", required: false, multi: false, valueType: "literal" },
    trace_id: { axisId: "trace_id", required: false, multi: false, valueType: "literal" },
  },
};

export const DEFAULT_SCHEMAS: readonly SchemaDef[] = [
  SCHEMA_EVENT_BASE,
  SCHEMA_ENTITY_BASE,
  SCHEMA_RELATION_BASE,
  SCHEMA_STATE_BASE,
  SCHEMA_POLICY_BASE,
  SCHEMA_OBSERVATION_BASE,
];

// ── Registry Helper ─────────────────────────────────

/**
 * 기본 fragment + schema를 registry에 등록한다.
 * 이미 등록된 것은 건너뛴다.
 */
export function registerPresets(registry: SchemaRegistry): void {
  for (const fragment of DEFAULT_FRAGMENTS) {
    if (!registry.hasFragment(fragment.id)) {
      registry.registerFragment(fragment);
    }
  }
  for (const schema of DEFAULT_SCHEMAS) {
    if (!registry.hasSchema(schema.id)) {
      registry.registerSchema(schema);
    }
  }
}
