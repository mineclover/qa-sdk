// @def.boundary cli-command-spec
// @def.doc cli-command-spec

import { parseArgs } from 'node:util';
import type { CliCommandNode, CommandContext } from './types.js';

/**
 * 노드의 args/options 정의에 따라 인자를 파싱한다.
 * node:util parseArgs를 래핑.
 */
export function parseCommandArgs(rawArgs: string[], node: CliCommandNode): CommandContext {
  const argDefs = node.args ?? [];
  const optDefs = node.options ?? [];

  // parseArgs 옵션 구성 — kebab-case 키 사용 (parseArgs가 --flag와 매칭)
  const parseOptions: Record<
    string,
    {
      type: 'boolean' | 'string';
      short?: string;
      default?: string | boolean | string[] | boolean[];
    }
  > = {};
  for (const opt of optDefs) {
    const kebabKey = opt.flag.replace(/^--/, '');
    parseOptions[kebabKey] = {
      type: opt.type,
      ...(opt.short ? { short: opt.short.replace(/^-/, '') } : {}),
      ...(opt.default !== undefined
        ? { default: opt.default as string | boolean | string[] | boolean[] }
        : {}),
    };
  }

  let parsed: { values: Record<string, unknown>; positionals: string[] };
  try {
    parsed = parseArgs({
      args: [...rawArgs],
      options: parseOptions,
      allowPositionals: true,
      strict: false,
    });
  } catch {
    // 파싱 실패 시 raw로 fallback
    parsed = { values: {}, positionals: [...rawArgs] };
  }

  // values를 camelCase로 변환
  const options: Record<string, string | boolean | undefined> = {};
  for (const [key, value] of Object.entries(parsed.values)) {
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    options[camelKey] = value as string | boolean | undefined;
  }

  // 위치 인자 매핑
  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < argDefs.length; i++) {
    args[argDefs[i].name] = parsed.positionals[i];
  }

  for (const argDef of argDefs) {
    if (argDef.required && !args[argDef.name]) {
      throw new Error(`required argument missing: ${argDef.name}`);
    }
  }

  for (const optDef of optDefs) {
    if (!optDef.choices?.length) continue;
    const kebabKey = optDef.flag.replace(/^--/, '');
    const camelKey = kebabKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const value = options[camelKey];
    if (value === undefined || typeof value !== 'string') continue;
    if (!optDef.choices.includes(value)) {
      throw new Error(
        `invalid value for ${optDef.flag}: ${value} (expected one of ${optDef.choices.join(', ')})`,
      );
    }
  }

  // 나머지 positionals
  const rest = parsed.positionals.slice(argDefs.length);

  return {
    args,
    options,
    rest,
    rawArgs,
  };
}
