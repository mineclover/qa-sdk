// providers/vultr.ts — Vultr 프로바이더 (골격)
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

export function createVultrProvider(): DeployProvider {
  return {
    name: "vultr",
    getProgram(_config: ResolvedConfig, _serviceId: string) {
      return async () => {
        throw new Error("Vultr 프로바이더 미구현 -- Vultr API 연동 필요");
      };
    },
    async destroy(_stackName: string) {
      throw new Error("Vultr destroy 미구현");
    },
    async validate(config: ResolvedConfig): Promise<ValidationResult> {
      const apiKey = (config.global as Record<string, unknown>).vultr_api_key;
      if (!apiKey) {
        return { valid: false, errors: ["VULTR_API_KEY 설정 필요 (config.global.vultr_api_key)"] };
      }
      return { valid: true, errors: [] };
    },
  };
}
