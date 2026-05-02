// scripts/break-glass-shared/operator-identity.ts
// spec 05 §2: 모든 break-glass 명령은 audit-recorder에 actor identity 첨부.
// 우선순위: SIM_OPERATOR_ACTOR env > git config user.email > whoami > "unknown-operator".
import { execSync } from "node:child_process";

export function resolveOperatorIdentity(): string {
  const fromEnv = process.env.SIM_OPERATOR_ACTOR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    const email = execSync("git config user.email", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (email.length > 0) return email;
  } catch {
    /* git 없음 — fallthrough */
  }
  try {
    return execSync("whoami", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown-operator";
  }
}
