// providers/cloudflare.ts — Cloudflare Workers/Pages 프로바이더 (골격)
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

export function createCloudflareProvider(): DeployProvider {
  return {
    name: "cloudflare",
    getProgram(_config: ResolvedConfig, _serviceId: string) {
      return async () => {
        throw new Error("Cloudflare 프로바이더 미구현 -- @pulumi/cloudflare 연동 필요");
      };
    },
    async destroy(_stackName: string) {
      throw new Error("Cloudflare destroy 미구현");
    },
    async validate(config: ResolvedConfig): Promise<ValidationResult> {
      const token = (config.global as Record<string, unknown>).cloudflare_api_token;
      if (!token) {
        return { valid: false, errors: ["CLOUDFLARE_API_TOKEN 설정 필요 (config.global.cloudflare_api_token)"] };
      }
      return { valid: true, errors: [] };
    },
  };
}
