// @def.boundary sim-seed
// @def.doc sim-erp-pm-design

/**
 * SQL 시드와 1:1 매칭하는 fixture 상수.
 *
 * Plan 13 시나리오 runner가 본 상수를 import하여 expected userId / email을
 * 검증에 사용한다. SQL 파일을 수동으로 수정할 경우 본 파일도 동기 수정 필수
 * (fixtures.test.ts가 drift를 탐지).
 */

export interface UserFixture {
  id: string;
  email: string;
  displayName: string;
  departmentId: string;
  primaryRoleId: string;
}

export const USERS = {
  admin: {
    id: "u-admin-001",
    email: "admin@example.com",
    displayName: "System Admin",
    departmentId: "d-exec",
    primaryRoleId: "r-admin",
  },
  cfo: {
    id: "u-cfo-001",
    email: "cfo@example.com",
    displayName: "Chief Finance",
    departmentId: "d-exec",
    primaryRoleId: "r-cfo",
  },
  alice: {
    id: "u-alice-001",
    email: "alice@example.com",
    displayName: "Alice Kim",
    departmentId: "d-eng",
    primaryRoleId: "r-project-manager",
  },
  bob: {
    id: "u-bob-001",
    email: "bob@example.com",
    displayName: "Bob Park",
    departmentId: "d-mkt",
    primaryRoleId: "r-project-manager",
  },
  directorEng: {
    id: "u-dir-eng-001",
    email: "director-eng@example.com",
    displayName: "Carol Lee",
    departmentId: "d-eng",
    primaryRoleId: "r-director",
  },
  directorMkt: {
    id: "u-dir-mkt-001",
    email: "director-mkt@example.com",
    displayName: "Olivia Sim",
    departmentId: "d-mkt",
    primaryRoleId: "r-director",
  },
  approverEng: {
    id: "u-eng-appr-001",
    email: "frank.eng.appr@example.com",
    displayName: "Frank Yoon",
    departmentId: "d-eng",
    primaryRoleId: "r-approver",
  },
  approverMkt: {
    id: "u-mkt-appr-001",
    email: "quinn.mkt@example.com",
    displayName: "Quinn Yu",
    departmentId: "d-mkt",
    primaryRoleId: "r-approver",
  },
} as const satisfies Record<string, UserFixture>;

export const DEPARTMENTS = {
  exec: { id: "d-exec", name: "Executive" },
  eng: { id: "d-eng", name: "Engineering" },
  mkt: { id: "d-mkt", name: "Marketing" },
  fin: { id: "d-fin", name: "Finance" },
  ops: { id: "d-ops", name: "Operations" },
  sal: { id: "d-sal", name: "Sales" },
  hr: { id: "d-hr", name: "Human Resources" },
} as const;

export const ROLES = {
  admin: { id: "r-admin", name: "admin", scopeType: "global" },
  cfo: { id: "r-cfo", name: "cfo", scopeType: "global" },
  director: { id: "r-director", name: "director", scopeType: "department" },
  projectManager: {
    id: "r-project-manager",
    name: "project_manager",
    scopeType: "project",
  },
  approver: { id: "r-approver", name: "approver", scopeType: "department" },
  member: { id: "r-member", name: "member", scopeType: "project" },
  finance: { id: "r-finance", name: "finance", scopeType: "department" },
} as const;
