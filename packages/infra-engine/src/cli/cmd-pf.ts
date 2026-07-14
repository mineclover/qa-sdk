// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';
import { parseArgs } from 'node:util';
import { isSafePid } from '../lib/validation.js';
import { loadPfMap, savePfMap, registerPfEntry, removePfEntry } from '../lib/pf-registry.js';

/** pf list — 활성 port-forward 목록 */
export const pfListHandler: CommandHandler = async (_ctx) => {
  try {
    const map = await loadPfMap();
    const entries = Object.entries(map);
    if (entries.length === 0) {
      console.log('활성 port-forward 없음');
    } else {
      console.log('\n=== 활성 Port-Forward ===\n');
      for (const [key, val] of entries as [string, any][]) {
        let icon = '[manual]';
        let inferredKind: 'port-forward' | 'dev-server' = 'dev-server';
        if (isSafePid(val.pid)) {
          let alive = false;
          try {
            process.kill(val.pid, 0);
            alive = true;
          } catch {}
          icon = alive ? '[alive]' : '[dead]';
          inferredKind = 'port-forward';
        }
        const endpoint = val.endpoint ?? `http://127.0.0.1:${val.localPort}`;
        const kind = val.kind ?? inferredKind;
        console.log(
          `  ${icon} ${key.padEnd(25)} port=${String(val.localPort).padEnd(6)} svc=${val.service} kind=${kind} endpoint=${endpoint}`,
        );
      }
    }
  } catch {
    console.log('활성 port-forward 없음');
  }
};

/** pf cleanup — 죽은 PID 정리 */
export const pfCleanupHandler: CommandHandler = async (_ctx) => {
  try {
    const map = await loadPfMap();
    let cleaned = 0;
    for (const [key, val] of Object.entries(map) as [string, any][]) {
      if (!isSafePid(val.pid)) continue;
      try {
        process.kill(val.pid, 0);
      } catch {
        delete map[key];
        cleaned++;
      }
    }
    await savePfMap(map);
    console.log(`정리됨: ${cleaned}건 (죽은 PID 제거)`);
  } catch {
    console.log('정리할 항목 없음');
  }
};

/** pf register — ad-hoc local server 등록 */
export const pfRegisterHandler: CommandHandler = async (ctx) => {
  const { values, positionals } = parseArgs({
    args: ctx.rawArgs,
    allowPositionals: true,
    options: {
      service: { type: 'string' },
      namespace: { type: 'string' },
      endpoint: { type: 'string' },
      kind: { type: 'string' },
      note: { type: 'string' },
      pid: { type: 'string' },
    },
    strict: true,
  });

  const [name, portRaw] = positionals;
  if (!name || !portRaw) {
    console.error(
      'Usage: infra pf register <name> <port> [--service <id>] [--namespace <ns>] [--endpoint <url>] [--kind dev-server|port-forward] [--pid <n>]',
    );
    process.exit(1);
    return;
  }

  const localPort = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(localPort) || localPort <= 0) {
    console.error(`유효하지 않은 port: ${portRaw}`);
    process.exit(1);
    return;
  }

  const pid = values.pid ? Number.parseInt(values.pid, 10) : undefined;
  await registerPfEntry(name, {
    localPort,
    service: values.service ?? name,
    namespace: values.namespace ?? 'local',
    endpoint: values.endpoint ?? `http://127.0.0.1:${localPort}`,
    kind: values.kind === 'port-forward' ? 'port-forward' : 'dev-server',
    note: values.note,
    ...(Number.isFinite(pid) ? { pid } : {}),
  });

  console.log(`등록됨: ${name} -> http://127.0.0.1:${localPort}`);
};

/** pf remove — ad-hoc local server 엔트리 제거 */
export const pfRemoveHandler: CommandHandler = async (ctx) => {
  const name = ctx.rawArgs[0];
  if (!name) {
    console.error('Usage: infra pf remove <name>');
    process.exit(1);
    return;
  }

  const removed = await removePfEntry(name);
  if (!removed) {
    console.log(`항목 없음: ${name}`);
    return;
  }

  console.log(`제거됨: ${name}`);
};
