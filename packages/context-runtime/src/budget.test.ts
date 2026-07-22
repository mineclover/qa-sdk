import { describe, expect, it } from 'vitest';
import {
  availableDiscoveryTokens,
  createContextBudgetProfile,
  validateContextBudgetProfile,
} from './budget.js';

describe('context-runtime budget', () => {
  it('[contract:context-runtime.budget.reserve-isolation.v1] preserves the 100K working reserve', () => {
    const profile = createContextBudgetProfile();
    const result = validateContextBudgetProfile(profile);

    expect(result.valid).toBe(true);
    expect(profile.discoveryMaxTokens).toBe(100_000);
    expect(profile.workingReserveTokens).toBe(100_000);
    expect(availableDiscoveryTokens(profile)).toBe(100_000);
  });

  it('[contract:context-runtime.budget.reserve-isolation.v1] rejects borrowing from the working reserve', () => {
    const profile = createContextBudgetProfile({
      totalWindowTokens: 190_000,
    });
    const result = validateContextBudgetProfile(profile);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('window-too-small');
  });

  it('[contract:context-runtime.budget.reserve-isolation.v1] rejects a discovery cap above 100K', () => {
    const profile = createContextBudgetProfile({
      totalWindowTokens: 250_000,
      discoveryMaxTokens: 100_001,
    });
    const result = validateContextBudgetProfile(profile);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('discovery-cap-exceeded');
  });

  it('[contract:context-runtime.budget.reserve-isolation.v1] never exposes discovery capacity above its hard cap', () => {
    const profile = createContextBudgetProfile({ totalWindowTokens: 400_000 });

    expect(availableDiscoveryTokens(profile)).toBe(100_000);
  });
});
