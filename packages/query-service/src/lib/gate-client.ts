import type { AddressStateCacheRecord } from "index-meta-workers";
import { ServiceClientError } from "@qa-sdk/core";
import { z } from "zod";

const addressRangeSchema = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([from, to]) => from <= to, {
    message: "range start must be less than or equal to range end",
  });

const dimStateSpecSchema = z.object({
  dimIndex: z.number().int().min(0),
  state: z.enum(["reserved", "inactive", "open"]),
  coords: z.string().nullable(),
  reason: z.string().optional(),
});

const gateStateRecordSchema = z.object({
  prefix: z.string().min(1),
  versionId: z.string().min(1),
  specs: z.array(dimStateSpecSchema),
  reservedRanges: z.array(addressRangeSchema),
  inactiveRanges: z.array(addressRangeSchema),
  openRanges: z.array(addressRangeSchema),
  computedAt: z.string().min(1),
}).nullable();

export interface GateStateClient {
  getStateRanges(prefix: string, versionId: string): Promise<AddressStateCacheRecord | null>;
}

export class GateServiceClientError extends ServiceClientError {
  constructor(message: string, status?: number) {
    super(message, status ?? 500);
    this.name = "GateServiceClientError";
  }
}

export class NoopGateStateClient implements GateStateClient {
  async getStateRanges(): Promise<AddressStateCacheRecord | null> {
    return null;
  }
}

export interface HttpGateStateClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export class HttpGateStateClient implements GateStateClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpGateStateClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getStateRanges(
    prefix: string,
    versionId: string,
  ): Promise<AddressStateCacheRecord | null> {
    let response: Response;

    try {
      response = await this.fetchImpl(
        new URL(
          `/gate/state/${encodeURIComponent(prefix)}/${encodeURIComponent(versionId)}`,
          `${this.baseUrl}/`,
        ),
        {
          method: "GET",
          headers: { accept: "application/json" },
        },
      );
    } catch (error) {
      throw new GateServiceClientError(
        error instanceof Error ? error.message : "failed to contact gate-service",
      );
    }

    if (!response.ok) {
      throw new GateServiceClientError(
        await readErrorMessage(response),
        response.status,
      );
    }

    return gateStateRecordSchema.parse(await response.json()) as AddressStateCacheRecord | null;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    return payload.error?.message ?? `gate-service lookup failed with status ${response.status}`;
  } catch {
    return `gate-service lookup failed with status ${response.status}`;
  }
}
