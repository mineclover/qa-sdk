// @def.boundary query-api-spec
// @def.doc query-api-spec

import type { SqlDriver } from 'index-meta-workers';
import { parseJsonColumn } from '../lib/typed-json.js';
import {
  cloneStoredPolicyRule,
  compareStoredPolicyRules,
  PolicyRuleAlreadyExistsError,
  PolicyRuleNotFoundError,
  type PolicyRuleStore,
  type StoredPolicyRule,
} from './policy-rule-store.js';

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

// Workers에서 import.meta.url이 file:// 기반이 아니므로 지연 평가
let _migrationsFolder: string | undefined;
function getMigrationsFolder(): string {
  if (!_migrationsFolder) {
    _migrationsFolder = new URL('../../drizzle', import.meta.url).pathname;
  }
  return _migrationsFolder;
}

export class SqlPolicyRuleStore<T = unknown> implements PolicyRuleStore<T> {
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly driver: SqlDriver) {}

  async insert(rule: StoredPolicyRule<T>): Promise<StoredPolicyRule<T>> {
    await this.ensureSchema();

    const existing = await this.driver.queryOne<{ id: string }>(
      'SELECT id FROM policy_rule WHERE id = ?',
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

  async findByIndex(indexId: string, versionId: string): Promise<StoredPolicyRule<T>[]> {
    await this.ensureSchema();

    const rows = await this.driver.query<PolicyRuleRow>(
      `SELECT id, index_id, version_id, pattern_json, value_json, priority, created_at, updated_at, rule_set_id
       FROM policy_rule
       WHERE index_id = ? AND version_id = ?
       ORDER BY created_at ASC, id ASC`,
      [indexId, versionId],
    );

    return rows.map((row) => toStoredPolicyRule<T>(row)).toSorted(compareStoredPolicyRules);
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

    const result = await this.driver.execute('DELETE FROM policy_rule WHERE id = ?', [id]);
    if (result.rowsAffected === 0) {
      throw new PolicyRuleNotFoundError(id);
    }
  }

  private async ensureSchema(): Promise<void> {
    if (this.driver.dialect.name === 'd1') {
      // Workers/D1는 런타임 파일시스템 접근이 불가해 배포 시점에 migration을 적용해야 한다.
      return;
    }

    if (!this.schemaReady) {
      this.schemaReady = migratePolicyRuleSchema(this.driver);
    }
    await this.schemaReady;
  }
}

function toStoredPolicyRule<T>(row: PolicyRuleRow): StoredPolicyRule<T> {
  return {
    id: row.id,
    indexId: row.index_id,
    versionId: row.version_id,
    pattern: parseJsonColumn<StoredPolicyRule<T>['pattern']>(row.pattern_json, []),
    value: parseJsonColumn<T>(row.value_json, undefined as T),
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

async function migratePolicyRuleSchema(driver: SqlDriver): Promise<void> {
  const [{ drizzle }, { migrate }] = await Promise.all([
    import('drizzle-orm/sqlite-proxy'),
    import('drizzle-orm/sqlite-proxy/migrator'),
  ]);

  const db = drizzle(async (sql, params, method) => {
    switch (method) {
      case 'run':
        await driver.execute(sql, params);
        return { rows: [] };
      case 'get': {
        const row = await driver.queryOne<Record<string, unknown>>(sql, params);
        return { rows: row ? [row] : [] };
      }
      case 'values': {
        const rows = await driver.query<Record<string, unknown>>(sql, params);
        return { rows: rows.map((row) => Object.values(row)) };
      }
      case 'all':
      default:
        return {
          rows: await driver.query<Record<string, unknown>>(sql, params),
        };
    }
  });

  await migrate(
    db,
    async (queries) => {
      await driver.transaction(async (tx) => {
        for (const query of queries) {
          await tx.execute(query);
        }
      });
    },
    { migrationsFolder: getMigrationsFolder() },
  );
}
