// providers/aws.ts — AWS 프로바이더 (골격)
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

export function createAwsProvider(): DeployProvider {
  return {
    name: "aws",
    getProgram(_config: ResolvedConfig, _serviceId: string) {
      return async () => {
        throw new Error("AWS 프로바이더 미구현 -- @pulumi/aws 연동 필요");
      };
    },
    async destroy(_stackName: string) {
      throw new Error("AWS destroy 미구현");
    },
    async validate(config: ResolvedConfig): Promise<ValidationResult> {
      const global = config.global as Record<string, unknown>;
      // AWS OIDC 또는 access key 확인
      const hasOidc = global.aws_role_arn;
      const hasKeys = global.aws_access_key_id && global.aws_secret_access_key;
      if (!hasOidc && !hasKeys) {
        return {
          valid: false,
          errors: ["AWS 인증 설정 필요 (config.global.aws_role_arn 또는 aws_access_key_id + aws_secret_access_key)"],
        };
      }
      return { valid: true, errors: [] };
    },
  };
}
