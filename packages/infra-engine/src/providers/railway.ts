// providers/railway.ts — Railway 프로바이더 (골격)
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

export function createRailwayProvider(): DeployProvider {
  return {
    name: "railway",
    getProgram(_config: ResolvedConfig, _serviceId: string) {
      return async () => {
        throw new Error("Railway 프로바이더 미구현 -- Railway API 연동 필요");
      };
    },
    async destroy(_stackName: string) {
      throw new Error("Railway destroy 미구현");
    },
    async validate(config: ResolvedConfig): Promise<ValidationResult> {
      const token = (config.global as Record<string, unknown>).railway_token;
      if (!token) {
        return { valid: false, errors: ["RAILWAY_TOKEN 설정 필요 (config.global.railway_token)"] };
      }
      return { valid: true, errors: [] };
    },
  };
}
