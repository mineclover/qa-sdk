import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildPubsubChannel,
  parsePubsubChannel,
  PUBSUB_TOPICS,
  type PubSubChannel,
} from './pubsub-channel.js';

describe('redis pub/sub channel grammar (#10)', () => {
  it('builds sim:bitmap.invalidate from canonical input', () => {
    const out = buildPubsubChannel({
      namespace: 'sim',
      topic: 'bitmap.invalidate',
    });
    expect(out).toBe('sim:bitmap.invalidate');
  });

  it('parses sim:routing.update back to original shape', () => {
    const orig: PubSubChannel = { namespace: 'sim', topic: 'routing.update' };
    expect(parsePubsubChannel(buildPubsubChannel(orig))).toEqual(orig);
  });

  it('rejects namespace outside allowlist', () => {
    expect(() =>
      buildPubsubChannel({
        namespace: 'app' as never,
        topic: 'bitmap.invalidate',
      }),
    ).toThrow();
  });

  it('rejects topic outside allowlist', () => {
    expect(() =>
      buildPubsubChannel({
        namespace: 'sim',
        topic: 'user.created' as never,
      }),
    ).toThrow();
  });

  it('rejects parsing of sim/bitmap-invalidate (separator 위반)', () => {
    expect(() => parsePubsubChannel('sim/bitmap-invalidate')).toThrow();
  });

  it('roundtrip property over allowlist combinations', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PUBSUB_TOPICS), (topic) => {
        const orig: PubSubChannel = { namespace: 'sim', topic };
        expect(parsePubsubChannel(buildPubsubChannel(orig))).toEqual(orig);
      }),
      { numRuns: 100 },
    );
  });
});
