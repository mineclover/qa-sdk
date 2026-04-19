// @def.boundary index-meta-system
// @def.doc index-meta-system

export class IndexMetaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DimNotFoundError extends IndexMetaError {}
export class SnapshotNotFoundError extends IndexMetaError {}
export class IndexNotFoundError extends IndexMetaError {}
export class IndexVersionNotFoundError extends IndexMetaError {}
export class EntryNotFoundError extends IndexMetaError {}
export class MigrationNotFoundError extends IndexMetaError {}
export class ValidationError extends IndexMetaError {}
export class ParseError extends IndexMetaError {}
export class NegotiationError extends IndexMetaError {}

export class CapacityOverflowError extends IndexMetaError {
  readonly indexId: string;
  readonly versionId: string;
  readonly productBig: bigint;

  constructor(indexId: string, versionId: string, productBig: bigint, detail?: string) {
    const base = `Index "${indexId}/${versionId}": shape product (${productBig}) exceeds Number.MAX_SAFE_INTEGER (2^53).`;
    super(detail ? `${base} ${detail}` : base);
    this.indexId = indexId;
    this.versionId = versionId;
    this.productBig = productBig;
  }
}
