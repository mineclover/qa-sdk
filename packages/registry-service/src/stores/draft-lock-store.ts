import type { DraftLock } from "../types/index.js";

export interface DraftLockStore {
  acquire(lock: DraftLock): Promise<void>;
  release(prefix: string, versionId: string): Promise<boolean>;
  get(prefix: string, versionId: string): Promise<DraftLock | null>;
  isLocked(prefix: string, versionId: string): Promise<boolean>;
  listAll(): Promise<DraftLock[]>;
}
