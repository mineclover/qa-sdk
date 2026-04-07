import {
  InMemoryAddressStateStore,
  checkGate as resolveGateResult,
  classifyAddress as resolveAddressState,
  gateFilterRanges as applyGateFilterRanges,
  type AddressState,
  type AddressStateCacheRecord,
  type AddressStateStore,
  type GateEngine,
  type GateResult,
} from "index-meta-workers";

export interface GateServiceDeps {
  addressStateStore?: AddressStateStore;
  gateEngine?: GateEngine | null;
}

export interface GateLookupService {
  readonly engine: GateEngine | null;
  getStateRanges(prefix: string, versionId: string): Promise<AddressStateCacheRecord | null>;
  checkGate(prefix: string, versionId: string, address: number): Promise<GateResult>;
  classifyAddress(prefix: string, versionId: string, address: number): Promise<AddressState>;
  recompute(prefix: string, versionId: string): Promise<void>;
  cascadeRecompute(prefix: string, versionId: string): Promise<void>;
  filterRanges(
    prefix: string,
    versionId: string,
    ranges: readonly [number, number][],
    mode: GateFilterMode,
  ): Promise<[number, number][]>;
}

export type GateFilterMode = Parameters<typeof applyGateFilterRanges>[2];

const ACTIVE_GATE_RESULT: GateResult = {
  encode: true,
  decode: true,
  state: "active",
  shouldVerify: false,
};

export class GateService implements GateLookupService {
  readonly engine: GateEngine | null;
  private readonly addressStateStore: AddressStateStore;

  constructor(deps: Required<GateServiceDeps>) {
    this.addressStateStore = deps.addressStateStore;
    this.engine = deps.gateEngine;
  }

  async getStateRanges(
    prefix: string,
    versionId: string,
  ): Promise<AddressStateCacheRecord | null> {
    return this.addressStateStore.get(prefix, versionId);
  }

  async checkGate(
    prefix: string,
    versionId: string,
    address: number,
  ): Promise<GateResult> {
    const record = await this.getStateRanges(prefix, versionId);
    if (!record) return ACTIVE_GATE_RESULT;

    return resolveGateResult(
      address,
      record.reservedRanges,
      record.inactiveRanges,
      record.openRanges,
    );
  }

  async classifyAddress(
    prefix: string,
    versionId: string,
    address: number,
  ): Promise<AddressState> {
    const record = await this.getStateRanges(prefix, versionId);
    if (!record) return "active";

    return resolveAddressState(
      address,
      record.reservedRanges,
      record.inactiveRanges,
      record.openRanges,
    );
  }

  async recompute(prefix: string, versionId: string): Promise<void> {
    if (!this.engine) return;
    await this.engine.recompute(prefix, versionId);
  }

  async cascadeRecompute(prefix: string, versionId: string): Promise<void> {
    if (!this.engine) return;
    await this.engine.cascadeRecompute(prefix, versionId);
  }

  async filterRanges(
    prefix: string,
    versionId: string,
    ranges: readonly [number, number][],
    mode: GateFilterMode,
  ): Promise<[number, number][]> {
    const record = await this.getStateRanges(prefix, versionId);
    return applyGateFilterRanges(ranges, record, mode);
  }
}

export function createGateService(deps: GateServiceDeps = {}): GateService {
  if (deps.gateEngine && !deps.addressStateStore) {
    throw new Error("addressStateStore is required when gateEngine is provided");
  }

  return new GateService({
    addressStateStore: deps.addressStateStore ?? new InMemoryAddressStateStore(),
    gateEngine: deps.gateEngine ?? null,
  });
}
