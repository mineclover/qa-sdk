#!/usr/bin/env pnpm exec tsx
/**
 * infra-engine 통합 CLI
 *
 * cli-command 트리 기반 라우터.
 * 각 명령 handler: src/cli/cmd-*.ts
 * 명령 트리 정의:  src/cli/tree.ts
 */

// infra-config.json 기반 설정 적용
import { loadInfraConfig, applyConfigToEnv } from "../src/commands/config-manager.js";
const infraConfig = await loadInfraConfig();
await applyConfigToEnv(infraConfig);

// MinIO 자동 감지 fallback
import { detectEnvironment } from "../src/commands/env-manager.js";
await detectEnvironment();

// CLI 실행
import { executeCommand, generateHelp } from "cli-command";
import { INFRA_COMMAND_TREE } from "../src/cli/tree.js";

const args = process.argv.slice(2);

const ok = await executeCommand(args, INFRA_COMMAND_TREE, {
  onHelp: (node, _name) => {
    console.log(generateHelp("infra", INFRA_COMMAND_TREE, node ?? undefined));
  },
  onNotFound: async (unmatchedArgs) => {
    console.error(`알 수 없는 명령: ${unmatchedArgs[0]}`);
    console.error("infra --help 로 사용법을 확인하세요.");
    process.exit(1);
  },
});

if (!ok) {
  console.log(generateHelp("infra", INFRA_COMMAND_TREE));
}
