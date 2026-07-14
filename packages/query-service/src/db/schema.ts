// @def.boundary query-api-spec
// @def.doc query-api-spec

/**
 * query-service PolicyRule Drizzle 스키마 정의
 *
 * runtime SQL은 SqlPolicyRuleStore가 담당하고,
 * 마이그레이션 SQL 생성은 drizzle-kit이 담당한다.
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const policyRules = sqliteTable(
  'policy_rule',
  {
    id: text('id').primaryKey(),
    indexId: text('index_id').notNull(),
    versionId: text('version_id').notNull(),
    patternJson: text('pattern_json').notNull(),
    valueJson: text('value_json').notNull(),
    priority: integer('priority'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    ruleSetId: text('rule_set_id'),
  },
  (table) => [
    index('idx_policy_rule_lookup').on(table.indexId, table.versionId, table.createdAt, table.id),
    index('idx_policy_rule_ruleset').on(table.indexId, table.versionId, table.ruleSetId),
  ],
);
