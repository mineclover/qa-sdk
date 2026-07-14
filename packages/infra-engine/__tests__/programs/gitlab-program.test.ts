import * as pulumi from '@pulumi/pulumi';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildOmnibusConfig, createGitlabProgram } from '../../src/programs/gitlab-program.js';

interface CapturedResource {
  type: string;
  name: string;
  inputs: Record<string, unknown>;
}

const captured: CapturedResource[] = [];

beforeAll(async () => {
  await pulumi.runtime.setMocks(
    {
      newResource(args) {
        captured.push({
          type: args.type,
          name: args.name,
          inputs: args.inputs as Record<string, unknown>,
        });
        return { id: `${args.name}_id`, state: args.inputs };
      },
      call(args) {
        return args.inputs;
      },
    },
    'infra-engine-gitlab',
    'test',
    false,
  );
});

beforeEach(() => {
  captured.length = 0;
});

describe('buildOmnibusConfig', () => {
  it('external_url만 포함한다 (rootPasswordEnv 없음)', () => {
    const cfg = buildOmnibusConfig({
      externalUrl: 'http://localhost:8929',
      nginxListenPort: 80,
      useRootPasswordEnv: false,
    });
    expect(cfg).toBe(
      "external_url 'http://localhost:8929'; nginx['listen_port'] = 80; nginx['listen_https'] = false",
    );
  });

  it('rootPasswordEnv가 true면 initial_root_password 라인을 추가한다', () => {
    const cfg = buildOmnibusConfig({
      externalUrl: 'http://localhost:8929',
      nginxListenPort: 80,
      useRootPasswordEnv: true,
    });
    expect(cfg).toContain("external_url 'http://localhost:8929'");
    expect(cfg).toContain(
      "gitlab_rails['initial_root_password'] = ENV['GITLAB_ROOT_PASSWORD'] if ENV['GITLAB_ROOT_PASSWORD']",
    );
  });

  it('두 라인 사이는 세미콜론+공백으로 구분한다', () => {
    const cfg = buildOmnibusConfig({
      externalUrl: 'http://gitlab.test',
      nginxListenPort: 80,
      useRootPasswordEnv: true,
    });
    const parts = cfg.split('; ');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("external_url 'http://gitlab.test'");
  });

  it("nginx['listen_port']와 nginx['listen_https']=false가 external_url 다음, initial_root_password 앞에 온다", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: 'http://localhost:8929',
      nginxListenPort: 80,
      useRootPasswordEnv: true,
    });
    const parts = cfg.split('; ');
    const idxExternal = parts.findIndex((p) => p.startsWith('external_url'));
    const idxListenPort = parts.findIndex((p) => p.startsWith("nginx['listen_port']"));
    const idxListenHttps = parts.findIndex((p) => p.startsWith("nginx['listen_https']"));
    const idxRootPw = parts.findIndex((p) => p.startsWith("gitlab_rails['initial_root_password']"));
    expect(idxExternal).toBe(0);
    expect(idxListenPort).toBe(1);
    expect(idxListenHttps).toBe(2);
    expect(idxRootPw).toBe(3);
  });
});

