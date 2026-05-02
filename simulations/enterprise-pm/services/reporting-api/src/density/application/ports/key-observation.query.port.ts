// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * Cross-domain query port — ingest 도메인의 key_observations 를 조회한다.
 *
 * Read-model 슬라이스의 source-of-truth 가 본 서비스 외부에 있으므로 어댑터는
 * 외부 store (PG ingest schema 또는 memory fixture) 를 wrapping 한다.
 */
export interface KeyObservationRow {
  readonly prefix_id: string;
  readonly version: string;
  readonly packed_key: number;
  readonly count: number;
}

export abstract class KeyObservationQueryPort {
  abstract listObservations(args: {
    prefix_id: string;
    version: string;
  }): Promise<KeyObservationRow[]>;
}
