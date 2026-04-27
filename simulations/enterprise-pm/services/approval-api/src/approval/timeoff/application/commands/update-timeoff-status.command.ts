// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { TimeOffStatus } from "../../domain/index.js";

export interface UpdateTimeOffStatusCommand {
  readonly id: string;
  readonly status: TimeOffStatus;
  readonly traceId?: string;
  readonly correlationId?: string;
}
