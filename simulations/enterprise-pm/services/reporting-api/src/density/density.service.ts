// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * MarginalDensityService — §5 §2.1 알고리즘.
 *
 *   for each axis_i in prefix.shape:
 *     observed_distinct = COUNT(DISTINCT decode(packed_key)[i])
 *                         FROM key_observations
 *                         WHERE prefix_id=? AND version=?
 *     marginal_density(axis_i) = observed_distinct / shape[axis_i]
 *
 * §5 §3.1 응답 schema — catalog / prefix / version / axes[] / underutilizedAxes / saturatedAxes.
 * §5 §3.4 threshold — underutilized < 0.1 / saturated > 0.9.
 *
 * decode 실패는 silent skip + warn (no fallback approximation).
 * missing prefix → throw (no fallback).
 */

import { Inject, Injectable } from "@nestjs/common";
import type { DisjointUnionIndex } from "weighted-index";

export const DENSITY_OPTIONS = Symbol("DENSITY_OPTIONS");

export interface KeyObservationRow {
  prefix_id: string;
  version: string;
  packed_key: number;
  count: number;
}

export interface KeyObservationStore {
  listObservations(args: {
    prefix_id: string;
    version: string;
  }): Promise<KeyObservationRow[]>;
}

export interface PrefixAxis {
  /** 사람 읽는 이름 (union variant의 kind와 동일). */
  name: string;
  /** axis의 label 목록 — length == shape[axis_i]. */
  labels: readonly string[];
}

export interface PrefixDescriptor {
  id: string;
  version: string;
  union: DisjointUnionIndex;
  axes: readonly PrefixAxis[];
  /** coords가 1-based (WeightedIndex 규약) 인지 여부. 기본 true. */
  coordsOneBased?: boolean;
}

export interface PrefixCatalog {
  resolve(id: string): Promise<PrefixDescriptor | null>;
}

export interface MarginalDensityThresholds {
  /** density < this → underutilized. §5 §3.4 default 0.1. */
  underutilizedBelow: number;
  /** density > this → saturated. §5 §3.4 default 0.9. */
  saturatedAbove: number;
}

export interface DensityServiceLogger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface MarginalDensityServiceOptions {
  keyObservationStore: KeyObservationStore;
  prefixCatalog: PrefixCatalog;
  thresholds: MarginalDensityThresholds;
  logger?: DensityServiceLogger;
}

export interface ComputeArgs {
  catalog: string;
  prefix: string;
  version: string;
}

/** §5 §3.1 응답 schema — 1:1 매칭. */
export interface MarginalDensityResponse {
  catalog: string;
  prefix: string;
  version: string;
  axes: Array<{
    axisName: string;
    shapeCapacity: number;
    observedDistinct: number;
    marginalDensity: number;
    unobservedEntries: string[];
  }>;
  underutilizedAxes: string[];
  saturatedAxes: string[];
}

const NOOP_LOGGER: DensityServiceLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

@Injectable()
export class MarginalDensityService {
  private readonly logger: DensityServiceLogger;

  constructor(
    @Inject(DENSITY_OPTIONS)
    private readonly opts: MarginalDensityServiceOptions,
  ) {
    this.logger = opts.logger ?? NOOP_LOGGER;
  }

  async compute(args: ComputeArgs): Promise<MarginalDensityResponse> {
    const desc = await this.opts.prefixCatalog.resolve(args.prefix);
    if (!desc) {
      throw new Error(`prefix not found: ${args.prefix}`);
    }
    if (desc.version !== args.version) {
      throw new Error(
        `prefix version mismatch: requested ${args.version}, catalog has ${desc.version}`,
      );
    }

    const rows = await this.opts.keyObservationStore.listObservations({
      prefix_id: args.prefix,
      version: args.version,
    });

    // axis name → observed coord index(0-based) set.
    const observedByAxis = new Map<string, Set<number>>();
    for (const axis of desc.axes) observedByAxis.set(axis.name, new Set());

    const coordsOneBased = desc.coordsOneBased ?? true;

    for (const row of rows) {
      let decoded: { kind: string; coords: number[] };
      try {
        decoded = desc.union.decode(row.packed_key);
      } catch (err) {
        this.logger.warn(
          {
            packed_key: row.packed_key,
            prefix: args.prefix,
            err: (err as Error).message,
          },
          "key_observations decode 실패 — silent skip + warn",
        );
        continue;
      }
      const set = observedByAxis.get(decoded.kind);
      if (!set) {
        // axis not in catalog — schema drift
        this.logger.warn(
          { kind: decoded.kind, prefix: args.prefix },
          "decoded kind not in catalog axes — skip",
        );
        continue;
      }
      // axis는 1차원 가정 — coords[0]만 distinct로 카운트.
      // (다차원은 본 plan 범위 외 — §5 §3.1 단일 prefix + 단일 version 가정)
      if (decoded.coords.length < 1) continue;
      const raw = decoded.coords[0];
      const idx = coordsOneBased ? raw - 1 : raw;
      if (idx < 0) {
        this.logger.warn(
          {
            kind: decoded.kind,
            raw,
            prefix: args.prefix,
          },
          "decoded coord index out of range — skip",
        );
        continue;
      }
      set.add(idx);
    }

    const axes = desc.axes.map((axis) => {
      const observed = observedByAxis.get(axis.name)!;
      const shapeCapacity = axis.labels.length;
      const observedDistinct = observed.size;
      const marginalDensity =
        shapeCapacity === 0 ? 0 : observedDistinct / shapeCapacity;
      const unobservedEntries: string[] = [];
      for (let i = 0; i < axis.labels.length; i++) {
        if (!observed.has(i)) unobservedEntries.push(axis.labels[i]);
      }
      return {
        axisName: axis.name,
        shapeCapacity,
        observedDistinct,
        marginalDensity,
        unobservedEntries,
      };
    });

    const underutilizedAxes = axes
      .filter((a) => a.marginalDensity < this.opts.thresholds.underutilizedBelow)
      .map((a) => a.axisName);
    const saturatedAxes = axes
      .filter((a) => a.marginalDensity > this.opts.thresholds.saturatedAbove)
      .map((a) => a.axisName);

    return {
      catalog: args.catalog,
      prefix: args.prefix,
      version: args.version,
      axes,
      underutilizedAxes,
      saturatedAxes,
    };
  }
}
