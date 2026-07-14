import type { AssignmentDetailBff, AssignmentDetailBffModel } from './assignment-detail.bff.js';

export interface AssignmentDetailRequest {
  readonly id: string;
  readonly traceId: string;
  readonly correlationId: string;
}

export class AssignmentDetailController {
  constructor(private readonly bff: AssignmentDetailBff) {}

  async getDetail(request: AssignmentDetailRequest): Promise<AssignmentDetailBffModel | null> {
    return this.bff.getDetail(request);
  }
}
