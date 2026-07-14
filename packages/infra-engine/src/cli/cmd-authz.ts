// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { CommandHandler } from 'cli-command';
import {
  projectNginxProxyConfig,
  type AuthorizationOntologyGraph,
  type NginxProxyConfigProjectionOptions,
  type StructuredEnforcementRouteConfig,
} from 'authorization-ontology';

type RoutePolicyConfig = NonNullable<StructuredEnforcementRouteConfig['policy']>;

function parseFlags(args: readonly string[]): { flags: Record<string, string> } {
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) continue;

    const [key, inline] = arg.slice(2).split('=', 2);
    const next = args[index + 1];
    if (inline !== undefined) {
      flags[key] = inline;
    } else if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = 'true';
    }
  }

  return { flags };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function defaultNginxConfigPath(): string {
  const fromRepoRoot = resolve(process.cwd(), 'packages/infra-engine/nginx-zitadel.conf');
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return resolve(process.cwd(), 'nginx-zitadel.conf');
}

function toProjectionOptions(flags: Record<string, string>): NginxProxyConfigProjectionOptions {
  return {
    environment: flags['env'] ?? 'local',
    proxyAuthority: flags['proxy-authority'] ?? 'nginx:zitadel',
    proxyId: flags['proxy-id'] ?? 'zitadel-nginx',
    proxyKind: flags['proxy-kind'] as NginxProxyConfigProjectionOptions['proxyKind'],
    host: flags['host'] ?? 'localhost:8085',
    upstreamAuthority: flags['upstream-authority'],
    deployment: flags['deployment-id']
      ? {
          authority: flags['deployment-authority'] ?? 'git:infra-engine',
          id: flags['deployment-id'],
          kind: flags['deployment-kind'] ?? 'git',
          revision: flags['revision'],
        }
      : undefined,
  };
}

function normalizePolicyMapValue(value: unknown, flags: Record<string, string>): RoutePolicyConfig {
  if (typeof value === 'string') {
    return {
      authority: flags['policy-authority'] ?? 'cerbos:local',
      id: value,
      kind: flags['policy-kind'] ?? 'cerbos_resource_policy',
    };
  }

  if (!isRecord(value)) {
    throw new Error('policy map values must be policy id strings or policy objects');
  }

  const id = value['id'];
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('policy map object values require a non-empty id');
  }

  const authority = value['authority'];
  const kind = value['kind'];
  const version = value['version'];
  return {
    authority:
      typeof authority === 'string' && authority.length > 0
        ? authority
        : (flags['policy-authority'] ?? 'cerbos:local'),
    id,
    kind:
      typeof kind === 'string' && kind.length > 0
        ? kind
        : (flags['policy-kind'] ?? 'cerbos_resource_policy'),
    version: typeof version === 'string' && version.length > 0 ? version : undefined,
  };
}

async function loadPolicyMap(
  filePath: string,
  flags: Record<string, string>,
): Promise<NginxProxyConfigProjectionOptions['policyByPath']> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('policy map must be a JSON object keyed by route path');
  }

  const policyByPath: NonNullable<NginxProxyConfigProjectionOptions['policyByPath']> = {};
  for (const [path, value] of Object.entries(parsed)) {
    policyByPath[path] = normalizePolicyMapValue(value, flags);
  }
  return policyByPath;
}

export async function createAuthorizationGraphFromNginxConfig(
  filePath: string,
  options: NginxProxyConfigProjectionOptions,
): Promise<AuthorizationOntologyGraph> {
  const config = await readFile(filePath, 'utf8');
  return projectNginxProxyConfig(config, options);
}

export const authzGraphHandler: CommandHandler = async (ctx) => {
  const { flags } = parseFlags(ctx.rawArgs);
  const nginxPath = resolve(flags['nginx'] ?? defaultNginxConfigPath());
  const policyByPath = flags['policy-map']
    ? await loadPolicyMap(resolve(flags['policy-map']), flags)
    : undefined;
  const options = {
    ...toProjectionOptions(flags),
    policyByPath,
  };
  const graph = await createAuthorizationGraphFromNginxConfig(nginxPath, options);

  if (flags['json'] === 'true') {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }

  console.log('=== Authorization Topology Graph ===');
  console.log(`  source: ${nginxPath}`);
  if (flags['policy-map']) {
    console.log(`  policyMap: ${resolve(flags['policy-map'])}`);
  }
  console.log(`  realms: ${graph.realms.length}`);
  console.log(`  nodes: ${graph.nodes.length}`);
  console.log(`  relations: ${graph.relations.length}`);
  console.log('');
  for (const node of graph.nodes) {
    console.log(`  ${node.kind.padEnd(18)} ${node.coord.anchor}`);
  }
  if (graph.relations.length > 0) {
    console.log('');
    for (const relation of graph.relations) {
      console.log(`  ${relation.kind.padEnd(18)} ${relation.fromNodeId} -> ${relation.toNodeId}`);
    }
  }
};
