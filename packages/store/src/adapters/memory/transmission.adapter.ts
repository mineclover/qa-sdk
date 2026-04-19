// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type { TransmissionInsert, TransmissionStore } from "@qa-sdk/core";

/** TransmissionStore의 in-memory 구현 */
export class InMemoryTransmissionStore implements TransmissionStore {
  private readonly transmissions = new Map<string, TransmissionInsert>();

  async insert(params: TransmissionInsert): Promise<void> {
    if (this.transmissions.has(params.transmissionId)) {
      throw new Error(
        `Transmission already exists for transmissionId: ${params.transmissionId}`,
      );
    }

    this.transmissions.set(params.transmissionId, structuredClone(params));
  }
}
