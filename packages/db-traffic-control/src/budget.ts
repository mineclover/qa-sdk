// @def.boundary db-traffic-control-spec
// @def.doc db-traffic-control-spec
import type { BudgetDef, BudgetMatchRule, QueryAttributes } from "./types.js";

/**
 * 쿼리 속성에 매칭되는 Budget을 우선순위 순으로 찾아 반환한다.
 * 여러 budget이 매칭되면 priority가 가장 낮은(높은 우선순위) budget을 반환.
 * 매칭 없으면 null.
 */
export function matchBudget(
  attributes: QueryAttributes,
  budgets: readonly BudgetDef[],
): BudgetDef | null {
  let best: BudgetDef | null = null;

  for (const budget of budgets) {
    if (!matchesRule(attributes, budget.match)) continue;
    if (best === null || budget.priority < best.priority) {
      best = budget;
    }
  }

  return best;
}

/**
 * 쿼리 속성에 매칭되는 모든 Budget을 우선순위 순으로 반환한다.
 * 디버그/모니터링용.
 */
export function matchAllBudgets(
  attributes: QueryAttributes,
  budgets: readonly BudgetDef[],
): readonly BudgetDef[] {
  return budgets
    .filter((b) => matchesRule(attributes, b.match))
    .toSorted((a, b) => a.priority - b.priority);
}

function matchesRule(attrs: QueryAttributes, rule: BudgetMatchRule): boolean {
  // fingerprint glob 매칭
  if (rule.fingerprint !== undefined && !matchGlob(attrs.fingerprint, rule.fingerprint)) {
    return false;
  }

  // operation 필터
  if (rule.operations && rule.operations.length > 0 && !rule.operations.includes(attrs.operation)) {
    return false;
  }

  // 테이블 필터
  if (rule.tables && rule.tables.length > 0) {
    if (!attrs.table || !rule.tables.includes(attrs.table)) return false;
  }

  // 서비스 필터
  if (rule.services && rule.services.length > 0) {
    if (!attrs.service || !rule.services.includes(attrs.service)) return false;
  }

  // 태그 조건 — 모든 key=value가 일치해야 함
  if (rule.tags) {
    for (const [key, value] of Object.entries(rule.tags)) {
      if (attrs.tags[key] !== value) return false;
    }
  }

  return true;
}

/**
 * 간단한 glob 매칭. * 와일드카드만 지원.
 *
 * @example
 * matchGlob("SELECT * FROM users WHERE id = ?", "SELECT * FROM users*") // true
 * matchGlob("SELECT * FROM orders WHERE id = ?", "SELECT * FROM users*") // false
 */
export function matchGlob(value: string, pattern: string): boolean {
  // 특수문자 이스케이프 (단, * 제외)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("^" + escaped.replace(/\*/g, ".*") + "$");
  return regex.test(value);
}
