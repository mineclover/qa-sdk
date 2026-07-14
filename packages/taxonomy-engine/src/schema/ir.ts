export type Severity = 'error' | 'warning' | 'info';

export type RelationKind = 'contains' | 'parent-of' | 'depends-on' | 'binds' | 'projects-to';

export type ConstraintKind = 'capacity' | 'structural' | 'ref' | 'custom';

export type Lifecycle = 'draft' | 'review' | 'approved' | 'deprecated' | 'archived' | 'tbd';

export type EntryIR = {
  id: string;
  address: number;
  label?: string;
  meta?: Record<string, unknown>;
  lifecycle?: Lifecycle;
  placeholderReason?: string;
  decisionLink?: string;
  _loc?: { line: number; column: number };
};

export type AxisIR = {
  name: string;
  description?: string;
  entries: EntryIR[];
  capacity: number;
  version: number;
  lifecycle?: Lifecycle;
  _loc?: { line: number; column: number };
};

export type RelationRule = Record<string, string>;

export type RelationIR = {
  name: string;
  from: string[];
  to: string[];
  kind: RelationKind;
  rules: RelationRule[];
  _loc?: { line: number; column: number };
};

export type ConstraintRule = string | Record<string, unknown>;

export type ConstraintIR = {
  id: string;
  kind: ConstraintKind;
  rule: ConstraintRule;
  severity: Severity;
  _loc?: { line: number; column: number };
};

export type ImportIR = {
  taxonomy: string;
  version?: number;
  as: string;
};

export type TaxonomyIR = {
  taxonomy: string;
  version: number;
  description?: string;
  contentHash: string;
  axes: Map<string, AxisIR>;
  relations: Map<string, RelationIR>;
  constraints: ConstraintIR[];
  imports: ImportIR[];
};

export type Coordinate = Record<string, string>;
