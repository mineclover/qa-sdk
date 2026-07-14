// @def.boundary sim-reporting-api
// @def.doc event-taxonomy-marginal-density

/**
 * 도메인 예외 — framework-free.
 *
 * mapDomainErrorToHttp 가 name 으로 status 결정.
 *   - NotFoundError → 404
 *   - ValidationError → 400
 */
export class DensityDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DensityDomainException';
  }
}

/** prefix catalog 미존재 (HTTP 404). */
export class PrefixNotFoundException extends DensityDomainException {
  constructor(public readonly prefix: string) {
    super('PREFIX_NOT_FOUND', `prefix not found: ${prefix}`);
    this.name = 'NotFoundError';
  }
}

/** prefix 버전 불일치 (HTTP 409 — capacity 변화 중 stale request). */
export class PrefixVersionMismatchException extends DensityDomainException {
  constructor(
    public readonly prefix: string,
    public readonly requested: string,
    public readonly catalog: string,
  ) {
    super(
      'PREFIX_VERSION_MISMATCH',
      `prefix version mismatch: requested ${requested}, catalog has ${catalog}`,
    );
    this.name = 'ConflictError';
  }
}
