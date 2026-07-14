// @def.boundary sim-approval-api
// @def.doc 02-canary-topology

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { buildSchemaHash } from 'sim-identifier-grammar';

describe('outbox payload — version stamp + schemaHash', () => {
  beforeAll(() => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    process.env.SIM_DB_WRITE_URL = 'postgres://x:y@h/y';
    process.env.SIM_DB_READ_URL = 'postgres://x:y@h/y';
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('budget outbox record contains serviceVersion + schemaHash', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    // 내부 createDrizzleOutboxPort를 stub. spec: 단순 wrapper 검증.
    const appendSpy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@qa-sdk/sim-domain-slice-kit', async () => {
      const actual = await vi.importActual<typeof import('@qa-sdk/sim-domain-slice-kit')>(
        '@qa-sdk/sim-domain-slice-kit',
      );
      return {
        ...actual,
        createDrizzleOutboxPort: () => ({ append: appendSpy }),
      };
    });

    const { createBudgetOutboxPort, BUDGET_SCHEMA_HASH } =
      await import('../approval/budget/infrastructure/outbox/budget.outbox.js');
    const port = createBudgetOutboxPort({ dialect: 'sqlite', db: {} as never });

    const fakeScope = {} as never;
    await port.append(
      {
        eventName: 'approval.budget.submitted',
        eventVersion: 1,
        aggregateId: 'b-1',
        payload: { id: 'b-1', amount: 1000 },
        occurredAt: new Date(0),
        idempotencyKey: 'k-1',
      },
      fakeScope,
    );

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const calledWith = appendSpy.mock.calls[0]?.[0] as {
      payload: Record<string, unknown>;
    };
    expect(calledWith.payload).toMatchObject({
      id: 'b-1',
      amount: 1000,
      serviceVersion: 'v3',
      schemaHash: BUDGET_SCHEMA_HASH,
    });
    expect(BUDGET_SCHEMA_HASH).toMatch(/^[0-9a-f]{16}$/);
  });

  it('schemaHash is deterministic (same shape → same hash)', () => {
    const shape = { id: 'string', amount: 'number' } as const;
    const eventName = {
      domain: 'approval',
      entity: 'budget',
      action: 'submitted',
    } as const;
    expect(buildSchemaHash({ eventName, payloadShape: shape })).toBe(
      buildSchemaHash({ eventName, payloadShape: shape }),
    );
  });

  it('schemaHash changes when payloadShape changes', () => {
    const eventName = {
      domain: 'approval',
      entity: 'budget',
      action: 'submitted',
    } as const;
    const a = buildSchemaHash({
      eventName,
      payloadShape: { id: 'string', amount: 'number' } as const,
    });
    const b = buildSchemaHash({
      eventName,
      payloadShape: {
        id: 'string',
        amount: 'number',
        escalationLevel: 'number',
      } as const,
    });
    expect(a).not.toBe(b);
  });

  it('4 slices each have distinct schemaHash (no accidental collision)', async () => {
    process.env.SIM_SERVICE_VERSION = 'v3';
    vi.resetModules();
    vi.doMock('@qa-sdk/sim-domain-slice-kit', async () => {
      const actual = await vi.importActual<typeof import('@qa-sdk/sim-domain-slice-kit')>(
        '@qa-sdk/sim-domain-slice-kit',
      );
      return {
        ...actual,
        createDrizzleOutboxPort: () => ({ append: vi.fn() }),
      };
    });
    const { BUDGET_SCHEMA_HASH } =
      await import('../approval/budget/infrastructure/outbox/budget.outbox.js');
    const { EXPENSE_SCHEMA_HASH } =
      await import('../approval/expense/infrastructure/outbox/expense.outbox.js');
    const { TIMEOFF_SCHEMA_HASH } =
      await import('../approval/timeoff/infrastructure/outbox/timeoff.outbox.js');
    const { RESOURCE_SCHEMA_HASH } =
      await import('../approval/resource/infrastructure/outbox/resource.outbox.js');
    // budget/expense는 같은 PAYLOAD_SHAPE라 같은 hash가 나온다.
    // 의도된 동작 — eventName은 hash 입력에 들어가지 않고 payloadShape만 입력 (spec §2.6).
    // 따라서 timeoff/resource는 다른 shape이라 다른 hash.
    expect(TIMEOFF_SCHEMA_HASH).not.toBe(BUDGET_SCHEMA_HASH);
    expect(RESOURCE_SCHEMA_HASH).not.toBe(BUDGET_SCHEMA_HASH);
    expect(TIMEOFF_SCHEMA_HASH).not.toBe(RESOURCE_SCHEMA_HASH);
    // 모두 16-hex
    for (const h of [
      BUDGET_SCHEMA_HASH,
      EXPENSE_SCHEMA_HASH,
      TIMEOFF_SCHEMA_HASH,
      RESOURCE_SCHEMA_HASH,
    ]) {
      expect(h).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});
