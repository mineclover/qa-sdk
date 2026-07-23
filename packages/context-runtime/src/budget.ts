import {
  ContextRuntimeError,
  DEFAULT_TOTAL_WINDOW_TOKENS,
  DISCOVERY_HARD_CAP_TOKENS,
  WORKING_RESERVE_MIN_TOKENS,
  type ContextBudgetProfile,
  type ValidationIssue,
  type ValidationResult,
} from './types.js';

export const DEFAULT_CONTEXT_BUDGET_PROFILE: ContextBudgetProfile = Object.freeze({
  totalWindowTokens: DEFAULT_TOTAL_WINDOW_TOKENS,
  discoveryMaxTokens: DISCOVERY_HARD_CAP_TOKENS,
  workingReserveTokens: WORKING_RESERVE_MIN_TOKENS,
  systemReserveTokens: 0,
  outputReserveTokens: 0,
});

export function createContextBudgetProfile(
  overrides: Partial<ContextBudgetProfile> = {},
): ContextBudgetProfile {
  return Object.freeze({ ...DEFAULT_CONTEXT_BUDGET_PROFILE, ...overrides });
}

export function validateContextBudgetProfile(profile: ContextBudgetProfile): ValidationResult {
  const issues: ValidationIssue[] = [];
  const numericFields: readonly (keyof ContextBudgetProfile)[] = [
    'totalWindowTokens',
    'discoveryMaxTokens',
    'workingReserveTokens',
    'systemReserveTokens',
    'outputReserveTokens',
    'maxObjects',
    'maxRelations',
    'maxRouteExpansions',
  ];

  for (const field of numericFields) {
    const value = profile[field];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 0) {
      issues.push({
        code: 'budget-value-invalid',
        path: field,
        message: `${field} must be a non-negative integer`,
      });
    }
  }

  if (profile.discoveryMaxTokens > DISCOVERY_HARD_CAP_TOKENS) {
    issues.push({
      code: 'discovery-cap-exceeded',
      path: 'discoveryMaxTokens',
      message: `discoveryMaxTokens must not exceed ${DISCOVERY_HARD_CAP_TOKENS}`,
    });
  }

  if (profile.workingReserveTokens < WORKING_RESERVE_MIN_TOKENS) {
    issues.push({
      code: 'working-reserve-too-small',
      path: 'workingReserveTokens',
      message: `workingReserveTokens must be at least ${WORKING_RESERVE_MIN_TOKENS}`,
    });
  }

  const reservedTokens =
    profile.workingReserveTokens + profile.systemReserveTokens + profile.outputReserveTokens;
  const requiredTokens = reservedTokens + profile.discoveryMaxTokens;
  if (profile.totalWindowTokens < requiredTokens) {
    issues.push({
      code: 'window-too-small',
      path: 'totalWindowTokens',
      message: `totalWindowTokens must be at least ${requiredTokens} for the configured reserves`,
    });
  }

  return { valid: issues.length === 0, issues };
}

export function assertValidContextBudgetProfile(
  profile: ContextBudgetProfile,
): ContextBudgetProfile {
  const result = validateContextBudgetProfile(profile);
  if (!result.valid) {
    throw new ContextRuntimeError(
      'invalid-context-budget',
      'Context budget profile is invalid',
      result.issues,
    );
  }
  return profile;
}

export function availableDiscoveryTokens(profile: ContextBudgetProfile): number {
  const availableWindowTokens = Math.max(
    0,
    profile.totalWindowTokens -
      profile.workingReserveTokens -
      profile.systemReserveTokens -
      profile.outputReserveTokens,
  );
  return Math.min(profile.discoveryMaxTokens, availableWindowTokens);
}
