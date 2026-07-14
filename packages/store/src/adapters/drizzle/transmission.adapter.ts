// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type { TransmissionStore, TransmissionInsert } from '@qa-sdk/core';
import type { DbExecutor } from '../../db/client.js';
import { transmissions } from '../../db/schema.js';

/** TransmissionStore의 Drizzle/PostgreSQL 구현 */
export class DrizzleTransmissionStore implements TransmissionStore {
  constructor(private readonly db: DbExecutor) {}

  async insert(params: TransmissionInsert): Promise<void> {
    await this.db
      .insert(transmissions)
      .values({
        transmissionId: params.transmissionId,
        sentAt: params.sentAt,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        serviceName: params.serviceName,
        sdkName: params.sdkName,
        sdkVersion: params.sdkVersion,
        platform: params.platform,
        env: params.env,
        recordCount: params.recordCount,
      })
      .comment({ adapter: 'TransmissionStore', method: 'insert' });
  }
}
