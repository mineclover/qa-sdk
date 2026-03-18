import type { SqlDriver } from "index-meta";
import { POLICY_RULE_SCHEMA_STATEMENTS } from "./policy-rule.schema.js";
import {
  cloneStoredPolicyRule,
  compareStoredPolicyRules,
  PolicyRuleAlreadyExistsError,
  PolicyRuleNotFoundError,
  type PolicyRuleStore,
  type StoredPolicyRule,
} from "./policy-rule-store.js";

interface PolicyRuleRow extends Record<string, unknown> {
  id: string;
  index_id: string;
  version_id: string;
  pattern_json: string;
  value_json: string;
  priority: number | null;
  created_at: string;
  updated_at: string;
  rule_set_id: string | null;
}

export class SqlPolicyRuleStore<T = unknown> implements PolicyRuleStore<T> {
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly driver: SqlDriver) {}

  async insert(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>> {
    await this.ensureSchema();

    const existing = await this.driver.queryOne<{ id: string }>(
      "SELECT id FROM policy_rule WHERE id = ?",
      [rule.id],
    );
    if (existing) {
      throw new PolicyRuleAlreadyExistsError(rule.id);
    }

    await this.driver.execute(
      `INSERT INTO policy_rule
         (id, index_id, version_id, pattern_json, value_json, priority, created_at, updated_at, rule_set_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      toParams(rule),
    );

    return cloneStoredPolicyRule(rule);
  }

  async findById(id: string): Promise<StoredPolicyRule<T>> {
    await this.ensureSchema();

    const row = await this.driver.queryOne<PolicyRuleRow>(
      `SELECT id, index_id, version_id, pattern_json, value_json, priority, created_at, updated_at, rule_set_id
       FROM policy_rule
       WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new PolicyRuleNotFoundError(id);
    }

    return toStoredPolicyRule<T>(row);
  }

  async findByIndex(
    indexId: string,
    versionId: string,
  ): Promise<StoredPolicyRule<T>[]> {
    await this.ensureSchema();

    const rows = await this.driver.query<PolicyRuleRow>(
      `SELECT id, index_id, version_id, pattern_json, value_json, priority, created_at, updated_at, rule_set_id
       FROM policy_rule
       WHERE index_id = ? AND version_id = ?
       ORDER BY created_at ASC, id ASC`,
      [indexId, versionId],
    );

    return rows
      .map((row) => toStoredPolicyRule<T>(row))
      .sort(compareStoredPolicyRules);
  }

  async update(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>> {
    await this.ensureSchema();

    const result = await this.driver.execute(
      `UPDATE policy_rule
       SET index_id = ?, version_id = ?, pattern_json = ?, value_json = ?, priority = ?, created_at = ?, updated_at = ?, rule_set_id = ?
       WHERE id = ?`,
      [
        rule.indexId,
        rule.versionId,
        JSON.stringify(rule.pattern),
        JSON.stringify(rule.value),
        rule.priority ?? null,
        rule.createdAt,
        rule.updatedAt,
        rule.ruleSetId ?? null,
        rule.id,
      ],
    );

    if (result.rowsAffected === 0) {
      throw new PolicyRuleNotFoundError(rule.id);
    }

    return cloneStoredPolicyRule(rule);
  }

  async delete(id: string): Promise<void> {
    await this.ensureSchema();

    const result = await this.driver.execute(
      "DELETE FROM policy_rule WHERE id = ?",
      [id],
    );
    if (result.rowsAffected === 0) {
      throw new PolicyRuleNotFoundError(id);
    }
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        for (const statement of POLICY_RULE_SCHEMA_STATEMENTS) {
          await this.driver.execute(statement);
        }
      })();
    }
    await this.schemaReady;
  }
}

function toStoredPolicyRule<T>(row: PolicyRuleRow): StoredPolicyRule<T> {
  return {
    id: row.id,
    indexId: row.index_id,
    versionId: row.version_id,
    pattern: JSON.parse(row.pattern_json) as StoredPolicyRule<T>["pattern"],
    value: JSON.parse(row.value_json) as T,
    priority: row.priority ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ruleSetId: row.rule_set_id ?? undefined,
  };
}

function toParams<T>(rule: StoredPolicyRule<T>): unknown[] {
  return [
    rule.id,
    rule.indexId,
    rule.versionId,
    JSON.stringify(rule.pattern),
    JSON.stringify(rule.value),
    rule.priority ?? null,
    rule.createdAt,
    rule.updatedAt,
    rule.ruleSetId ?? null,
  ];
}
