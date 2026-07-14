// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { homedir } from 'node:os';
import { join } from 'node:path';

export function getQaSdkBaseHome(): string {
  return process.env.QA_SDK_HOME ?? process.env.HOME ?? process.env.USERPROFILE ?? homedir() ?? '.';
}

export function getQaSdkDir(): string {
  return join(getQaSdkBaseHome(), '.qa-sdk');
}
