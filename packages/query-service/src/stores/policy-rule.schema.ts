import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const policyRules = sqliteTable(
  "policy_rule",
  {
    id: text("id").primaryKey(),
    indexId: text("index_id").notNull(),
    versionId: text("version_id").notNull(),
    patternJson: text("pattern_json").notNull(),
    valueJson: text("value_json").notNull(),
    priority: integer("priority"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    ruleSetId: text("rule_set_id"),
  },
  (table) => ({
    lookup: index("idx_policy_rule_lookup").on(
      table.indexId,
      table.versionId,
      table.createdAt,
      table.id,
    ),
    byRuleSet: index("idx_policy_rule_ruleset").on(
      table.indexId,
      table.versionId,
      table.ruleSetId,
    ),
  }),
);

export const POLICY_RULE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS policy_rule (
    id           TEXT NOT NULL PRIMARY KEY,
    index_id     TEXT NOT NULL,
    version_id   TEXT NOT NULL,
    pattern_json TEXT NOT NULL,
    value_json   TEXT NOT NULL,
    priority     INTEGER,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    rule_set_id  TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_policy_rule_lookup
    ON policy_rule (index_id, version_id, created_at, id)`,
  `CREATE INDEX IF NOT EXISTS idx_policy_rule_ruleset
    ON policy_rule (index_id, version_id, rule_set_id)`,
] as const;
