// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  AssignmentReadModelQuery,
  type AssignmentDetailReadModel,
} from "../../application/queries/assignment-read-model.query.js";
import type { AssignmentLoggerPort } from "../../application/ports/assignment-logger.port.js";

/** BFF detail composition — UI 친화적 라벨 + cacheKey. domain entity 노출 금지. */
export interface AssignmentDetailBffModel {
  readonly id: string;
  readonly title: string;
  readonly assigneeLabel: string;
  readonly statusLabel: string;
  readonly updatedAt: string;
  readonly cacheKey: string;
}

/**
 * Assignment 화면 BFF.
 *
 * - read-model 만 호출, write 금지 (validator 가 persistence-write 호출 검사).
 * - 여러 read 합성을 가정 (Phase 1 은 단일 read; Phase 2 의 reporting BFF 가
 *   본격 다중 read 합성).
 */
export class AssignmentDetailBff {
  readonly cachePrefix = "assignment-bff-detail:v1";

  constructor(
    private readonly readModel: AssignmentReadModelQuery,
    private readonly logger: AssignmentLoggerPort,
  ) {}

  async getDetail(input: {
    readonly id: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AssignmentDetailBffModel | null> {
    const cacheKey = `${this.cachePrefix}:${input.id}`;
    const detail: AssignmentDetailReadModel | null = await this.readModel.findDetail(input.id);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: "assignment",
        useCase: "AssignmentDetailBff.getDetail",
        aggregateId: input.id,
        queryName: "AssignmentDetailBffQuery",
        outcome: detail ? "success" : "failure",
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      detail ? "assignment-detail.bff.success" : "assignment-detail.bff.miss",
    );

    if (!detail) return null;
    return {
      id: detail.id,
      title: `Assignment ${detail.id}`,
      assigneeLabel: `Manager ${detail.managerId}`,
      statusLabel: detail.status.toUpperCase(),
      updatedAt: detail.updatedAt,
      cacheKey,
    };
  }
}
