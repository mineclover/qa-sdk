// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * sim-gateway JWT 유틸 — bitmap을 embed하는 HS256 JWT 발급/검증.
 *
 * §2 bitmap-pipeline §3 (저장·전달) 구현:
 *   - signBitmapJwt: VersionedBitmap → JWT (HS256)
 *   - verifyBitmapJwt: JWT → { userId, bitmap }
 *
 * HMAC secret rotation은 본 plan 범위 외 — 단일 secret 가정.
 * dual-accept window는 §2 §7 참조 (운영 도입 시 별도 plan).
 */

import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import type { VersionedBitmap } from "permission-engine";
import { bitmapToClaim, claimToBitmap, type BitmapClaim } from "./bitmap-claim.js";

export type JwtVerifyReason = "expired" | "signature" | "malformed" | "claim_missing";

export class JwtVerifyError extends Error {
  constructor(
    public readonly reason: JwtVerifyReason,
    message: string,
  ) {
    super(message);
    this.name = "JwtVerifyError";
  }
}

export interface SignArgs {
  userId: string;
  bitmap: VersionedBitmap;
  /** UTF-8 문자열 secret (>= 32 bytes). */
  secret: string;
  ttlSeconds: number;
  authContext?: {
    departmentId?: string | null;
    primaryRoleId?: string | null;
    roleIds?: string[];
    roleNames?: string[];
    roleAssignments?: Array<{
      roleId: string;
      roleName: string;
      scopeType: string;
      scopeId: string | null;
    }>;
  };
}

export interface VerifiedRoleAssignment {
  roleId: string;
  roleName: string;
  scopeType: string;
  scopeId: string | null;
}

export interface VerifiedJwt {
  userId: string;
  bitmap: VersionedBitmap;
  /** JWT iat → ISO-8601. */
  issuedAt: string;
  /** JWT exp → ISO-8601. */
  expiresAt: string;
  departmentId?: string | null;
  primaryRoleId?: string | null;
  roleIds: string[];
  roleNames: string[];
  roleAssignments: VerifiedRoleAssignment[];
}

function secretToKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signBitmapJwt(args: SignArgs): Promise<string> {
  const claim: BitmapClaim = bitmapToClaim(args.bitmap);
  return await new SignJWT({
    ...claim,
    ...(args.authContext?.departmentId !== undefined ? { department_id: args.authContext.departmentId } : {}),
    ...(args.authContext?.primaryRoleId !== undefined ? { primary_role_id: args.authContext.primaryRoleId } : {}),
    ...(args.authContext?.roleIds ? { role_ids: args.authContext.roleIds } : {}),
    ...(args.authContext?.roleNames ? { role_names: args.authContext.roleNames } : {}),
    ...(args.authContext?.roleAssignments ? { role_assignments: args.authContext.roleAssignments } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.userId)
    .setIssuedAt()
    .setExpirationTime(`${args.ttlSeconds}s`)
    .setIssuer("sim-gateway")
    .sign(secretToKey(args.secret));
}

export interface VerifyOptions {
  /**
   * Plan 13d — POST /auth/refresh 는 만료된 token 도 받아들여 재발급.
   * jose clockTolerance 를 매우 크게 설정해 exp 검증을 사실상 무시.
   * signature/malformed 오류는 여전히 발생.
   */
  ignoreExpiration?: boolean;
}

export async function verifyBitmapJwt(
  token: string,
  secret: string,
  options: VerifyOptions = {},
): Promise<VerifiedJwt> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, secretToKey(secret), {
      issuer: "sim-gateway",
      algorithms: ["HS256"],
      // 100y (~3.15e9 초) — 만료 무시 효과.
      ...(options.ignoreExpiration ? { clockTolerance: "100y" } : {}),
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new JwtVerifyError("expired", "JWT expired");
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      throw new JwtVerifyError("signature", "JWT signature invalid");
    }
    if (err instanceof joseErrors.JWSInvalid || err instanceof joseErrors.JWTInvalid) {
      throw new JwtVerifyError("malformed", "JWT malformed");
    }
    throw new JwtVerifyError("malformed", `JWT verify failed: ${(err as Error).message}`);
  }

  const userId = payload.sub;
  if (typeof userId !== "string" || userId === "") {
    throw new JwtVerifyError("claim_missing", "JWT sub missing");
  }
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (iat === null || exp === null) {
    throw new JwtVerifyError("claim_missing", "iat or exp missing");
  }
  const issuedAt = new Date(iat * 1000).toISOString();
  const expiresAt = new Date(exp * 1000).toISOString();

  let bitmap: VersionedBitmap;
  try {
    bitmap = claimToBitmap(payload as Partial<BitmapClaim>, issuedAt, expiresAt);
  } catch (err) {
    throw new JwtVerifyError("claim_missing", (err as Error).message);
  }
  const roleIds = Array.isArray(payload.role_ids)
    ? payload.role_ids.filter((value): value is string => typeof value === "string")
    : [];
  const roleNames = Array.isArray(payload.role_names)
    ? payload.role_names.filter((value): value is string => typeof value === "string")
    : [];
  const roleAssignments = Array.isArray(payload.role_assignments)
    ? payload.role_assignments.flatMap((value) => {
        if (typeof value !== "object" || value === null) return [];
        const roleId = typeof (value as Record<string, unknown>).roleId === "string"
          ? (value as Record<string, unknown>).roleId as string
          : null;
        const roleName = typeof (value as Record<string, unknown>).roleName === "string"
          ? (value as Record<string, unknown>).roleName as string
          : null;
        const scopeType = typeof (value as Record<string, unknown>).scopeType === "string"
          ? (value as Record<string, unknown>).scopeType as string
          : null;
        const rawScopeId = (value as Record<string, unknown>).scopeId;
        const scopeId =
          rawScopeId === null || typeof rawScopeId === "string"
            ? rawScopeId as string | null
            : null;
        return roleId && roleName && scopeType
          ? [{ roleId, roleName, scopeType, scopeId }]
          : [];
      })
    : [];
  const departmentId =
    payload.department_id === null || typeof payload.department_id === "string"
      ? (payload.department_id as string | null | undefined)
      : undefined;
  const primaryRoleId =
    payload.primary_role_id === null || typeof payload.primary_role_id === "string"
      ? (payload.primary_role_id as string | null | undefined)
      : undefined;
  return {
    userId,
    bitmap,
    issuedAt,
    expiresAt,
    departmentId,
    primaryRoleId,
    roleIds,
    roleNames,
    roleAssignments,
  };
}
