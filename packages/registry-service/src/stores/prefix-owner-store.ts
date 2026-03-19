import type { PrefixOwnerRecord } from "../types/index.js";

export interface PrefixOwnerStore {
  register(record: PrefixOwnerRecord): Promise<void>;
  get(prefix: string): Promise<PrefixOwnerRecord | null>;
  list(): Promise<PrefixOwnerRecord[]>;
  delete(prefix: string): Promise<void>;
}
