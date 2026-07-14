// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

import type { MarginalDensityReadModel } from '../../domain/density.types.js';

/** density compute 입력 — query string 좌표 3 종. */
export interface ComputeDensityArgs {
  readonly catalog: string;
  readonly prefix: string;
  readonly version: string;
}

/**
 * Density read-model query port.
 *
 * 본 슬라이스는 pure read-model — primary store 가 없고 cross-domain 두
 * 경로 (key_observations + prefix_catalog) 를 합성해 §5 §3.1 응답을 산출한다.
 */
export abstract class DensityReadModelQuery {
  abstract compute(args: ComputeDensityArgs): Promise<MarginalDensityReadModel>;
}
