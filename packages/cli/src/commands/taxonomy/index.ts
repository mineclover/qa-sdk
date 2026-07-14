import { validateCmd } from './validate.js';
import { showCmd } from './show.js';
import { codegenCmd } from './codegen.js';
import { diffCmd } from './diff.js';
import { doctorCmd } from './doctor.js';
import { gitDiffCmd } from './git-diff.js';
import { migrationCmd } from './migration.js';
import { printHelp } from './help.js';

export async function cliTaxonomy(rest: string[]): Promise<void> {
  const [sub, ...args] = rest;
  switch (sub) {
    case 'validate':
      return validateCmd(args);
    case 'show':
      return showCmd(args);
    case 'codegen':
      return codegenCmd(args);
    case 'diff':
      return diffCmd(args);
    case 'git-diff':
      return gitDiffCmd(args);
    case 'migration':
      return migrationCmd(args);
    case 'doctor':
      return doctorCmd(args);
    case 'help':
    case undefined:
      printHelp();
      return;
    default:
      console.error(`알 수 없는 tax 명령: ${sub}`);
      process.exit(1);
  }
}
