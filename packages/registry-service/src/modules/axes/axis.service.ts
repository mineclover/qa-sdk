import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AxisProfileRecord, AxisProfileStore } from "../../stores/axis-profile-store.js";

export const AXIS_STORE = "AXIS_STORE";
export const AXIS_CHANGE_HANDLER = "AXIS_CHANGE_HANDLER";

type AxisCreatePayload = {
  id?: string | null;
  name?: string | null;
  capacity?: number | null;
  entryCount?: number | null;
  meta?: Record<string, unknown> | null;
};

type AxisEntryPayload = {
  entry?: string | null;
};

export interface AxisChangeHandler {
  axisChanged(catalogId: string, axisId: string): void | Promise<void>;
}

export class AxisHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error: string; headroom?: number },
  ) {
    super(body.error);
  }
}

@Injectable()
export class AxisService {
  constructor(
    @Inject(AXIS_STORE) private readonly axisStore: AxisProfileStore,
    @Optional() @Inject(AXIS_CHANGE_HANDLER) private readonly changeHandler?: AxisChangeHandler,
  ) {}

  static fromStores(deps: {
    axisStore: AxisProfileStore;
    onAxisChange?: (catalogId: string, axisId: string) => void | Promise<void>;
  }) {
    return new AxisService(
      deps.axisStore,
      deps.onAxisChange
        ? {
            axisChanged: (catalogId: string, axisId: string) => deps.onAxisChange!(catalogId, axisId),
          }
        : undefined,
    );
  }

  list(catalogId: string) {
    return this.axisStore.list(catalogId);
  }

  get(catalogId: string, id: string) {
    return this.requireAxis(catalogId, id);
  }

  async register(catalogId: string, input: unknown) {
    const body = this.asCreatePayload(input);
    if (!body.id || !body.name) {
      throw new AxisHttpError(400, { error: "id, name 필수" });
    }

    const existing = await this.axisStore.get(body.id, catalogId);
    if (existing) {
      throw new AxisHttpError(409, { error: `Axis '${body.id}' already exists` });
    }

    const now = new Date().toISOString();
    await this.axisStore.register({
      id: body.id,
      catalogId,
      name: body.name,
      currentVersion: "v1",
      capacity: body.capacity ?? 32,
      entryCount: body.entryCount ?? 0,
      ...(body.meta ? { meta: body.meta } : {}),
      updatedAt: now,
    });

    await this.notifyAxisChanged(catalogId, body.id);
    return this.requireAxis(catalogId, body.id);
  }

  async patch(catalogId: string, id: string, input: unknown) {
    await this.requireAxis(catalogId, id);
    await this.axisStore.patch(id, catalogId, this.asPatchPayload(input));
    await this.notifyAxisChanged(catalogId, id);
    return this.requireAxis(catalogId, id);
  }

  async addEntry(catalogId: string, id: string, input: unknown) {
    const body = this.asEntryPayload(input);
    if (!body.entry) {
      throw new AxisHttpError(400, { error: "entry 필수" });
    }

    const existing = await this.requireAxis(catalogId, id);
    if (existing.entryCount >= existing.capacity) {
      throw new AxisHttpError(409, {
        error: `Axis '${id}' has no headroom (${existing.entryCount}/${existing.capacity}). Increase capacity first.`,
        headroom: 0,
      });
    }

    const nextEntryCount = existing.entryCount + 1;
    await this.axisStore.patch(id, catalogId, { entryCount: nextEntryCount });
    await this.notifyAxisChanged(catalogId, id);

    return {
      ok: true,
      entry: body.entry,
      entryCount: nextEntryCount,
      headroom: existing.capacity - nextEntryCount,
    };
  }

  async remove(catalogId: string, id: string) {
    await this.requireAxis(catalogId, id);
    await this.axisStore.delete(id, catalogId);
    await this.notifyAxisChanged(catalogId, id);
    return { ok: true };
  }

  private async requireAxis(catalogId: string, id: string): Promise<AxisProfileRecord> {
    const record = await this.axisStore.get(id, catalogId);
    if (!record) {
      throw new AxisHttpError(404, { error: `Axis '${id}' not found` });
    }

    return record;
  }

  private async notifyAxisChanged(catalogId: string, axisId: string) {
    await this.changeHandler?.axisChanged(catalogId, axisId);
  }

  private asCreatePayload(input: unknown): AxisCreatePayload {
    return this.asRecord(input) as AxisCreatePayload;
  }

  private asPatchPayload(input: unknown) {
    return this.asRecord(input);
  }

  private asEntryPayload(input: unknown): AxisEntryPayload {
    return this.asRecord(input) as AxisEntryPayload;
  }

  private asRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== "object") {
      return {};
    }

    return input as Record<string, unknown>;
  }
}
