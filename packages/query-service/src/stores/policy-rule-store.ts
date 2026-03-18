import type { PolicyRule } from "index-meta";

export interface StoredPolicyRule<T> extends PolicyRule<T> {
  readonly indexId: string;
  readonly versionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly ruleSetId?: string;
}

export interface PolicyRuleStore<T = unknown> {
  insert(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>>;
  findById(id: string): Promise<StoredPolicyRule<T>>;
  findByIndex(indexId: string, versionId: string): Promise<StoredPolicyRule<T>[]>;
  update(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>>;
  delete(id: string): Promise<void>;
}

export class PolicyRuleNotFoundError extends Error {
  constructor(id: string) {
    super(`PolicyRule not found: "${id}"`);
    this.name = "PolicyRuleNotFoundError";
  }
}

export class PolicyRuleAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`PolicyRule already exists: "${id}"`);
    this.name = "PolicyRuleAlreadyExistsError";
  }
}

export function cloneStoredPolicyRule<T>(
  rule: StoredPolicyRule<T>,
): StoredPolicyRule<T> {
  return structuredClone(rule);
}

export function compareStoredPolicyRules<T>(
  left: StoredPolicyRule<T>,
  right: StoredPolicyRule<T>,
) {
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}
