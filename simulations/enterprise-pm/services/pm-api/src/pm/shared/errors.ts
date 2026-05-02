// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

export class ProjectNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Project not found: ${id}`);
    this.name = "ProjectNotFoundError";
  }
}
export class TaskNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Task not found: ${id}`);
    this.name = "TaskNotFoundError";
  }
}
export class MemberAlreadyExistsError extends Error {
  constructor(public readonly projectId: string, public readonly userId: string) {
    super(`Member already exists: ${projectId}/${userId}`);
    this.name = "MemberAlreadyExistsError";
  }
}
