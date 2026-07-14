// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * MarginalDensity read-model 어댑터 — §5 §2.1 알고리즘.
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
 * missing prefix → throw PrefixNotFoundException (no fallback).
 */

import {
  DensityReadModelQuery,
  type ComputeDensityArgs,
} from '../../application/queries/density-read-model.query.js';
import { KeyObservationQueryPort } from '../../application/ports/key-observation.query.port.js';
import { PrefixCatalogQueryPort } from '../../application/ports/prefix-catalog.query.port.js';
import type { DensityLoggerPort } from '../../application/ports/density-logger.port.js';
import type {
  MarginalDensityAxisReadModel,
  MarginalDensityReadModel,
} from '../../domain/density.types.js';
import {
  PrefixNotFoundException,
  PrefixVersionMismatchException,
} from '../../domain/density.exceptions.js';

export interface MarginalDensityThresholds {
  /** density < this → underutilized. §5 §3.4 default 0.1. */
  readonly underutilizedBelow: number;
  /** density > this → saturated. §5 §3.4 default 0.9. */
  readonly saturatedAbove: number;
}

export class MarginalDensityReadModelAdapter extends DensityReadModelQuery {
  constructor(
    private readonly observations: KeyObservationQueryPort,
    private readonly catalog: PrefixCatalogQueryPort,
    private readonly thresholds: MarginalDensityThresholds,
    private readonly logger?: DensityLoggerPort,
  ) {
    super();
  }

  async compute(args: ComputeDensityArgs): Promise<MarginalDensityReadModel> {
    const desc = await this.catalog.resolve(args.prefix);
    if (!desc) {
      throw new PrefixNotFoundException(args.prefix);
    }
    if (desc.version !== args.version) {
      throw new PrefixVersionMismatchException(args.prefix, args.version, desc.version);
    }

    const rows = await this.observations.listObservations({
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
        this.warn(
          {
            packed_key: row.packed_key,
            prefix: args.prefix,
            err: (err as Error).message,
          },
          'key_observations decode 실패 — silent skip + warn',
        );
        continue;
      }
      const set = observedByAxis.get(decoded.kind);
      if (!set) {
        // axis not in catalog — schema drift
        this.warn(
          { kind: decoded.kind, prefix: args.prefix },
          'decoded kind not in catalog axes — skip',
        );
        continue;
      }
      // axis 는 1차원 가정 — coords[0] 만 distinct 로 카운트.
      if (decoded.coords.length < 1) continue;
      const raw = decoded.coords[0];
      const idx = coordsOneBased ? raw - 1 : raw;
      if (idx < 0) {
        this.warn(
          { kind: decoded.kind, raw, prefix: args.prefix },
          'decoded coord index out of range — skip',
        );
        continue;
      }
      set.add(idx);
    }

    const axes: MarginalDensityAxisReadModel[] = desc.axes.map((axis) => {
      const observed = observedByAxis.get(axis.name)!;
      const shapeCapacity = axis.labels.length;
      const observedDistinct = observed.size;
      const marginalDensity = shapeCapacity === 0 ? 0 : observedDistinct / shapeCapacity;
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
      .filter((a) => a.marginalDensity < this.thresholds.underutilizedBelow)
      .map((a) => a.axisName);
    const saturatedAxes = axes
      .filter((a) => a.marginalDensity > this.thresholds.saturatedAbove)
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

  private warn(obj: Record<string, unknown>, msg: string): void {
    if (!this.logger) return;
    // SliceLogContext 외 추가 필드는 default adapter 가 child(ctx) 로
    // 흡수한다 — strict 타입은 SliceLogContext 만 허용하므로 cast.
    this.logger.warn(
      {
        domain: 'density',
        useCase: 'MarginalDensity.compute',
        ...obj,
      } as never,
      msg,
    );
  }
}
