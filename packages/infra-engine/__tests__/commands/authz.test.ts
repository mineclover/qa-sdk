import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  authzGraphHandler,
  createAuthorizationGraphFromNginxConfig,
} from '../../src/cli/cmd-authz.js';

describe('authz graph command', () => {
  it('Nginx proxy config를 authorization graph로 변환한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-infra-authz-'));
    const nginxPath = join(dir, 'nginx.conf');
    await writeFile(
      nginxPath,
      `
upstream zitadel_api {
  server zitadel:8080;
}
server {
  listen 80;
  server_name localhost;
  location / {
    proxy_pass http://zitadel_api;
  }
}
`,
      'utf8',
    );

    const graph = await createAuthorizationGraphFromNginxConfig(nginxPath, {
      environment: 'local',
      proxyAuthority: 'nginx:zitadel',
      proxyId: 'zitadel-nginx',
      host: 'localhost:8085',
    });

    expect(graph.nodes.map((node) => node.kind).toSorted()).toEqual([
      'enforcement_point',
      'resource',
      'resource',
    ]);
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      'enforced_at',
      'matches_resource',
    ]);
  });

  it('authz graph handler는 요약을 출력한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-infra-authz-cli-'));
    const nginxPath = join(dir, 'nginx.conf');
    await writeFile(
      nginxPath,
      `
upstream app {
  server app:3000;
}
server {
  listen 80;
  server_name app.local;
  location /app {
    proxy_pass http://app;
  }
}
`,
      'utf8',
    );

    const output = await captureConsoleAsync(async () => {
      await authzGraphHandler({
        args: {},
        options: {},
        rest: [],
        rawArgs: ['--nginx', nginxPath, '--host', 'app.local'],
      });
    });

    expect(output.stdout).toContain('Authorization Topology Graph');
    expect(output.stdout).toContain('nodes: 3');
    expect(output.stdout).toContain('relations: 2');
  });

  it('authz graph handler는 route별 policy map을 합성한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-infra-authz-policy-'));
    const nginxPath = join(dir, 'nginx.conf');
    const policyMapPath = join(dir, 'policy-map.json');
    await writeFile(
      nginxPath,
      `
upstream crm {
  server crm:3000;
}
server {
  listen 80;
  server_name crm.local;
  location /customers {
    proxy_pass http://crm;
  }
}
`,
      'utf8',
    );
    await writeFile(
      policyMapPath,
      JSON.stringify({
        '/customers': 'cerbos:resource:crm.customer_profile',
      }),
      'utf8',
    );

    const output = await captureConsoleAsync(async () => {
      await authzGraphHandler({
        args: {},
        options: {},
        rest: [],
        rawArgs: [
          '--nginx',
          nginxPath,
          '--host',
          'crm.local',
          '--policy-map',
          policyMapPath,
          '--policy-authority',
          'cerbos:local',
        ],
      });
    });

    expect(output.stdout).toContain('nodes: 4');
    expect(output.stdout).toContain('relations: 3');
    expect(output.stdout).toContain('cerbos:resource:crm.customer_profile');
    expect(output.stdout).toContain('enforcement_kind=nginx_proxy');
    expect(output.stdout).toContain('protects');
  });
});

async function captureConsoleAsync(run: () => Promise<void>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(' '));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}
