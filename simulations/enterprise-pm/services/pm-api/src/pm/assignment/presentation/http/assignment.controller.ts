// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Param, Post, UseFilters } from '@nestjs/common';
import { z } from 'zod';
import { DomainExceptionFilter } from '@qa-sdk/sim-domain-slice-kit';
import { AssignmentUseCase } from '../../application/use-cases/assignment.use-case.js';
import {
  AssignmentReadModelQuery,
  type AssignmentDetailReadModel,
} from '../../application/queries/assignment-read-model.query.js';
import { AssignmentDomainException } from '../../domain/index.js';

// OpenAPI spec.yaml 의 AssignManagerCommand 와 1:1 매칭.
const createSchema = z.object({
  projectId: z.string().min(1),
  managerId: z.string().min(1),
  courseId: z.string().optional(),
  processType: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

interface AssignmentCommandAccepted {
  readonly assignmentId: string;
  readonly status: 'PENDING';
}

/**
 * Assignment HTTP controller.
 *
 * - POST /assignments — createAssignment (202 + AssignmentCommandAccepted)
 * - GET  /assignments/:id — getAssignmentReadModel (200 + AssignmentReadModel)
 *
 * 도메인 예외 → DomainExceptionFilter 가 표준 HTTP 응답 (`{code, message,
 * traceId, details}`) 으로 변환.
 */
@Controller('assignments')
@UseFilters(DomainExceptionFilter)
export class AssignmentController {
  constructor(
    @Inject(AssignmentUseCase) private readonly useCase: AssignmentUseCase,
    @Inject(AssignmentReadModelQuery) private readonly readModel: AssignmentReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<AssignmentCommandAccepted> {
    const parsed = createSchema.parse(body);
    // OpenAPI 는 idempotencyKey 를 별도 필드로 받지만 use-case 의 id 가
    // assignment 식별자다. idempotencyKey 가 없으면 결정론적 derivation.
    const id = parsed.idempotencyKey ?? `asg_${parsed.projectId}_${parsed.managerId}`;
    const result = await this.useCase.create({
      id,
      projectId: parsed.projectId,
      managerId: parsed.managerId,
    });
    return { assignmentId: result.id, status: result.status };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<AssignmentDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) {
      // 도메인 표준 NotFound — DomainExceptionFilter 가 404 매핑
      const err = new AssignmentDomainException(
        'ASSIGNMENT_NOT_FOUND',
        `Assignment not found: ${id}`,
      );
      err.name = 'NotFoundError';
      throw err;
    }
    return detail;
  }
}
