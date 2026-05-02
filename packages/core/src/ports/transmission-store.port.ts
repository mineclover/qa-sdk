// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/** Transmission 메타데이터 저장소 계약 (감사/디버깅용) */
export interface TransmissionStore {
  insert(params: TransmissionInsert): Promise<void>;
}

export interface TransmissionInsert {
  transmissionId: string;
  sentAt: Date;
  ownerType: string;
  ownerId: string;
  serviceName: string;
  sdkName: string;
  sdkVersion: string;
  platform: string;
  env: string;
  recordCount: number;
}
