import { describe, expect, it } from 'vitest';
import {
  allCoreEvents,
  coreEventMap,
  coreEventsByCategory,
  isCoreEvent,
  isV1MinimalEvent,
  payloadGuideMap,
  payloadGuides,
  getPayloadGuide,
  v1MinimalSet,
} from './index.js';
import type { EventCategory, GraphRole } from './types.js';

const expectedCategoryCounts = {
  navigation: 7,
  interaction: 10,
  form: 5,
  session: 6,
  network: 8,
  execution: 16,
  outcome: 7,
  quality: 8,
  infrastructure: 16,
} satisfies Record<EventCategory, number>;

const expectedV1MinimalKeys = [
  'page_view',
  'screen_view',
  'route_change',
  'app_open',
  'click',
  'tap',
  'input_change',
  'form_submit',
  'session_start',
  'session_end',
  'http_request',
  'http_response',
  'sdk_init',
  'sdk_flush',
  'task_start',
  'task_finish',
  'success',
  'failure',
  'error',
  'assertion',
] as const;

const expectedRequiredFields = {
  page_view: ['page'],
  screen_view: ['screen'],
  route_change: ['from', 'to'],
  app_open: [],
  click: ['element_id'],
  tap: ['element_id'],
  input_change: ['field_name'],
  form_submit: ['form_id'],
  session_start: [],
  session_end: [],
  http_request: ['method', 'route'],
  http_response: ['method', 'route', 'status_code'],
  sdk_init: [],
  sdk_flush: [],
  task_start: ['task_name'],
  task_finish: ['task_name'],
  success: [],
  failure: ['reason'],
  error: ['error_type'],
  assertion: ['assertion_key', 'passed'],
} satisfies Record<(typeof expectedV1MinimalKeys)[number], readonly string[]>;

const validGraphRoles = [
  'entry',
  'transition',
  'terminal',
  'observation',
] as const satisfies readonly GraphRole[];

describe('@qa-sdk/event-catalog', () => {
  it('registers all core events with the expected category counts', () => {
    expect(allCoreEvents).toHaveLength(83);
    expect(new Set(allCoreEvents.map((event) => event.event_key)).size).toBe(83);

    const categoryCounts = Object.fromEntries(
      Object.entries(coreEventsByCategory).map(([category, events]) => [category, events.length]),
    );

    expect(categoryCounts).toEqual(expectedCategoryCounts);
  });

  it('supports looking up every core event by event key', () => {
    expect(coreEventMap.size).toBe(allCoreEvents.length);

    for (const event of allCoreEvents) {
      expect(coreEventMap.get(event.event_key)).toBe(event);
    }
  });

  it('identifies core events and rejects unknown event keys', () => {
    for (const event of allCoreEvents) {
      expect(isCoreEvent(event.event_key)).toBe(true);
    }

    expect(isCoreEvent('not_registered')).toBe(false);
    expect(coreEventMap.get('not_registered')).toBeUndefined();
  });

  it('exposes the v1 minimal set of 20 expected events', () => {
    expect(v1MinimalSet).toHaveLength(20);
    expect(v1MinimalSet.map((event) => event.event_key)).toEqual(expectedV1MinimalKeys);

    for (const eventKey of expectedV1MinimalKeys) {
      expect(coreEventMap.has(eventKey)).toBe(true);
    }
  });

  it('identifies v1 minimal events correctly', () => {
    for (const eventKey of expectedV1MinimalKeys) {
      expect(isV1MinimalEvent(eventKey)).toBe(true);
    }

    for (const eventKey of ['scroll', 'form_submit_success', 'complete', 'warning']) {
      expect(isV1MinimalEvent(eventKey)).toBe(false);
    }
  });

  it('provides payload guides for the 20 v1 minimal events', () => {
    const v1Guides = payloadGuides.filter((guide) =>
      (expectedV1MinimalKeys as readonly string[]).includes(guide.event_key),
    );

    expect(v1Guides).toHaveLength(20);
    expect(new Set(v1Guides.map((guide) => guide.event_key))).toEqual(
      new Set(expectedV1MinimalKeys),
    );
  });

  it('extends payload guides beyond v1 minimal for agent tool bridge events', () => {
    expect(payloadGuides).toHaveLength(23);
    expect(payloadGuideMap.size).toBe(23);
    expect(getPayloadGuide('tool_invoke')).toBeDefined();
    expect(getPayloadGuide('tool_result')).toBeDefined();
    expect(getPayloadGuide('context_runtime_observation')).toBeDefined();
  });

  it('[contract:event-vocab.context-runtime-observation.v1] registers context runtime observation as a metadata-only event', () => {
    const event = coreEventMap.get('context_runtime_observation');

    expect(event).toMatchObject({
      event_key: 'context_runtime_observation',
      category: 'infrastructure',
      graph_hint: { role: 'observation', goal_eligible: false },
    });
    expect(getPayloadGuide('context_runtime_observation')?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'task_key', required: true }),
        expect.objectContaining({ name: 'route_keys', required: true }),
        expect.objectContaining({ name: 'fact_count', required: true }),
      ]),
    );
  });

  it('marks each required payload field as required', () => {
    for (const [eventKey, requiredFields] of Object.entries(expectedRequiredFields)) {
      const guide = payloadGuideMap.get(eventKey);

      expect(guide, `payload guide missing for ${eventKey}`).toBeDefined();

      for (const fieldName of requiredFields) {
        const field = guide?.fields.find((candidate) => candidate.name === fieldName);

        expect(field, `payload field missing for ${eventKey}.${fieldName}`).toBeDefined();
        expect(field?.required).toBe(true);
      }
    }
  });

  it('defines a valid graph hint for every core event', () => {
    for (const event of allCoreEvents) {
      expect(event.graph_hint).toBeDefined();
      expect(validGraphRoles).toContain(event.graph_hint.role);
      expect(typeof event.graph_hint.goal_eligible).toBe('boolean');
      expect(typeof event.graph_hint.loopable).toBe('boolean');
    }
  });

  it('marks exactly the expected four goal-eligible events', () => {
    const goalEligibleEvents = allCoreEvents
      .filter((event) => event.graph_hint.goal_eligible)
      .map((event) => event.event_key)
      .toSorted();

    expect(goalEligibleEvents).toEqual(
      ['success', 'complete', 'conversion', 'form_submit_success'].toSorted(),
    );
  });
});

