// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const composeDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function mask(s: string): string {
  if (s.length <= 6) return "***";
  return s.slice(0, 3) + "***" + s.slice(-3);
}

/** secrets show — 현재 시크릿 (마스킹) */
export const secretsShowHandler: CommandHandler = async () => {
  const { loadSecrets } = await import("../commands/secrets-manager.js");
  const secrets = await loadSecrets();
  if (!secrets) {
    console.log("시크릿 미생성. `infra secrets init` 실행 필요.");
    return;
  }

  console.log("\n=== 인프라 시크릿 (마스킹) ===\n");
  console.log(`  Zitadel masterkey:  ${mask(secrets.zitadelMasterkey)}`);
  console.log(`  MinIO user:         ${secrets.minioRootUser}`);
  console.log(`  MinIO password:     ${mask(secrets.minioRootPassword)}`);
  console.log(`  Postgres user:      ${secrets.postgresUser}`);
  console.log(`  Postgres password:  ${mask(secrets.postgresPassword)}`);
  console.log(`  Zitadel admin pw:   ${mask(secrets.zitadelAdminPassword)}`);
  console.log(`\n  생성:    ${secrets.createdAt}`);
  if (secrets.rotatedAt) console.log(`  로테이션: ${secrets.rotatedAt}`);
  console.log(`  파일:    ~/.qa-sdk/infra-secrets.json (0600)`);
};

/** secrets init — 시크릿 초기화 */
export const secretsInitHandler: CommandHandler = async () => {
  const { ensureSecrets, generateDockerEnv } = await import("../commands/secrets-manager.js");
  const secrets = await ensureSecrets();
  await generateDockerEnv(secrets, resolve(composeDir, ".env.docker"));
  console.log("[secrets] 초기화 완료 + .env.docker 생성");
};

/** secrets rotate — 시크릿 로테이션 */
export const secretsRotateHandler: CommandHandler = async () => {
  const { rotateSecrets, generateDockerEnv } = await import("../commands/secrets-manager.js");
  const secrets = await rotateSecrets();
  await generateDockerEnv(secrets, resolve(composeDir, ".env.docker"));
  console.log("[secrets] 로테이션 완료 + .env.docker 재생성");
  console.log("\n  docker compose 재시작 필요: infra env down && infra env up");
};
