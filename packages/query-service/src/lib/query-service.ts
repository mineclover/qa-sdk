import {
  gateAwareResolve,
  gateFilterRanges,
  MetaRegistry,
  RelationalEngine,
  queryAcrossVersions as resolveAcrossVersions,
  type AddressStateCacheRecord,
  type ConflictStrategy,
  type EntityId,
  type GateAwareResult,
  type PatternRule,
  type RelationResolveResult,
  type RelationTypeRule,
  type ResolveResult,
  ValidationError,
} from "index-meta";
import type { Logger } from "pino";
import { AppError } from "./errors.js";
import {
  NoopGateStateClient,
  type GateStateClient,
} from "./gate-client.js";

export interface QueryServiceDeps {
  metaRegistry?: MetaRegistry;
  defaultStrategy?: ConflictStrategy;
  gateClient?: GateStateClient;
  gateFailureMode?: GateFailureMode;
  logger?: Pick<Logger, "warn">;
}

export interface QueryRelationTypeRule<T> extends Omit<RelationTypeRule<T>, "instanceRules"> {
  instanceRules?: {
    indexId: string;
    versionId: string;
    rules: PatternRule<T>[];
    strategy?: ConflictStrategy;
  };
}

export type GateFailureMode = "fail-open" | "fail-closed";
export type QueryGateMode = Parameters<typeof gateFilterRanges>[2];
export type QueryResolveResult<T> = ResolveResult<T> | GateAwareResult<T> | null;

export interface QueryResolveOptions {
  indexId?: string;
  versionId?: string;
  withGate?: boolean;
}

export interface QueryLookupService {
  readonly defaultStrategy: ConflictStrategy;
  resolvePolicy<T>(
    coord: readonly number[],
    rules: readonly PatternRule<T>[],
    shape: readonly number[],
    strategy?: ConflictStrategy,
    options?: QueryResolveOptions,
  ): Promise<QueryResolveResult<T>>;
  matchRanges(
    indexId: string,
    versionId: string,
    partial: Record<string, EntityId | null>,
    gateMode?: QueryGateMode | null,
  ): Promise<[number, number][]>;
  composeQuery(
    source: { indexId: string; versionId: string },
    through: string,
    targetConstraint: Record<string, EntityId | null>,
  ): [number, number][];
  queryAcrossVersions(
    indexId: string,
    versionIds: readonly string[],
    constraint: Record<string, EntityId | null>,
  ): Map<string, [number, number][]>;
  resolveRelation<T>(
    relTypeCoord: readonly number[],
    relShape: readonly number[],
    typeRules: readonly QueryRelationTypeRule<T>[],
    typeStrategy?: ConflictStrategy,
    instanceCoord?: readonly number[],
  ): RelationResolveResult<T> | null;
}

export class QueryService implements QueryLookupService {
  readonly defaultStrategy: ConflictStrategy;
  private readonly engine: RelationalEngine;
  private readonly gateClient: GateStateClient;
  private readonly gateFailureMode: GateFailureMode;
  private readonly logger?: Pick<Logger, "warn">;

  constructor(deps: {
    metaRegistry: MetaRegistry;
    defaultStrategy: ConflictStrategy;
    gateClient: GateStateClient;
    gateFailureMode: GateFailureMode;
    logger?: Pick<Logger, "warn">;
  }) {
    this.defaultStrategy = deps.defaultStrategy;
    this.engine = new RelationalEngine(deps.metaRegistry.toInput());
    this.gateClient = deps.gateClient;
    this.gateFailureMode = deps.gateFailureMode;
    this.logger = deps.logger;
  }

  async resolvePolicy<T>(
    coord: readonly number[],
    rules: readonly PatternRule<T>[],
    shape: readonly number[],
    strategy?: ConflictStrategy,
    options: QueryResolveOptions = {},
  ): Promise<QueryResolveResult<T>> {
    this.assertCoordLength(coord, shape, "coord");
    this.assertRulePatterns(rules, shape, "rules");

    const policyResult = this.engine.resolvePolicy(
      coord,
      rules,
      shape,
      strategy ?? this.defaultStrategy,
    );

    if (!options.withGate) {
      return policyResult;
    }

    const gateIndexId = options.indexId;
    const gateVersionId = options.versionId;
    if (!gateIndexId || !gateVersionId) {
      throw new ValidationError("indexId and versionId are required when withGate=true");
    }

    const wi = this.engine.registry.getWeightedIndex(gateIndexId, gateVersionId);
    this.assertShapeMatches(shape, wi.shape, gateIndexId, gateVersionId);

    const gateRecord = await this.loadGateRecord(gateIndexId, gateVersionId);
    const address = wi.encode([...coord]);

    return gateAwareResolve(policyResult, address, gateRecord);
  }

