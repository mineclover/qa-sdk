import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  InMemoryPrefixRegistry,
  detectPatternConflicts,
  type ConflictReport,
  type PrefixRegistry,
} from "index-meta";
import type { PolicyRulePayload } from "../schemas/policy-rule.js";
import type {
  PolicyRuleStore,
  StoredPolicyRule,
} from "../stores/policy-rule-store.js";
import { AppError } from "./errors.js";

export interface RuleServiceDeps {
  policyRuleStore: PolicyRuleStore<unknown>;
  prefixRegistry?: PrefixRegistry;
  now?: () => Date;
}

export interface RuleMutationResult {
  rule: StoredPolicyRule<unknown>;
  conflicts: ConflictReport<unknown>[];
}

export class RuleService {
  constructor(
    private readonly policyRuleStore: PolicyRuleStore<unknown>,
    private readonly prefixRegistry: PrefixRegistry,
    private readonly now: () => Date,
  ) {}

  listRules(indexId: string, versionId: string) {
    return this.policyRuleStore.findByIndex(indexId, versionId);
  }

  getRule(id: string) {
    return this.policyRuleStore.findById(id);
  }

  async createRule(
    payload: PolicyRulePayload,
    force = false,
  ): Promise<RuleMutationResult> {
    const timestamp = this.now().toISOString();
    const rule: StoredPolicyRule<unknown> = {
      id: randomUUID(),
      indexId: payload.indexId,
      versionId: payload.versionId,
      pattern: payload.pattern,
      value: payload.value,
      priority: payload.priority,
      ruleSetId: payload.ruleSetId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const conflicts = await this.validateConflicts(rule);
    if (conflicts.length > 0 && !force) {
      throw new AppError("CONFLICT", "rule conflicts detected", 409, { conflicts });
    }

    return {
      rule: await this.policyRuleStore.insert(rule),
      conflicts,
    };
  }

  async updateRule(
    id: string,
    payload: PolicyRulePayload,
    force = false,
  ): Promise<RuleMutationResult> {
    const existing = await this.policyRuleStore.findById(id);
    const rule: StoredPolicyRule<unknown> = {
      id,
      indexId: payload.indexId,
      versionId: payload.versionId,
      pattern: payload.pattern,
      value: payload.value,
      priority: payload.priority,
      ruleSetId: payload.ruleSetId,
      createdAt: existing.createdAt,
      updatedAt: this.now().toISOString(),
    };

    const conflicts = await this.validateConflicts(rule, id);
    if (conflicts.length > 0 && !force) {
      throw new AppError("CONFLICT", "rule conflicts detected", 409, { conflicts });
    }

    return {
      rule: await this.policyRuleStore.update(rule),
      conflicts,
    };
  }

  deleteRule(id: string) {
    return this.policyRuleStore.delete(id);
  }

  private async validateConflicts(
    candidate: StoredPolicyRule<unknown>,
    ignoredId?: string,
  ): Promise<ConflictReport<unknown>[]> {
    const shape = await this.prefixRegistry.getShape(
      candidate.indexId,
      candidate.versionId,
    );

    if (!shape) {
      throw new AppError(
        "NOT_FOUND",
        `index shape not found: "${candidate.indexId}/${candidate.versionId}"`,
        404,
      );
    }

    if (candidate.pattern.length !== shape.length) {
      throw new AppError(
        "INVALID_INPUT",
        `pattern length ${candidate.pattern.length} does not match shape length ${shape.length}`,
        400,
      );
    }

    const existingRules = await this.policyRuleStore.findByIndex(
      candidate.indexId,
      candidate.versionId,
    );
    const comparableRules = existingRules.filter((rule) => rule.id !== ignoredId);

    return detectPatternConflicts(
      [...comparableRules, candidate],
      shape,
      isDeepStrictEqual,
    );
  }
}

export function createRuleService(deps: RuleServiceDeps): RuleService {
  return new RuleService(
    deps.policyRuleStore,
    deps.prefixRegistry ?? new InMemoryPrefixRegistry(),
    deps.now ?? (() => new Date()),
  );
}
