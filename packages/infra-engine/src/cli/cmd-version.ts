// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { createVersionStore } from "../post-deploy/version-manager.js";

export const versionListHandler: CommandHandler = async (ctx) => {
  const env = ctx.args.env;
  const store = createVersionStore();
  const versions = await store.listVersions(env);

  if (versions.length === 0) {
    console.log("배포된 버전 없음");
    return;
  }

  console.log(`\n=== 배포 버전${env ? ` (${env})` : ""} ===\n`);
  for (const v of versions.toSorted((a, b) => a.serviceId.localeCompare(b.serviceId))) {
    const prev = v.previousVersion ? ` (이전: ${v.previousVersion})` : "";
    console.log(`  ${v.serviceId.padEnd(28)} ${v.currentVersion.slice(0, 20).padEnd(22)} ${v.env}/${v.provider}${prev}`);
  }
};

export const versionShowHandler: CommandHandler = async (ctx) => {
  const serviceId = ctx.args.service!;
  const env = ctx.args.env ?? "dev";
  const store = createVersionStore();
  const v = await store.getVersion(serviceId, env);

  if (!v) {
    console.log(`${serviceId}@${env}: 버전 정보 없음`);
    return;
  }

  console.log(`\n=== ${v.serviceId}@${v.env} ===`);
  console.log(`  현재:      ${v.currentVersion}`);
  console.log(`  이전:      ${v.previousVersion ?? "(없음)"}`);
  console.log(`  프로바이더: ${v.provider}`);
  console.log(`  endpoint:  ${v.endpoint}`);
  console.log(`  배포일:    ${v.deployedAt}`);
  console.log(`\n  이력 (${v.history.length}건):`);
  for (const h of v.history.slice(-10)) {
    const rb = h.rollbackFrom ? ` <- rollback from ${h.rollbackFrom}` : "";
    console.log(`    ${h.deployedAt.slice(0, 19)}  ${h.version.slice(0, 20)}${rb}`);
  }
};

export const versionRollbackHandler: CommandHandler = async (ctx) => {
  const serviceId = ctx.args.service!;
  const env = ctx.args.env ?? "dev";
  const store = createVersionStore();
  const v = await store.rollback(serviceId, env);

  if (!v) {
    console.log(`${serviceId}@${env}: 롤백할 이전 버전 없음`);
    return;
  }

  console.log(`[version] 롤백: ${v.previousVersion} -> ${v.currentVersion}`);
  console.log(`실제 배포 롤백은 별도 실행 필요: infra deploy ${serviceId} ${env}`);
};
