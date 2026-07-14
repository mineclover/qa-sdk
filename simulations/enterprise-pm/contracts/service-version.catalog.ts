// enterprise-pm 시뮬 서비스 버전 catalog — qa-sdk catalog version axis 등록.
// spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2.1
// state는 retired | stable | candidate 3종 고정.
// 같은 prefix 안에서 stable·candidate는 각각 0 또는 1개만 존재 (controller invariant).

import { buildServicePrefix } from 'sim-identifier-grammar';
import type { CatalogPrefixDefinition } from 'sim-service-catalog';

export const SIM_SERVICE_PREFIXES = {
  approvalApi: {
    prefix: buildServicePrefix({ namespace: 'sim', category: 'svc', name: 'approval' }),
    versionAxis: { kind: 'version', capacity: 64 } as const, // 64 버전 헤드룸
    refEntries: [
      { version: 'v1', state: 'retired' },
      { version: 'v2', state: 'retired' },
      { version: 'v3', state: 'stable' },
      { version: 'v4-candidate', state: 'candidate' },
    ],
  } satisfies CatalogPrefixDefinition,
  // 다른 시뮬 서비스도 후속에 같은 패턴 (auth, pm, ...)
} as const;

export type SimServicePrefixId = keyof typeof SIM_SERVICE_PREFIXES;
