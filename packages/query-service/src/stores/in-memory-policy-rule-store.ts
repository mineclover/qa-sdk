// @def.boundary query-api-spec
// @def.doc query-api-spec

// @facet
import {
  cloneStoredPolicyRule,
  compareStoredPolicyRules,
  PolicyRuleAlreadyExistsError,
  PolicyRuleNotFoundError,
  type PolicyRuleStore,
  type StoredPolicyRule,
} from "./policy-rule-store.js";

export class InMemoryPolicyRuleStore<T = unknown>
  implements PolicyRuleStore<T>
{
  private readonly rules = new Map<string, StoredPolicyRule<T>>();

  async insert(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>> {
    if (this.rules.has(rule.id)) {
      throw new PolicyRuleAlreadyExistsError(rule.id);
    }

    const stored = cloneStoredPolicyRule(rule);
    this.rules.set(rule.id, stored);
    return cloneStoredPolicyRule(stored);
  }

  async findById(id: string): Promise<StoredPolicyRule<T>> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new PolicyRuleNotFoundError(id);
    }
    return cloneStoredPolicyRule(rule);
  }

  async findByIndex(
    indexId: string,
    versionId: string,
  ): Promise<StoredPolicyRule<T>[]> {
    return [...this.rules.values()]
      .filter(
        (rule) =>
          rule.indexId === indexId && rule.versionId === versionId,
      )
      .toSorted(compareStoredPolicyRules)
      .map(cloneStoredPolicyRule);
  }

  async update(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>> {
    if (!this.rules.has(rule.id)) {
      throw new PolicyRuleNotFoundError(rule.id);
    }

    const stored = cloneStoredPolicyRule(rule);
    this.rules.set(rule.id, stored);
    return cloneStoredPolicyRule(stored);
  }

  async delete(id: string): Promise<void> {
    if (!this.rules.delete(id)) {
      throw new PolicyRuleNotFoundError(id);
    }
  }
}
