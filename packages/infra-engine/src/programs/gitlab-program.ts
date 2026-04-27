// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// programs/gitlab-program.ts — 로컬 K3s에 GitLab CE Omnibus를 띄우는 Pulumi 프로그램

import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface BuildOmnibusConfigInput {
  /** GitLab external_url (예: "http://localhost:8929") */
  externalUrl: string;
  /** true면 GITLAB_ROOT_PASSWORD env에서 초기 비밀번호를 주입하는 라인을 포함 */
  useRootPasswordEnv: boolean;
}

/**
 * GitLab Omnibus가 인식하는 GITLAB_OMNIBUS_CONFIG 문자열을 만든다.
 * 결정론적: 같은 입력 → 같은 출력.
 */
export function buildOmnibusConfig(input: BuildOmnibusConfigInput): string {
  const lines: string[] = [`external_url '${input.externalUrl}'`];
  if (input.useRootPasswordEnv) {
    lines.push(
      "gitlab_rails['initial_root_password'] = ENV['GITLAB_ROOT_PASSWORD'] if ENV['GITLAB_ROOT_PASSWORD']",
    );
  }
  return lines.join("; ");
}

export interface GitlabProgramOptions {
  /** 배포 namespace (기본 "qa-dev"). namespace 자체는 만들지 않음 — 사전에 존재해야 함 */
  namespace?: string;
  /** 컨테이너 이미지 (기본 "gitlab/gitlab-ce:latest") */
  image?: string;
  /** GitLab external_url (기본 "http://localhost:8929") */
  externalUrl?: string;
  /** 초기 root 비밀번호. 미지정 시 Secret 미생성 → Omnibus가 컨테이너 안에 자동 생성 */
  rootPassword?: string;
  /** 컨테이너 리소스 요청/제한 */
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
}

const APP_LABEL = "gitlab";
const COMMON_LABELS = {
  app: APP_LABEL,
  "managed-by": "pulumi",
  "qa-sdk-component": "gitlab-ce",
};

/**
 * 로컬 K3s에 GitLab CE Omnibus 한 인스턴스를 배포하는 Pulumi 프로그램을 만든다.
 * 반환된 함수가 Pulumi Automation API에서 실행되며, 리소스 outputs를 반환한다.
 */
export function createGitlabProgram(
  options?: GitlabProgramOptions,
): () => Promise<Record<string, unknown>> {
  const namespace = options?.namespace ?? "qa-dev";
  const image = options?.image ?? "gitlab/gitlab-ce:latest";
  const externalUrl = options?.externalUrl ?? "http://localhost:8929";
  const rootPassword = options?.rootPassword;
  const resources = {
    requests: {
      cpu: options?.resources?.requests?.cpu ?? "2",
      memory: options?.resources?.requests?.memory ?? "4Gi",
    },
    limits: {
      cpu: options?.resources?.limits?.cpu ?? "3",
      memory: options?.resources?.limits?.memory ?? "6Gi",
    },
  };

  return async () => {
    let secret: k8s.core.v1.Secret | undefined;
    if (rootPassword !== undefined) {
      secret = new k8s.core.v1.Secret("gitlab-root-credentials", {
        metadata: {
          namespace,
          name: "gitlab-root-credentials",
          labels: COMMON_LABELS,
        },
        type: "Opaque",
        stringData: { password: rootPassword },
      });
    }

    const env: Array<{
      name: string;
      value?: string;
      valueFrom?: {
        secretKeyRef: { name: string; key: string };
      };
    }> = [
      {
        name: "GITLAB_OMNIBUS_CONFIG",
        value: buildOmnibusConfig({
          externalUrl,
          useRootPasswordEnv: secret !== undefined,
        }),
      },
    ];

    if (secret !== undefined) {
      env.push({
        name: "GITLAB_ROOT_PASSWORD",
        valueFrom: {
          secretKeyRef: { name: "gitlab-root-credentials", key: "password" },
        },
      });
    }

    const deployment = new k8s.apps.v1.Deployment("gitlab", {
      metadata: { namespace, name: "gitlab", labels: COMMON_LABELS },
      spec: {
        replicas: 1,
        strategy: { type: "Recreate" },
        selector: { matchLabels: { app: APP_LABEL } },
        template: {
          metadata: { labels: COMMON_LABELS },
          spec: {
            containers: [
              {
                name: "gitlab",
                image,
                imagePullPolicy: "IfNotPresent",
                ports: [{ containerPort: 80, name: "http" }],
                env,
                resources,
                volumeMounts: [
                  { name: "gitlab-config", mountPath: "/etc/gitlab" },
                  { name: "gitlab-logs", mountPath: "/var/log/gitlab" },
                  { name: "gitlab-data", mountPath: "/var/opt/gitlab" },
                ],
                readinessProbe: {
                  httpGet: { path: "/-/readiness", port: 80 },
                  initialDelaySeconds: 180,
                  periodSeconds: 30,
                  failureThreshold: 20,
                  timeoutSeconds: 5,
                },
              },
            ],
            volumes: [
              { name: "gitlab-config", emptyDir: {} },
              { name: "gitlab-logs", emptyDir: {} },
              { name: "gitlab-data", emptyDir: {} },
            ],
          },
        },
      },
    });

    const service = new k8s.core.v1.Service("gitlab-svc", {
      metadata: { namespace, name: "gitlab-svc", labels: COMMON_LABELS },
      spec: {
        type: "NodePort",
        selector: { app: APP_LABEL },
        ports: [{ port: 80, targetPort: 80, name: "http" }],
      },
    });

    // pulumi.all을 사용해 모든 출력이 resolve될 때까지 대기한다 (테스트 호환성 포함)
    const resolved = await pulumi
      .all({
        namespace: pulumi.output(namespace),
        deploymentName: deployment.metadata.name,
        serviceName: service.metadata.name,
        clusterIP: service.spec.clusterIP,
        nodePort: service.spec.ports[0]!.nodePort,
        rootPasswordSecretName: secret
          ? secret.metadata.name
          : pulumi.output(undefined as string | undefined),
      })
      .promise();

    return resolved;
  };
}
