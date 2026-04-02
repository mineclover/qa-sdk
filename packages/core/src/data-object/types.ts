// ── DataObject Binding — DataSchema ↔ prefix 바인딩 ───────────

export interface ColumnAxisMapping {
  dimLabel: string;
  segmentId?: string;
}

export interface DataObjectBinding {
  schemaId: string;
  schemaVersion: string;
  prefixId: string;
  prefixVersion: string;
  columnToAxis: Record<string, ColumnAxisMapping>;
}

export interface BindingValidation {
  schemaId: string;
  prefixId: string;
  errors: string[];
  warnings: string[];
}

export interface LineageChainValidation {
  bound: number;
  unbound: number;
  mismatched: number;
}

export interface BoundDataObject<
  S extends string,
  P extends string,
> {
  readonly schemaId: S;
  readonly prefixId: P;
  readonly data: Record<string, unknown>;
  readonly address: number;
  readonly serialized: string;
}
