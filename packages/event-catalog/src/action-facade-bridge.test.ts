import { describe, expect, it } from 'vitest';
import { getPayloadGuide, payloadGuides } from './index.js';

/** action-facade @pnpm-mcp/action-facade telemetry/qa-sdk-contract.ts 와 동기화 */
const ACTION_FACADE_TOOL_INVOKE_REQUIRED = ['tool', 'provider_id', 'channel'] as const;
const ACTION_FACADE_TOOL_RESULT_REQUIRED = [
  'tool',
  'provider_id',
  'channel',
  'kind',
  'ok',
  'duration_ms',
] as const;

describe('@qa-sdk/event-catalog — action-facade telemetry bridge', () => {
  it('tool_invoke / tool_result payload guide를 제공한다', () => {
    expect(getPayloadGuide('tool_invoke')).toBeDefined();
    expect(getPayloadGuide('tool_result')).toBeDefined();
    expect(payloadGuides.map((guide) => guide.event_key)).toContain('tool_invoke');
    expect(payloadGuides.map((guide) => guide.event_key)).toContain('tool_result');
  });

  it('action-facade bridge 필수 필드와 payload guide required가 일치한다', () => {
    const invokeGuide = getPayloadGuide('tool_invoke');
    const resultGuide = getPayloadGuide('tool_result');

    expect(invokeGuide).toBeDefined();
    expect(resultGuide).toBeDefined();

    for (const fieldName of ACTION_FACADE_TOOL_INVOKE_REQUIRED) {
      const field = invokeGuide?.fields.find((candidate) => candidate.name === fieldName);
      expect(field, `tool_invoke.${fieldName}`).toBeDefined();
      expect(field?.required).toBe(true);
    }

    for (const fieldName of ACTION_FACADE_TOOL_RESULT_REQUIRED) {
      const field = resultGuide?.fields.find((candidate) => candidate.name === fieldName);
      expect(field, `tool_result.${fieldName}`).toBeDefined();
      expect(field?.required).toBe(true);
    }
  });
});
