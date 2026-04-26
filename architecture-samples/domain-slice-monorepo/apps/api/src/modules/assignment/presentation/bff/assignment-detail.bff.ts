import type { AssignmentReadModelPort } from "../../application/queries/assignment-read-model.query.js";
import type { AssignmentLoggerPort } from "../../application/ports/assignment-logger.port.js";

export interface AssignmentDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly assigneeLabel: string;
  readonly statusLabel: string;
  readonly updatedAt: string;
  readonly cacheKey: string;
}

export class AssignmentDetailBff {
  readonly cachePrefix = "assignment-bff-detail:v1";

  constructor(
    private readonly readModel: AssignmentReadModelPort,
    private readonly logger: AssignmentLoggerPort,
  ) {}

  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AssignmentDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail = await this.readModel.findDetail(input.id);
    await this.logger.record({
      traceId: input.traceId,
      correlationId: input.correlationId,
      domain: "assignment",
      useCase: "AssignmentDetailBff.getDetail",
      aggregateId: input.id,
      queryName: "AssignmentDetailBffQuery",
      outcome: detail ? "success" : "failure",
      cacheKeyPrefix: this.cachePrefix,
      cacheHit: false,
    });

    if (!detail) return null;
    return {
      id: detail.id,
      title: `Assignment ${detail.id}`,
      assigneeLabel: `Assignee ${detail.assigneeId}`,
      statusLabel: detail.status.toUpperCase(),
      updatedAt: detail.updatedAt,
      cacheKey,
    };
  }
}
