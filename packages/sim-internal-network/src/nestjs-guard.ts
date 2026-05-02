// @def.boundary sim-internal-network
// spec 2026-05-02 §3 — controller/auth-api/approval-api admin endpoint 보호용 Guard.

import { Injectable, CanActivate, ExecutionContext, NotFoundException } from "@nestjs/common";
import { isInternalIp } from "./is-internal-ip.js";

interface IpRequest { ip?: string; headers?: Record<string, string | string[] | undefined>; }

function extractIp(req: IpRequest): string | null {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const leftmost = xff.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }
  if (Array.isArray(xff) && xff.length > 0) {
    const leftmost = xff[0]?.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }
  if (typeof req.ip === "string" && req.ip.length > 0) return req.ip;
  return null;
}

@Injectable()
export class InternalIpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<IpRequest>();
    const ip = extractIp(req);
    if (ip === null || !isInternalIp(ip)) throw new NotFoundException();
    return true;
  }
}
