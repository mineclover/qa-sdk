// @def.boundary registry-system
// @def.doc registry-system

import type { PrefixOwnerRecord, PrefixProfileMeta } from "../types/index.js";

export interface PrefixProfilePatch {
  name?: string;
  meta?: Partial<PrefixProfileMeta>;
  labels?: readonly string[];
}

export interface PrefixOwnerStore {
  register(record: PrefixOwnerRecord): Promise<void>;
  get(prefix: string): Promise<PrefixOwnerRecord | null>;
  list(): Promise<PrefixOwnerRecord[]>;
  delete(prefix: string): Promise<void>;
  patch(prefix: string, patch: PrefixProfilePatch): Promise<void>;
}
