export interface AxisProfileRecord {
  readonly id: string;
  readonly catalogId: string;
  readonly name: string;
  readonly currentVersion: string;
  readonly capacity: number;
  readonly entryCount: number;
  readonly meta?: Record<string, unknown>;
  readonly updatedAt: string;
}

export interface AxisProfilePatch {
  name?: string;
  capacity?: number;
  currentVersion?: string;
  entryCount?: number;
  meta?: Record<string, unknown>;
}

export interface AxisProfileStore {
  register(record: AxisProfileRecord): Promise<void>;
  get(id: string, catalogId: string): Promise<AxisProfileRecord | null>;
  list(catalogId: string): Promise<AxisProfileRecord[]>;
  patch(id: string, catalogId: string, patch: AxisProfilePatch): Promise<void>;
  delete(id: string, catalogId: string): Promise<void>;
}
