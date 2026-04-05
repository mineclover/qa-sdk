// providers/gcp.ts — GCP 프로바이더 (골격)
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

export function createGcpProvider(): DeployProvider {
  return {
    name: "gcp",
    getProgram(_config: ResolvedConfig, _serviceId: string) {
      return async () => {
        throw new Error("GCP 프로바이더 미구현 -- @pulumi/gcp 연동 필요");
      };
    },
    async destroy(_stackName: string) {
      throw new Error("GCP destroy 미구현");
    },
    async validate(config: ResolvedConfig): Promise<ValidationResult> {
      const project = (config.global as Record<string, unknown>).gcp_project;
      if (!project) {
        return { valid: false, errors: ["GCP_PROJECT 설정 필요 (config.global.gcp_project)"] };
      }
      return { valid: true, errors: [] };
    },
  };
}