describe('createGitlabProgram (mocked Pulumi runtime)', () => {
  it('기본값으로 Deployment 1개 + Service 1개를 생성한다 (rootPassword 없음 → Secret 없음)', async () => {
    const program = createGitlabProgram();
    await program();

    const deployments = captured.filter((r) => r.type === 'kubernetes:apps/v1:Deployment');
    const services = captured.filter((r) => r.type === 'kubernetes:core/v1:Service');
    const secrets = captured.filter((r) => r.type === 'kubernetes:core/v1:Secret');

    expect(deployments).toHaveLength(1);
    expect(services).toHaveLength(1);
    expect(secrets).toHaveLength(0);
  });

  it('rootPassword를 주면 Secret을 만들고 Deployment env가 그 Secret을 참조한다', async () => {
    const program = createGitlabProgram({ rootPassword: 'supersecret' });
    await program();

    const secrets = captured.filter((r) => r.type === 'kubernetes:core/v1:Secret');
    expect(secrets).toHaveLength(1);
    const secret = secrets[0]!;
    expect((secret.inputs.metadata as Record<string, unknown>).namespace).toBe('qa-dev');
    expect((secret.inputs.metadata as Record<string, unknown>).name).toBe(
      'gitlab-root-credentials',
    );

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const spec = deployment.inputs.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    const containers = podSpec.containers as Array<Record<string, unknown>>;
    const env = containers[0]!.env as Array<Record<string, unknown>>;

    const rootPwEnv = env.find((e) => e.name === 'GITLAB_ROOT_PASSWORD');
    expect(rootPwEnv).toBeDefined();
    expect(rootPwEnv!.valueFrom).toBeDefined();
  });

  it('Deployment metadata.namespace는 옵션값을 따른다', async () => {
    const program = createGitlabProgram({ namespace: 'qa-stage' });
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const meta = deployment.inputs.metadata as Record<string, unknown>;
    expect(meta.namespace).toBe('qa-stage');
  });

  it('이미지 디폴트는 gitlab/gitlab-ce:latest', async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const containers = (
      ((deployment.inputs.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    expect(containers[0]!.image).toBe('gitlab/gitlab-ce:latest');
  });

  it('Service는 NodePort + selector app=gitlab + port 80', async () => {
    const program = createGitlabProgram();
    await program();

    const service = captured.find((r) => r.type === 'kubernetes:core/v1:Service')!;
    const spec = service.inputs.spec as Record<string, unknown>;
    expect(spec.type).toBe('NodePort');
    expect((spec.selector as Record<string, unknown>).app).toBe('gitlab');
    const ports = spec.ports as Array<Record<string, unknown>>;
    expect(ports).toHaveLength(1);
    expect(ports[0]!.port).toBe(80);
    expect(ports[0]!.targetPort).toBe(80);
  });

  it('readinessProbe는 /-/readiness + initialDelay 180s', async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const containers = (
      ((deployment.inputs.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    const probe = containers[0]!.readinessProbe as Record<string, unknown>;
    const httpGet = probe.httpGet as Record<string, unknown>;
    expect(httpGet.path).toBe('/-/readiness');
    expect(httpGet.port).toBe(80);
    expect(probe.initialDelaySeconds).toBe(180);
    expect(probe.periodSeconds).toBe(30);
    expect(probe.failureThreshold).toBe(20);
  });

  it('모든 리소스에 managed-by=pulumi, qa-sdk-component=gitlab-ce 라벨이 있다', async () => {
    const program = createGitlabProgram();
    await program();

    for (const r of captured) {
      const meta = r.inputs.metadata as Record<string, unknown>;
      const labels = meta.labels as Record<string, unknown>;
      expect(labels['managed-by']).toBe('pulumi');
      expect(labels['qa-sdk-component']).toBe('gitlab-ce');
    }
  });

  it('Deployment strategy는 Recreate (Omnibus 단일 인스턴스 전제)', async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const spec = deployment.inputs.spec as Record<string, unknown>;
    const strategy = spec.strategy as Record<string, unknown>;
    expect(strategy.type).toBe('Recreate');
  });

  it('emptyDir 볼륨 3개 (config / logs / data)', async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const podSpec = (
      (deployment.inputs.spec as Record<string, unknown>).template as Record<string, unknown>
    ).spec as Record<string, unknown>;
    const volumes = podSpec.volumes as Array<Record<string, unknown>>;
    expect(volumes).toHaveLength(3);
    for (const v of volumes) {
      expect(v.emptyDir).toBeDefined();
    }
    const names = volumes.map((v) => v.name).toSorted();
    expect(names).toEqual(['gitlab-config', 'gitlab-data', 'gitlab-logs']);
  });

  it('Deployment env는 GITLAB_OMNIBUS_CONFIG를 포함하고 외부 URL이 omnibus config에 반영된다', async () => {
    const program = createGitlabProgram({ externalUrl: 'http://gitlab.example:9000' });
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const containers = (
      ((deployment.inputs.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    const env = containers[0]!.env as Array<Record<string, unknown>>;

    const omnibus = env.find((e) => e.name === 'GITLAB_OMNIBUS_CONFIG');
    expect(omnibus).toBeDefined();
    expect(omnibus!.value).toContain("external_url 'http://gitlab.example:9000'");
  });

  it('Deployment.spec.progressDeadlineSeconds === 1800', async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const spec = deployment.inputs.spec as Record<string, unknown>;
    expect(spec.progressDeadlineSeconds).toBe(1800);
  });

  it("Deployment env GITLAB_OMNIBUS_CONFIG에 nginx['listen_port'] = 80가 포함된다", async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find((r) => r.type === 'kubernetes:apps/v1:Deployment')!;
    const containers = (
      ((deployment.inputs.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    const env = containers[0]!.env as Array<Record<string, unknown>>;

    const omnibus = env.find((e) => e.name === 'GITLAB_OMNIBUS_CONFIG');
    expect(omnibus).toBeDefined();
    expect(omnibus!.value).toContain("nginx['listen_port'] = 80");
  });
});
