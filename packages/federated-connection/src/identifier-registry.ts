// @def.doc federated-connection-contract

import {
  ConnectionContractError,
  IDENTIFIER_RULE_STATUSES,
  REVISION_STRATEGIES,
  type SourceIdentifierRule,
  type SourceRef,
} from './contract.js';
import { validateProvenance } from './validate.js';

export type SourceIdentifierLookup = Readonly<
  Pick<SourceRef, 'sourceSystem' | 'entityType' | 'localId'>
>;

function ruleKey(
  rule: Pick<SourceIdentifierRule, 'sourceSystem' | 'entityType' | 'version'>,
): string {
  return `identifier-rule:${encodeURIComponent(rule.sourceSystem)}:${encodeURIComponent(rule.entityType)}:v${rule.version}`;
}

function requireText(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ConnectionContractError(`${field} must be a non-empty string`);
  }
}

function validatePattern(pattern: string, field: string): void {
  if (pattern.length === 0) {
    throw new ConnectionContractError(`${field} must be a non-empty regular expression`);
  }
  try {
    new RegExp(`^(?:${pattern})$`);
  } catch (error) {
    throw new ConnectionContractError(
      `${field} must be a valid regular expression: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function matches(pattern: string, value: string): boolean {
  return new RegExp(`^(?:${pattern})$`).test(value);
}

export class SourceIdentifierRegistry {
  private readonly rules = new Map<string, SourceIdentifierRule>();

  register(rule: SourceIdentifierRule): void {
    requireText(rule.id, 'identifier rule id');
    requireText(rule.sourceSystem, 'identifier rule sourceSystem');
    requireText(rule.entityType, 'identifier rule entityType');
    requireText(rule.localIdPattern, 'identifier rule localIdPattern');
    if (rule.revisionPattern !== undefined) requireText(rule.revisionPattern, 'revisionPattern');
    if (!Number.isInteger(rule.version) || rule.version < 1) {
      throw new ConnectionContractError('identifier rule version must be a positive integer');
    }
    if (!REVISION_STRATEGIES.includes(rule.revisionStrategy)) {
      throw new ConnectionContractError(`Unsupported revision strategy: ${rule.revisionStrategy}`);
    }
    if (!IDENTIFIER_RULE_STATUSES.includes(rule.status)) {
      throw new ConnectionContractError(`Unsupported identifier rule status: ${rule.status}`);
    }
    validatePattern(rule.localIdPattern, 'identifier rule localIdPattern');
    if (rule.revisionPattern !== undefined)
      validatePattern(rule.revisionPattern, 'revisionPattern');
    validateProvenance(rule.provenance);

    const key = ruleKey(rule);
    const existing = this.rules.get(key);
    if (existing && existing.id !== rule.id) {
      throw new ConnectionContractError(`Identifier rule key already registered: ${key}`);
    }
    this.rules.set(key, { ...rule, provenance: { ...rule.provenance } });
  }

  get(
    sourceSystem: string,
    entityType: string,
    version?: number,
  ): SourceIdentifierRule | undefined {
    if (version !== undefined) {
      const rule = this.rules.get(ruleKey({ sourceSystem, entityType, version }));
      return rule ? { ...rule, provenance: { ...rule.provenance } } : undefined;
    }

    const candidates = [...this.rules.values()]
      .filter(
        (rule) =>
          rule.sourceSystem === sourceSystem &&
          rule.entityType === entityType &&
          rule.status === 'active',
      )
      .sort((left, right) => right.version - left.version);
    const rule = candidates[0];
    return rule ? { ...rule, provenance: { ...rule.provenance } } : undefined;
  }

  list(filter?: { sourceSystem?: string; entityType?: string }): SourceIdentifierRule[] {
    return [...this.rules.values()]
      .filter(
        (rule) =>
          (filter?.sourceSystem === undefined || rule.sourceSystem === filter.sourceSystem) &&
          (filter?.entityType === undefined || rule.entityType === filter.entityType),
      )
      .sort((left, right) =>
        `${left.sourceSystem}:${left.entityType}:${left.version}`.localeCompare(
          `${right.sourceSystem}:${right.entityType}:${right.version}`,
        ),
      )
      .map((rule) => ({ ...rule, provenance: { ...rule.provenance } }));
  }

  validateLookup(lookup: SourceIdentifierLookup, version?: number): SourceIdentifierRule {
    requireText(lookup.sourceSystem, 'lookup.sourceSystem');
    requireText(lookup.entityType, 'lookup.entityType');
    requireText(lookup.localId, 'lookup.localId');
    const rule = this.get(lookup.sourceSystem, lookup.entityType, version);
    if (!rule || rule.status !== 'active') {
      throw new ConnectionContractError(
        `No active identifier rule for ${lookup.sourceSystem}:${lookup.entityType}${version !== undefined ? `:v${version}` : ''}`,
      );
    }
    if (!matches(rule.localIdPattern, lookup.localId)) {
      throw new ConnectionContractError(
        `localId ${lookup.localId} does not match identifier rule ${rule.id}: ${rule.localIdPattern}`,
      );
    }
    return rule;
  }

  validate(source: SourceRef, version?: number): SourceIdentifierRule {
    const rule = this.validateLookup(source, version);
    if (rule.revisionPattern && !matches(rule.revisionPattern, source.revision)) {
      throw new ConnectionContractError(
        `revision ${source.revision} does not match identifier rule ${rule.id}: ${rule.revisionPattern}`,
      );
    }
    return rule;
  }
}
