// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { sep } from "node:path";

/** serviceId/env 검증 — alphanumeric + hyphens */
export function validateId(id: string, label: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) {
    throw new Error(`유효하지 않은 ${label}: "${id}" (영문/숫자/하이픈만 허용)`);
  }
}

/** 경로 탐색 방지 — resolved path가 baseDir 안에 있는지 확인 */
export function assertPathContainment(resolved: string, baseDir: string): void {
  if (!resolved.startsWith(baseDir + sep) && resolved !== baseDir) {
    throw new Error(`경로가 허용 범위를 벗어남: ${resolved}`);
  }
}

/** 출력 경로 검증 — .. 금지 */
export function assertNoTraversal(p: string): void {
  if (p.includes("..")) {
    throw new Error(`경로에 '..'를 사용할 수 없습니다: ${p}`);
  }
}

/** PID 안전성 검증 */
export function isSafePid(pid: unknown): pid is number {
  return typeof pid === "number" && Number.isInteger(pid) && pid > 1 && pid <= 4_194_304;
}

/** URL 검증 — http/https만 허용 */
export function isValidServiceUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

/** localhost 여부 확인 */
export function isLocalhost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch { return false; }
}
