// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './schema.registry.js';
import { SchemaValidator } from './schema.validator.js';
import type { SchemaDef, SchemaFragment } from './schema.types.js';

// ── Fragments ───────────────────────────────────────

const HasActor: SchemaFragment = {
  id: 'HasActor',
  axes: {
    actor_ref: { axisId: 'actor_ref', required: false, multi: false, valueType: 'ref' },
  },
};

const HasTarget: SchemaFragment = {
  id: 'HasTarget',
  axes: {
    target_ref: { axisId: 'target_ref', required: false, multi: false, valueType: 'ref' },
  },
};

// ── Schemas ─────────────────────────────────────────

const eventBase: SchemaDef = {
  id: 'event.base',
  version: 'v1',
  category: 'event',
  use: ['HasActor', 'HasTarget'],
  axes: {
    event_kind: {
      axisId: 'event_kind',
      required: true,
      multi: false,
      valueType: 'vocabulary',
      vocabularyRef: 'event_name',
    },
    action: {
      axisId: 'action',
      required: true,
      multi: false,
      valueType: 'vocabulary',
      vocabularyRef: 'cart_action',
    },
  },
  constraints: [
    { rule: 'maxCount', axis: 'actor_ref', value: 1 },
    { rule: 'maxCount', axis: 'target_ref', value: 1 },
  ],
};

const entityBase: SchemaDef = {
  id: 'entity.base',
  version: 'v1',
  category: 'entity',
  axes: {
    entity_kind: { axisId: 'entity_kind', required: true, multi: false, valueType: 'vocabulary' },
    identity: { axisId: 'identity', required: true, multi: false, valueType: 'ref' },
    state: { axisId: 'state', required: false, multi: false, valueType: 'vocabulary' },
  },
};

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
    registry.registerFragment(HasActor);
    registry.registerFragment(HasTarget);
    registry.registerSchema(eventBase);
    registry.registerSchema(entityBase);
  });

  it('registers and retrieves schemas', () => {
    expect(registry.hasSchema('event.base')).toBe(true);
    expect(registry.getSchema('event.base').category).toBe('event');
    expect(registry.schemaCount).toBe(2);
  });

  it('retrieves by category', () => {
    const events = registry.getByCategory('event');
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('event.base');

    const entities = registry.getByCategory('entity');
    expect(entities).toHaveLength(1);
  });

  it('registers and retrieves fragments', () => {
    expect(registry.hasFragment('HasActor')).toBe(true);
    expect(registry.fragmentCount).toBe(2);
  });

  describe('resolveSchema', () => {
    it('merges fragment axes into schema', () => {
      const resolved = registry.resolveSchema('event.base');

      // fragment axes가 합성됨
      expect(resolved.axes).toHaveProperty('actor_ref');
      expect(resolved.axes).toHaveProperty('target_ref');
      // schema 자체 axes도 존재
      expect(resolved.axes).toHaveProperty('event_kind');
      expect(resolved.axes).toHaveProperty('action');
      // use가 제거됨
      expect(resolved.use).toBeUndefined();
    });

    it('returns schema as-is when no fragments', () => {
      const resolved = registry.resolveSchema('entity.base');
      expect(resolved.axes).toEqual(entityBase.axes);
    });

    it('schema axes override fragment axes on conflict', () => {
      // actor_ref를 override하는 스키마
      registry.registerSchema({
        id: 'event.custom',
        version: 'v1',
        category: 'event',
        use: ['HasActor'],
        axes: {
          actor_ref: { axisId: 'actor_ref', required: true, multi: false, valueType: 'ref' }, // required로 override
          action: { axisId: 'action', required: true, multi: false, valueType: 'vocabulary' },
        },
      });

      const resolved = registry.resolveSchema('event.custom');
      expect(resolved.axes.actor_ref.required).toBe(true); // schema 쪽이 우선
    });
  });
});

describe('SchemaValidator', () => {
  let registry: SchemaRegistry;
  let validator: SchemaValidator;

  beforeEach(() => {
    registry = new SchemaRegistry();
    registry.registerFragment(HasActor);
    registry.registerFragment(HasTarget);
    registry.registerSchema(eventBase);
    registry.registerSchema(entityBase);
    validator = new SchemaValidator(registry);
  });

  it('validates valid event data', () => {
    const result = validator.validate('event.base', {
      event_kind: 'cart_event',
      action: 'add',
      actor_ref: 'member:42',
      target_ref: 'item:1',
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing required axis (Layer 2)', () => {
    const result = validator.validate('event.base', {
      action: 'add',
      // event_kind 누락 (required)
    });

    expect(result.valid).toBe(false);
    const reqError = result.errors.find((e) => e.rule === 'required' && e.axis === 'event_kind');
    expect(reqError).toBeDefined();
    expect(reqError!.layer).toBe(2);
  });

  it('detects unknown axis (Layer 1)', () => {
    const result = validator.validate('event.base', {
      event_kind: 'cart_event',
      action: 'add',
      unknown_field: 'oops',
    });

    expect(result.valid).toBe(false);
    const unknownError = result.errors.find((e) => e.rule === 'unknownAxis');
    expect(unknownError).toBeDefined();
    expect(unknownError!.layer).toBe(1);
    expect(unknownError!.axis).toBe('unknown_field');
  });

  it('detects wrong type (Layer 0)', () => {
    const result = validator.validate('event.base', {
      event_kind: 123, // vocabulary는 string|number OK
      action: true, // boolean은 안 됨
    });

    expect(result.valid).toBe(false);
    const typeError = result.errors.find((e) => e.rule === 'type' && e.axis === 'action');
    expect(typeError).toBeDefined();
    expect(typeError!.layer).toBe(0);
  });

  it('detects multi violation (Layer 0)', () => {
    const result = validator.validate('event.base', {
      event_kind: 'cart_event',
      action: ['add', 'remove'], // multi: false인데 배열
    });

    expect(result.valid).toBe(false);
    const multiError = result.errors.find((e) => e.rule === 'multi');
    expect(multiError).toBeDefined();
  });

  it('validates entity schema', () => {
    const result = validator.validate('entity.base', {
      entity_kind: 'team',
      identity: 'team:42',
    });

    expect(result.valid).toBe(true);
  });
});
