// @def.boundary sim-approval-api
// @def.doc authorization-ontology-bitmap-pipeline

import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface CurrentUserContext {
  userId: string;
  bitmapMask: Uint8Array;
  bitmapVersion: string;
  departmentId?: string | null;
  primaryRoleId?: string | null;
  roleIds: string[];
  roleNames: string[];
  roleAssignments: Array<{
    roleId: string;
    roleName: string;
    scopeType: string;
    scopeId: string | null;
  }>;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserContext | undefined => {
    const req = ctx.switchToHttp().getRequest<{ currentUser?: CurrentUserContext }>();
    return req.currentUser;
  },
);
