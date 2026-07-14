// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

export type ProjectStatus = 'draft' | 'active' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type MemberRole = 'lead' | 'contributor' | 'viewer';

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  departmentId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string | null;
  status: TaskStatus;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface ProjectCreate {
  name: string;
  ownerId: string;
  departmentId: string;
  status?: ProjectStatus;
}

export interface TaskCreate {
  projectId: string;
  title: string;
  assigneeId?: string;
  status?: TaskStatus;
  parentTaskId?: string;
}

export interface MemberCreate {
  projectId: string;
  userId: string;
  role: MemberRole;
}