describe('@qa-sdk/event-catalog — graph_hint role 의미론', () => {
  const expectedEntryEvents = ['session_start', 'app_open', 'sdk_init'] as const;

  // "error" 는 quality 카테고리의 observation 이벤트 (반복 발생 가능) — terminal이 아님
  const expectedTerminalEvents = ['session_end', 'complete', 'success', 'failure'] as const;

  const expectedLoopableEvents = [
    'click',
    'tap',
    'page_view',
    'screen_view',
    'route_change',
    'input_change',
  ] as const;

  it("entry 이벤트는 role이 'entry'여야 한다", () => {
    for (const eventKey of expectedEntryEvents) {
      const event = coreEventMap.get(eventKey);
      expect(event, `${eventKey} not found`).toBeDefined();
      expect(event?.graph_hint.role).toBe('entry');
    }
  });

  it("terminal 이벤트는 role이 'terminal'이어야 한다", () => {
    for (const eventKey of expectedTerminalEvents) {
      const event = coreEventMap.get(eventKey);
      expect(event, `${eventKey} not found`).toBeDefined();
      expect(event?.graph_hint.role).toBe('terminal');
    }
  });

  it('반복 가능한 상호작용 이벤트는 loopable이 true여야 한다', () => {
    for (const eventKey of expectedLoopableEvents) {
      const event = coreEventMap.get(eventKey);
      expect(event, `${eventKey} not found`).toBeDefined();
      expect(event?.graph_hint.loopable, `${eventKey} should be loopable`).toBe(true);
    }
  });

  it('entry/terminal 이벤트는 loopable이 false여야 한다 (한 번만 발생)', () => {
    const onceEvents = [...expectedEntryEvents, ...expectedTerminalEvents];
    for (const eventKey of onceEvents) {
      const event = coreEventMap.get(eventKey);
      expect(event?.graph_hint.loopable, `${eventKey} should not be loopable`).toBe(false);
    }
  });

  it('observation role 이벤트는 goal_eligible이 false여야 한다', () => {
    const observations = allCoreEvents.filter((e) => e.graph_hint.role === 'observation');
    expect(observations.length).toBeGreaterThan(0);
    for (const event of observations) {
      expect(
        event.graph_hint.goal_eligible,
        `${event.event_key} observation should not be goal_eligible`,
      ).toBe(false);
    }
  });

  it('entry 이벤트는 goal_eligible이 false여야 한다', () => {
    const entries = allCoreEvents.filter((e) => e.graph_hint.role === 'entry');
    for (const event of entries) {
      expect(
        event.graph_hint.goal_eligible,
        `${event.event_key} entry should not be goal_eligible`,
      ).toBe(false);
    }
  });
});
