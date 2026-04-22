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

    req.currentUser = { userId, bitmapMask: mask, bitmapVersion: version };
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
}
