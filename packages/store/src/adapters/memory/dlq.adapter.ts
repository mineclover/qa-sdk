// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type { DlqInsert, DlqStore, StoredDlqItem } from "@qa-sdk/core";

/** DlqStore의 in-memory 구현 */
export class InMemoryDlqStore implements DlqStore {
  private readonly items = new Map<string, StoredDlqItem>();

  async insert(params: DlqInsert): Promise<void> {
    if (this.items.has(params.id)) {
      throw new Error(`DLQ item already exists for id: ${params.id}`);
    }

    this.items.set(params.id, {
      ...structuredClone(params),
      attemptCount: 0,
      lastAttemptedAt: null,
      createdAt: new Date(),
      resolvedAt: null,
    });
  }

  async findPending(limit = 100): Promise<StoredDlqItem[]> {
    return Array.from(this.items.values())
      .filter((item) => item.resolvedAt === null)
      .toSorted((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, limit)
      .map((item) => structuredClone(item));
  }

  async markAttempted(id: string): Promise<void> {
    const existing = this.items.get(id);

    if (!existing) {
      return;
    }

    this.items.set(id, {
      ...existing,
      attemptCount: existing.attemptCount + 1,
      lastAttemptedAt: new Date(),
    });
  }

  async markResolved(id: string): Promise<void> {
    const existing = this.items.get(id);

    if (!existing) {
      return;
    }

    this.items.set(id, {
      ...existing,
      resolvedAt: new Date(),
    });
  }
}
