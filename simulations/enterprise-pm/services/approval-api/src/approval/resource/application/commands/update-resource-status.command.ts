// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ResourceStatus } from '../../domain/index.js';

export interface UpdateResourceStatusCommand {
  readonly id: string;
  readonly status: ResourceStatus;
  readonly traceId?: string;
  readonly correlationId?: string;
}
