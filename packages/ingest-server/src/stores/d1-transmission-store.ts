// @def.boundary ingest-system
// @def.doc ingest-system

import type { TransmissionStore, TransmissionInsert } from '@qa-sdk/core';
import { transmissions } from '../db/schema.js';
import type { D1Db } from './d1-db-type.js';

/** TransmissionStore의 D1/SQLite 구현 */
export class D1TransmissionStore implements TransmissionStore {
  constructor(private readonly db: D1Db) {}

  async insert(params: TransmissionInsert): Promise<void> {
    await this.db.insert(transmissions).values({
      transmissionId: params.transmissionId,
      sentAt: params.sentAt.toISOString(),
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      serviceName: params.serviceName,
      sdkName: params.sdkName,
      sdkVersion: params.sdkVersion,
      platform: params.platform,
      env: params.env,
      recordCount: params.recordCount,
      receivedAt: new Date().toISOString(),
    });
  }
}
