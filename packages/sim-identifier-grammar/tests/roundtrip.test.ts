import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import * as G from '../src/index.js';

// 각 builder와 parser 쌍이 build → parse → equal 라운드트립을 만족하는지
// 한 곳에서 메타 테스트한다. 식별자별 단위 테스트는 src/<name>.test.ts에 있다.

describe('identifier grammar roundtrip (meta)', () => {
  it('service prefix #1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('svc', 'slice', 'evt', 'cache'),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/),
        (category, name) => {
          const o = { namespace: 'sim', category, name } as const;
          if (G.parseServicePrefix(G.buildServicePrefix(o as any)) === o) return true;
          return (
            JSON.stringify(G.parseServicePrefix(G.buildServicePrefix(o as any))) ===
            JSON.stringify(o)
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // 나머지 14종도 같은 형식. Task 2.5~2.16 완료 시점에 채운다.
  // 본 step에서는 #1~#3만 채워서 통합 테스트 동작을 확인하고,
  // 후속 Task 2.5~2.16에서 각자 본인 항목을 추가한다.
});