  async matchRanges(
    indexId: string,
    versionId: string,
    partial: Record<string, EntityId | null>,
    gateMode?: QueryGateMode | null,
  ): Promise<[number, number][]> {
    const ranges = this.engine.matchRanges(indexId, versionId, partial);
    if (!gateMode) {
      return ranges;
    }

    const gateRecord = await this.loadGateRecord(indexId, versionId);
    return gateFilterRanges(ranges, gateRecord, gateMode);
  }

  composeQuery(
    source: { indexId: string; versionId: string },
    through: string,
    targetConstraint: Record<string, EntityId | null>,
  ): [number, number][] {
    return this.engine.composeQuery(source, through, targetConstraint);
  }

  queryAcrossVersions(
    indexId: string,
    versionIds: readonly string[],
    constraint: Record<string, EntityId | null>,
  ): Map<string, [number, number][]> {
    return resolveAcrossVersions(indexId, versionIds, constraint, this.engine.registry);
  }

  resolveRelation<T>(
    relTypeCoord: readonly number[],
    relShape: readonly number[],
    typeRules: readonly QueryRelationTypeRule<T>[],
    typeStrategy?: ConflictStrategy,
    instanceCoord?: readonly number[],
  ): RelationResolveResult<T> | null {
    this.assertCoordLength(relTypeCoord, relShape, "relTypeCoord");
    this.assertRulePatterns(typeRules, relShape, "typeRules");

    const normalizedTypeRules: RelationTypeRule<T>[] = typeRules.map((rule) => ({
      ...rule,
      instanceRules: rule.instanceRules
        ? {
            ...rule.instanceRules,
            strategy: rule.instanceRules.strategy ?? this.defaultStrategy,
          }
        : undefined,
    }));

    return this.engine.resolveRelation(
      relTypeCoord,
      relShape,
      normalizedTypeRules,
      typeStrategy ?? this.defaultStrategy,
      instanceCoord,
    );
  }

  private assertCoordLength(
    coord: readonly number[],
    shape: readonly number[],
    label: string,
  ): void {
    if (coord.length !== shape.length) {
      throw new ValidationError(
        `${label} length ${coord.length} does not match shape length ${shape.length}`,
      );
    }
  }

  private assertRulePatterns(
    rules: readonly { id: string; pattern: readonly unknown[] }[],
    shape: readonly number[],
    label: string,
  ): void {
    for (const rule of rules) {
      if (rule.pattern.length !== shape.length) {
        throw new ValidationError(
          `${label} rule "${rule.id}" pattern length ${rule.pattern.length} does not match shape length ${shape.length}`,
        );
      }
    }
  }

  private assertShapeMatches(
    requestedShape: readonly number[],
    actualShape: readonly number[],
    indexId: string,
    versionId: string,
  ): void {
    if (
      requestedShape.length !== actualShape.length
      || requestedShape.some((value, index) => value !== actualShape[index])
    ) {
      throw new ValidationError(
        `shape ${JSON.stringify(requestedShape)} does not match registry shape ${JSON.stringify(actualShape)} for "${indexId}/${versionId}"`,
      );
    }
  }

  private async loadGateRecord(
    indexId: string,
    versionId: string,
  ): Promise<AddressStateCacheRecord | null> {
    try {
      return await this.gateClient.getStateRanges(indexId, versionId);
    } catch (error) {
      if (this.gateFailureMode === "fail-closed") {
        throw new AppError(
          "SERVICE_UNAVAILABLE",
          `gate-service unavailable for "${indexId}/${versionId}"`,
          503,
        );
      }

      this.logger?.warn(
        {
          err: error,
          indexId,
          versionId,
        },
        "gate-service unavailable, failing open",
      );
      return null;
    }
  }
}

export function createQueryService(deps: QueryServiceDeps = {}): QueryService {
  return new QueryService({
    metaRegistry: deps.metaRegistry ?? new MetaRegistry({ dims: {}, indices: {} }),
    defaultStrategy: deps.defaultStrategy ?? "most-specific",
    gateClient: deps.gateClient ?? new NoopGateStateClient(),
    gateFailureMode: deps.gateFailureMode ?? "fail-open",
    logger: deps.logger,
  });
}
