import { Injectable, Inject } from "@nestjs/common";
import type Database from "better-sqlite3";
import { sliceDepth } from "definition-catalog";
import { DATABASE } from "../../database.module.js";
import { SqlIntentStore } from "../../stores/intent-store.js";
import type { IntentStore } from "../../core/interfaces.js";
import type { SliceIntentRecord } from "../../core/types.js";
import { parseDimsParam, resolveMatchingIntents } from "../../core/intent-resolver.js";

@Injectable()
export class IntentsService {
  private readonly store: IntentStore;

  constructor(@Inject(DATABASE) db: Database.Database) {
    this.store = new SqlIntentStore(db);
  }

  listByPrefix(prefixId: string): SliceIntentRecord[] {
    return this.store.listByPrefix(prefixId);
  }

  resolve(prefixId: string, dimsParam: string): { address: Record<string, string>; matched: SliceIntentRecord[] } {
    const address = parseDimsParam(dimsParam);
    const all = this.store.listByPrefix(prefixId);
    const matched = resolveMatchingIntents(address, all);
    return { address, matched };
  }

  create(prefixId: string, slice: Record<string, string>, intent: string, observationGoal?: string, owner?: string): number {
    return this.store.create({
      prefixId,
      sliceJson: JSON.stringify(slice),
      sliceDepth: sliceDepth(slice),
      intent,
      observationGoal,
      owner,
    });
  }

  update(id: number, patch: { intent?: string; observationGoal?: string; owner?: string }): void {
    this.store.update(id, patch);
  }

  remove(id: number): boolean {
    return this.store.remove(id);
  }
}
