// @def.boundary sim-approval-api
// @def.doc authorization-ontology-bitmap-pipeline

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { CurrentUserContext } from "./current-user.decorator.js";

const HEADER_USER = "x-auth-user-id";
const HEADER_MASK = "x-auth-bitmap-mask";
const HEADER_VERSION = "x-auth-bitmap-v";
const HEADER_DEPARTMENT = "x-auth-department-id";
const HEADER_PRIMARY_ROLE = "x-auth-primary-role-id";
const HEADER_ROLE_IDS = "x-auth-role-ids";
const HEADER_ROLE_NAMES = "x-auth-role-names";
const HEADER_ROLE_ASSIGNMENTS = "x-auth-role-assignments";

@Injectable()
export class CurrentUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      currentUser?: CurrentUserContext;
    }>();
    const userId = this.header(req.headers, HEADER_USER);
    const maskBase64 = this.header(req.headers, HEADER_MASK);
    const version = this.header(req.headers, HEADER_VERSION);
    const departmentId = this.header(req.headers, HEADER_DEPARTMENT);
    const primaryRoleId = this.header(req.headers, HEADER_PRIMARY_ROLE);
    const roleIds = this.csvHeader(req.headers, HEADER_ROLE_IDS);
    const roleNames = this.csvHeader(req.headers, HEADER_ROLE_NAMES);
    const roleAssignments = this.roleAssignmentsHeader(req.headers, HEADER_ROLE_ASSIGNMENTS);

    if (!userId || !maskBase64 || !version) {
      throw new UnauthorizedException({ error: "missing_auth_headers" });
    }

    let mask: Uint8Array;
    try {
      mask = Uint8Array.from(Buffer.from(maskBase64, "base64"));
    } catch {
      throw new UnauthorizedException({ error: "invalid_bitmap_mask" });
    }
    if (mask.byteLength === 0) {
      throw new UnauthorizedException({ error: "empty_bitmap_mask" });
    }

    req.currentUser = {
      userId,
      bitmapMask: mask,
      bitmapVersion: version,
      departmentId,
      primaryRoleId,
      roleIds,
      roleNames,
      roleAssignments,
    };
    return true;
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | null {
    const v = headers[name];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" ? v : null;
  }

  private csvHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string[] {
    const value = this.header(headers, name);
    if (!value) return [];
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  private roleAssignmentsHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): Array<{ roleId: string; roleName: string; scopeType: string; scopeId: string | null }> {
    const value = this.header(headers, name);
    if (!value) return [];
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
      return Array.isArray(parsed)
        ? parsed.flatMap((item) =>
            item &&
            typeof item.roleId === "string" &&
            typeof item.roleName === "string" &&
            typeof item.scopeType === "string"
              ? [{
                  roleId: item.roleId,
                  roleName: item.roleName,
                  scopeType: item.scopeType,
                  scopeId: typeof item.scopeId === "string" || item.scopeId === null ? item.scopeId : null,
                }]
              : [],
          )
        : [];
    } catch {
      return [];
    }
  }
}
