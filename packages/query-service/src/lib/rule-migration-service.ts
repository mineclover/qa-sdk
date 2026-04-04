/**
 * rule-migration-service.ts — index version 변경 시 규칙 자동 변환.
 *
 * translateConstraint를 이용해 StoredPolicyRule의 pattern을
 * 이전 버전에서 새 버전의 position 기준으로 변환한다.
 */
import {
  translateConstraint,
  type MetaRegistry,
  type CoordConstraint,
} from "index-meta";
import type {
  PolicyRuleStore,
  StoredPolicyRule,
} from "../stores/policy-rule-store.js";
import { AppError } from "./errors.js";

export interface RuleMigrationServiceDeps {
  policyRuleStore: PolicyRuleStore<unknown>;
  metaRegistry: MetaRegistry;
  now?: () => Date;
}

export interface RuleMigrationResult {
  /** 변환 성공한 규칙 수 */
  migrated: number;
  /** 변환 실패(entity가 target version에 없음)로 건너뛴 규칙 ID */
  skipped: string[];
  /** 변환된 규칙 목록 */
  rules: StoredPolicyRule<unknown>[];
}

/**
 * StoredPolicyRule의 pattern(CoordConstraint[])을 dim별 Record로 변환.
 *
 * translateConstraint는 Record<dimId, CoordConstraint> 형태를 받으므로,
 * pattern 배열을 index 정의의 dim 순서에 따라 Record로 매핑한다.
 */
function patternToConstraintRecord(
  pattern: CoordConstraint[],
  dimIds: readonly string[],
): Record<string, CoordConstraint> {
  const record: Record<string, CoordConstraint> = {};
  for (let i = 0; i < dimIds.length; i++) {
    record[dimIds[i]!] = pattern[i] ?? null;
  }
  return record;
}

/**
 * Record 형태의 constraint를 다시 pattern 배열로 변환.
 */
function constraintRecordToPattern(
  record: Record<string, CoordConstraint>,
  dimIds: readonly string[],
): CoordConstraint[] {
  return dimIds.map((dimId) => record[dimId] ?? null);
}

export class RuleMigrationService {
  constructor(
    private readonly policyRuleStore: PolicyRuleStore<unknown>,
    private readonly metaRegistry: MetaRegistry,
    private readonly now: () => Date,
  ) {}

  /**
   * 특정 index의 규칙을 fromVersion에서 toVersion으로 일괄 변환한다.
   *
   * - 각 규칙의 pattern을 translateConstraint로 변환
   * - 변환 불가(entity 미존재)인 규칙은 skipped로 보고
   * - 변환된 규칙은 versionId를 toVersion으로 갱신하여 store에 반영
   * - 원자적 수행: 하나라도 store.update 실패 시 예외 전파
   */
  async migrateRules(
    indexId: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<RuleMigrationResult> {
    if (fromVersion === toVersion) {
      throw new AppError(
        "INVALID_INPUT",
        "fromVersion과 toVersion이 동일합니다",
        400,
      );
    }

    // index 정의에서 dim 목록 확보 (translateConstraint에 필요)
    let dimIds: readonly string[];
    try {
      const indexDef = this.metaRegistry.getIndexDef(indexId);
      dimIds = indexDef.dims;
    } catch {
      throw new AppError(
        "NOT_FOUND",
        `index "${indexId}" not found in MetaRegistry`,
        404,
      );
    }

    // fromVersion, toVersion 유효성 확인
    try {
      this.metaRegistry.getIndexVersion(indexId, fromVersion);
    } catch {
      throw new AppError(
        "NOT_FOUND",
        `version "${fromVersion}" not found for index "${indexId}"`,
        404,
      );
    }
    try {
      this.metaRegistry.getIndexVersion(indexId, toVersion);
    } catch {
      throw new AppError(
        "NOT_FOUND",
        `version "${toVersion}" not found for index "${indexId}"`,
        404,
      );
    }

    // 해당 index + fromVersion의 모든 규칙 조회
    const rules = await this.policyRuleStore.findByIndex(indexId, fromVersion);

    const migrated: StoredPolicyRule<unknown>[] = [];
    const skipped: string[] = [];
    const timestamp = this.now().toISOString();

    for (const rule of rules) {
      // pattern을 dim별 Record로 변환
      const constraintRecord = patternToConstraintRecord(rule.pattern, dimIds);

      // translateConstraint로 position 변환
      const translated = translateConstraint(
        indexId,
        fromVersion,
        toVersion,
        constraintRecord,
        this.metaRegistry,
      );

      if (translated === null) {
        // entity가 target version에 없어서 변환 불가
        skipped.push(rule.id);
        continue;
      }

      // 변환된 constraint를 다시 pattern으로
      const newPattern = constraintRecordToPattern(translated, dimIds);

      const updatedRule: StoredPolicyRule<unknown> = {
        ...rule,
        versionId: toVersion,
        pattern: newPattern,
        updatedAt: timestamp,
      };

      const stored = await this.policyRuleStore.update(updatedRule);
      migrated.push(stored);
    }

    return {
      migrated: migrated.length,
      skipped,
      rules: migrated,
    };
  }
}

export function createRuleMigrationService(
  deps: RuleMigrationServiceDeps,
): RuleMigrationService {
  return new RuleMigrationService(
    deps.policyRuleStore,
    deps.metaRegistry,
    deps.now ?? (() => new Date()),
  );
}
