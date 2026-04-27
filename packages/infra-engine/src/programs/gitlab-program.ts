// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// programs/gitlab-program.ts — 로컬 K3s에 GitLab CE Omnibus를 띄우는 Pulumi 프로그램

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
