import type { DocRecord, DocHistoryRecord, SliceIntentRecord, ConsumptionSnapshot } from "../core/types.js";
import type { DocStore, IntentStore, ConsumptionStore } from "../core/interfaces.js";
import { decideVersion } from "../core/doc-versioner.js";
import { diagnoseSnapshot } from "../core/consumption-diagnostics.js";

// ─── InMemoryDocStore ────────────────────────────────────

export class InMemoryDocStore implements DocStore {
  private readonly docs = new Map<string, DocRecord>();
  private readonly history = new Map<string, DocHistoryRecord[]>();

  upsert(
    doc: DocRecord,
    body: string,
  ): { action: "created" | "updated" | "unchanged"; version: number } {
    const existing = this.docs.get(doc.docId) ?? null;
    const decision = decideVersion(existing, doc);

    if (decision.action === "unchanged") {
      return { action: "unchanged", version: decision.version };
    }

    const { version, changeType } = decision;
    const record: DocRecord = { ...doc, version };
    this.docs.set(doc.docId, record);

    const historyEntry: DocHistoryRecord = { ...record, body, changeType };
    const entries = this.history.get(doc.docId) ?? [];
    entries.push(historyEntry);
    this.history.set(doc.docId, entries);

    return { action: decision.action, version };
  }

  get(docId: string): DocRecord | null {
    return this.docs.get(docId) ?? null;
  }

  list(filter?: {
    scope?: string;
    aspect?: string;
    lifecycle?: string;
  }): DocRecord[] {
    let result = Array.from(this.docs.values());
    if (filter?.scope) result = result.filter((d) => d.scope === filter.scope);
    if (filter?.aspect) result = result.filter((d) => d.aspect === filter.aspect);
    if (filter?.lifecycle) result = result.filter((d) => d.lifecycle === filter.lifecycle);
    return result.sort((a, b) => a.docId.localeCompare(b.docId));
  }

  getHistory(docId: string, limit = 50): DocHistoryRecord[] {
    const entries = this.history.get(docId) ?? [];
    return entries.slice(-limit).reverse();
  }

  getVersion(docId: string, version: number): DocHistoryRecord | null {
    const entries = this.history.get(docId) ?? [];
    return entries.find((e) => e.version === version) ?? null;
  }

}

// ─── InMemoryIntentStore ─────────────────────────────────

export class InMemoryIntentStore implements IntentStore {
  private nextId = 1;
  private readonly intents = new Map<number, SliceIntentRecord>();

  create(intent: {
    prefixId: string;
    sliceJson: string;
    sliceDepth: number;
    intent: string;
    observationGoal?: string;
    owner?: string;
  }): number {
    const id = this.nextId++;
    const now = new Date().toISOString();
    this.intents.set(id, {
      id,
      prefixId: intent.prefixId,
      sliceJson: intent.sliceJson,
      sliceDepth: intent.sliceDepth,
      intent: intent.intent,
      observationGoal: intent.observationGoal,
      owner: intent.owner,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  update(
    id: number,
    patch: { intent?: string; observationGoal?: string; owner?: string },
  ): void {
    const existing = this.intents.get(id);
    if (!existing) return;
    this.intents.set(id, {
      ...existing,
      ...(patch.intent !== undefined && { intent: patch.intent }),
      ...(patch.observationGoal !== undefined && { observationGoal: patch.observationGoal }),
      ...(patch.owner !== undefined && { owner: patch.owner }),
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  remove(id: number): boolean {
    return this.intents.delete(id);
  }

  listByPrefix(prefixId: string): SliceIntentRecord[] {
    return Array.from(this.intents.values())
      .filter((i) => i.prefixId === prefixId)
      .sort((a, b) => a.sliceDepth - b.sliceDepth || a.id - b.id);
  }
}

// ─── InMemoryConsumptionStore ────────────────────────────

export class InMemoryConsumptionStore implements ConsumptionStore {
  private nextId = 1;
  private readonly snapshots: ConsumptionSnapshot[] = [];

  record(snapshot: ConsumptionSnapshot): number {
    const id = this.nextId++;
    const diagnosis = diagnoseSnapshot(snapshot);
    this.snapshots.push({ ...snapshot, id, severity: diagnosis.severity });
    return id;
  }

  latest(prefixId: string): ConsumptionSnapshot | null {
    const filtered = this.snapshots
      .filter((s) => s.prefixId === prefixId)
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    return filtered[0] ?? null;
  }

  history(prefixId: string, limit = 30): ConsumptionSnapshot[] {
    return this.snapshots
      .filter((s) => s.prefixId === prefixId)
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
      .slice(0, limit);
  }
}
