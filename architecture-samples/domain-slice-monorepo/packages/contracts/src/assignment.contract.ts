export const ASSIGNMENT_EVENTS = {
  created: 'assignment.created.v1',
} as const;

export const ASSIGNMENT_LOG_EVENTS = {
  useCaseCreate: 'assignment.use_case.create',
  bffDetail: 'assignment.bff.detail',
} as const;

export interface AssignmentCreatedPayload {
  readonly id: string;
  readonly assigneeId: string;
  readonly occurredAt: string;
}

export interface AssignmentDetailBffResponse {
  readonly id: string;
  readonly title: string;
  readonly assigneeLabel: string;
  readonly statusLabel: string;
  readonly updatedAt: string;
}

export const ASSIGNMENT_OPENAPI_FRAGMENT = {
  paths: {
    '/assignments': {
      post: {
        operationId: 'createAssignment',
        tags: ['assignment'],
      },
    },
    '/bff/assignments/{id}': {
      get: {
        operationId: 'getAssignmentDetail',
        tags: ['assignment-bff'],
      },
    },
  },
} as const;
