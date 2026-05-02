// @def.boundary registry-system
// @def.doc registry-system

import { Inject, Injectable, Optional } from "@nestjs/common";
import { AppError } from "@qa-sdk/core";
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
    const handler = deps.onAxisChange;
    return new AxisService(
      deps.axisStore,
      handler
        ? { axisChanged: (catalogId: string, axisId: string) => handler(catalogId, axisId) }
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
      throw new AppError("INVALID_INPUT", "id, name 필수", 400);
    }

    const existing = await this.axisStore.get(body.id, catalogId);
    if (existing) {
      throw new AppError("CONFLICT", `Axis '${body.id}' already exists`, 409);
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
      throw new AppError("INVALID_INPUT", "entry 필수", 400);
    }

    const existing = await this.requireAxis(catalogId, id);
    if (existing.entryCount >= existing.capacity) {
      throw new AppError("CONFLICT", `Axis '${id}' has no headroom (${existing.entryCount}/${existing.capacity}). Increase capacity first.`, 409, { headroom: 0 });
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
      throw new AppError("NOT_FOUND", `Axis '${id}' not found`, 404);
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
