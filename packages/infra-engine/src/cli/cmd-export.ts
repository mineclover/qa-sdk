// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';
import { assertNoTraversal } from '../lib/validation.js';
import { createDiscoveryClient } from '../discovery/client.js';
import { createDefinitionAdapter } from '../adapters/definition.js';
import { runSupplyExportCommand, type PgDomain } from 'infra-env-kit';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFINITION_URL, REGISTRY_URL } from './context.js';
import { printServiceDocs } from './export-runtime.js';

export const exportHandler: CommandHandler = async (ctx) => {
  const format = ctx.args.format ?? 'status';

  switch (format) {
    case 'env':
    case 'ts':
    case 'compose': {
      const suggested =
        format === 'env'
          ? `infra-env env ${ctx.args.target ?? '<serviceId>'} ${ctx.args.env ?? '[env]'}`
          : format === 'ts'
            ? `infra-env ts ${ctx.args.target ?? '[env]'}`
            : `infra-env compose ${ctx.args.target ?? '[env]'}`;
      console.warn(
        `[deprecated] infra export ${format}는 legacy consumer surface입니다. 신규 사용은 \`${suggested}\`를 권장합니다.`,
      );

      const outPath = typeof ctx.options.out === 'string' ? ctx.options.out : undefined;
      if (outPath) {
        assertNoTraversal(outPath);
      }

      const __dirname = dirname(fileURLToPath(import.meta.url));
      const envDockerPath =
        process.env.QA_ENV_DOCKER_PATH ?? resolve(__dirname, '../../.env.docker');
      const discovery = createDiscoveryClient(REGISTRY_URL);

      await runSupplyExportCommand({
        discovery,
        command: format,
        arg1: ctx.args.target,
        arg2: ctx.args.env,
        rawArgs: [
          format,
          ...(ctx.args.target ? [ctx.args.target] : []),
          ...(ctx.args.env ? [ctx.args.env] : []),
          ...(ctx.options.all ? ['--all'] : []),
          ...(typeof ctx.options.out === 'string' ? ['--out', ctx.options.out] : []),
          ...(typeof ctx.options.pgDomain === 'string'
            ? ['--pg-domain', ctx.options.pgDomain]
            : []),
          ...(typeof ctx.options.pgHost === 'string' ? ['--pg-host', ctx.options.pgHost] : []),
        ],
        exportOut: outPath,
        defaultConfigDir: resolve(__dirname, '../../config'),
        defaultEnvDockerPath: envDockerPath,
      });
      return;
    }

    case 'status': {
      const { printFleetStatus } = await import('./export-runtime.js');
      await printFleetStatus(ctx.args.target ?? 'dev');
      return;
    }

    case 'docs': {
      await printServiceDocs(ctx.args.target);
      return;
    }

    default:
      console.error(`알 수 없는 export 형식: ${format}`);
      console.error('사용: infra export [status|env|ts|compose|docs] ...');
      process.exit(1);
  }
};
