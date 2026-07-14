// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';

/** destroy 명령 — 배포 리소스 삭제 */
export const destroyHandler: CommandHandler = async (ctx) => {
  const service = ctx.args.service;
  const env = ctx.args.env ?? 'dev';
  const yes = !!ctx.options.yes;

  if (!service) {
    console.error('사용: infra destroy <service> <env> [--yes]');
    process.exit(1);
  }
  if (!yes) {
    console.log(`${service} (${env}) 리소스를 삭제합니다. 계속하려면 --yes 플래그를 추가하세요.`);
    process.exit(1);
  }

  const { destroy } = await import('../commands/destroy.js');
  await destroy(service, env);
};
