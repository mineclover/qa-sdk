// @def.boundary definition-service-system
/**
 * @qa-sdk/definition-client
 *
 * definition-service HTTP 클라이언트.
 *
 * 사용법 (순수 TypeScript):
 * ```typescript
 * import { DefinitionClient } from "@qa-sdk/definition-client";
 * const client = new DefinitionClient({ baseUrl: "http://localhost:3700" });
 * const { matched } = await client.resolveIntents("page_view", { page: "checkout" });
 * ```
 *
 * 사용법 (NestJS):
 * ```typescript
 * import { DefinitionModule } from "@qa-sdk/definition-client/nestjs";
 * // AppModule imports에 DefinitionModule.forRoot({ baseUrl: "..." }) 추가
 * ```
 */

export { DefinitionClient, DefinitionClientError, type DefinitionClientOptions } from './client.js';

export type {
  DocRecord,
  DocHistoryRecord,
  DocListResponse,
  DocHistoryResponse,
  SliceIntentRecord,
  IntentListResponse,
  IntentResolveResponse,
  IntentCreateInput,
  ConsumptionSnapshot,
  ConsumptionRecordInput,
  ImpactResult,
  SyncResult,
} from './types.js';
