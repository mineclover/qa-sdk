import { describe, expect, it } from 'vitest';
import {
  CONTEXT_ACTION_PROVIDER_ORDER,
  createContextActionFeatureContract,
  validateContextActionFeature,
  type ContextActionFeatureId,
} from './context-action-contract.js';

const FEATURES: ContextActionFeatureId[] = [
  'canonical-review',
  'incident-escalation',
];

describe('context-action convention contract', () => {
  it.each(FEATURES)('%s feature가 provider order와 mount contract를 만족한다', (featureId) => {
    const contract = createContextActionFeatureContract(featureId);
    const validation = validateContextActionFeature(contract);

    expect(validation.providerOrder).toEqual(CONTEXT_ACTION_PROVIDER_ORDER);
    expect(validation.nestingValid).toBe(true);
    expect(validation.mountValid).toBe(true);
    expect(validation.mount.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('handlers boundary는 state/persist/logging을 소비하고 view는 state/actions만 소비한다', () => {
    const contract = createContextActionFeatureContract('canonical-review');
    const handlers = contract.nesting.scopes.find((scope) => scope.scopeId === 'handlers');
    const view = contract.nesting.scopes.find((scope) => scope.scopeId === 'view');

    expect(handlers?.consumes.map((contractRef) => contractRef.contractId)).toEqual([
      'playbook-state',
      'persist-adapter',
      'logging-session',
    ]);
    expect(view?.consumes.map((contractRef) => contractRef.contractId)).toEqual([
      'playbook-state',
      'submission-handlers',
    ]);
    expect(view?.provides).toEqual([]);
  });

  it('qa-bridge 없이도 logging은 optional warning으로만 남고 필수 flow는 유지된다', () => {
    const contract = createContextActionFeatureContract('incident-escalation');
    const lightweight = {
      ...contract,
      nesting: {
        ...contract.nesting,
        scopes: contract.nesting.scopes.filter((scope) => scope.scopeId !== 'qa-bridge'),
      },
    };

    const validation = validateContextActionFeature(lightweight);

    expect(validation.nestingValid).toBe(true);
    expect(validation.mountValid).toBe(true);
    expect(validation.mount.issues.map((issue) => issue.code)).toContain('contract-unavailable');
    expect(validation.mount.issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});
