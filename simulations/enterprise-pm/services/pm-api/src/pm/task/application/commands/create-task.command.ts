// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/** 새 task 를 생성하라는 명령 (use-case 입력). */
export interface CreateTaskCommand {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly assigneeId?: string;
  readonly status?: "todo" | "in_progress" | "done" | "blocked";
  readonly parentTaskId?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** 기존 task 패치 명령. */
export interface UpdateTaskCommand {
  readonly id: string;
  readonly patch: {
    readonly projectId?: string;
    readonly title?: string;
    readonly assigneeId?: string | null;
    readonly status?: "todo" | "in_progress" | "done" | "blocked";
    readonly parentTaskId?: string | null;
  };
  readonly traceId?: string;
  readonly correlationId?: string;
}

/** task 삭제 명령. */
export interface DeleteTaskCommand {
  readonly id: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
