// @def.boundary convergence-layer-group
/**
 * convergence producer 정보 — 자동 observation의 provenance에 기록한다.
 *
 * 버전은 package.json과 일치해야 한다 (producer-info.test.ts가 고정).
 *
 * @layer 기록 (Recording)
 */

import type { ObservationProvenance } from './dkg-types.js';

/** 패키지 이름 */
export const CONVERGENCE_PACKAGE_NAME = '@qa-sdk/convergence';

/** 패키지 버전 (package.json `version`과 동일) */
export const CONVERGENCE_PRODUCER_VERSION = '0.1.0';

/** observation을 만드는 producer 식별자 */
export const CONVERGENCE_PRODUCERS = {
  metricRegistry: 'convergence/metric-registry',
  causalDiscovery: 'convergence/causal-discovery',
} as const;

/** 규칙·알고리즘 버전 — 규칙이 바뀌면 올린다 (G3 cache key 구성요소) */
export const CONVERGENCE_ALGORITHM_VERSIONS = {
  metricRegistry: 'metric-registry/1',
  causalDiscovery: 'causal-discovery/1',
} as const;

type ProducerKey = keyof typeof CONVERGENCE_PRODUCERS;

/** producer 키에 해당하는 provenance를 만든다 */
export function convergenceProvenance(key: ProducerKey): ObservationProvenance {
  return {
    producer: CONVERGENCE_PRODUCERS[key],
    producerVersion: CONVERGENCE_PRODUCER_VERSION,
    algorithmVersion: CONVERGENCE_ALGORITHM_VERSIONS[key],
  };
}
