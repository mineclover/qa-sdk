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
