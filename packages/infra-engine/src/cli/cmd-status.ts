// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';
import { printFleetStatus } from './export-runtime.js';

export const statusHandler: CommandHandler = async (ctx) => {
  await printFleetStatus(ctx.args.env ?? 'dev');
};
