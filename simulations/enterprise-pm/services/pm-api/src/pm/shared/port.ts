// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import type {
  Project,
  ProjectCreate,
  Task,
  TaskCreate,
  ProjectMember,
  MemberCreate,
} from "./types.js";

export interface PmRepository {
  // Project
  createProject(args: ProjectCreate): Promise<Project>;
  findProject(id: string): Promise<Project | null>;
  listProjectsByDepartment(departmentId: string): Promise<Project[]>;
  listProjectsByOwner(ownerId: string): Promise<Project[]>;
  updateProject(id: string, patch: Partial<ProjectCreate>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Task
  createTask(args: TaskCreate): Promise<Task>;
  findTask(id: string): Promise<Task | null>;
  listTasksByProject(projectId: string): Promise<Task[]>;
  listSubtasks(parentTaskId: string): Promise<Task[]>;
  updateTask(id: string, patch: Partial<TaskCreate>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Member
  addMember(args: MemberCreate): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<void>;
  listMembers(projectId: string): Promise<ProjectMember[]>;
  listProjectsForUser(userId: string): Promise<ProjectMember[]>;
}
