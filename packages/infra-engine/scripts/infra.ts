#!/usr/bin/env pnpm exec tsx
/**
 * infra-engine 통합 CLI
 *
 * 사용:
 *   infra discover [--all|--list|--deep|--code] <args>
 *   infra deploy <service> <env> [config]
 *   infra destroy <service> <env> [--yes]
 *   infra export [env|ts|compose|docs] <args>
 *   infra status <env>
 *   infra history <service>
 *   infra pf [list|cleanup]
 *   infra --help
 */

// 0-3: Passphrase 자동 설정 — Pulumi 로컬 백엔드에서 암호 프롬프트 방지
process.env.PULUMI_CONFIG_PASSPHRASE ??= "";

const cmd = process.argv[2];
const rest = process.argv.slice(3);

// 하위 스크립트에 인자 위임
function delegateTo(scriptPath: string, args: string[]) {
  process.argv = [process.argv[0], scriptPath, ...args];
}

async function main() {
  switch (cmd) {
    case "discover": {
      delegateTo("discover.ts", rest);
      await import("./discover.js");
      break;
    }
    case "deploy": {
      delegateTo("deploy-local.ts", rest);
      await import("./deploy-local.js");
      break;
    }
    case "destroy": {
      const service = rest[0];
      const env = rest[1] ?? "dev";
      const yes = rest.includes("--yes");
      if (!service) {
        console.error("사용: infra destroy <service> <env> [--yes]");
        process.exit(1);
      }
      if (!yes) {
        console.log(`${service} (${env}) 리소스를 삭제합니다. 계속하려면 --yes 플래그를 추가하세요.`);
        process.exit(0);
      }
      const { destroy } = await import("../src/commands/destroy.js");
      await destroy(service, env);
      break;
    }
    case "export": {
      delegateTo("export.ts", rest);
      await import("./export.js");
      break;
    }
    case "status": {
      delegateTo("export.ts", ["status", ...rest]);
      await import("./export.js");
      break;
    }
    case "pf": {
      const sub = rest[0] ?? "list";
      const { readFile, writeFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      const { homedir } = await import("node:os");
      const pfPath = resolve(homedir(), ".qa-sdk", "infra-pf.json");

      if (sub === "list") {
        try {
          const map = JSON.parse(await readFile(pfPath, "utf-8"));
          const entries = Object.entries(map);
          if (entries.length === 0) {
            console.log("활성 port-forward 없음");
          } else {
            console.log("\n=== 활성 Port-Forward ===\n");
            for (const [key, val] of entries as [string, any][]) {
              let alive = false;
              try { process.kill(val.pid, 0); alive = true; } catch {}
              const icon = alive ? "[alive]" : "[dead]";
              console.log(`  ${icon} ${key.padEnd(25)} PID=${val.pid}  port=${val.localPort}  svc=${val.service}`);
            }
          }
        } catch {
          console.log("활성 port-forward 없음");
        }
      } else if (sub === "cleanup") {
        try {
          const map = JSON.parse(await readFile(pfPath, "utf-8"));
          let cleaned = 0;
          for (const [key, val] of Object.entries(map) as [string, any][]) {
            try { process.kill(val.pid, 0); } catch {
              delete map[key];
              cleaned++;
            }
          }
          await writeFile(pfPath, JSON.stringify(map, null, 2));
          console.log(`정리됨: ${cleaned}건 (죽은 PID 제거)`);
        } catch {
          console.log("정리할 항목 없음");
        }
      } else {
        console.error(`알 수 없는 pf 서브커맨드: ${sub}`);
        console.error("사용: infra pf [list|cleanup]");
        process.exit(1);
      }
      break;
    }
    case "--help":
    case "-h":
    case undefined: {
      console.log(`
infra-engine CLI

사용:
  infra discover [--all|--list|--deep|--code] <service> <env>
  infra deploy <service> <env> [config]
  infra destroy <service> <env> [--yes]
  infra export [env|ts|compose|docs] <args>
  infra status <env>
  infra pf [list|cleanup]
  infra --help
`);
      break;
    }
    default:
      console.error(`알 수 없는 명령: ${cmd}`);
      console.error("infra --help 로 사용법을 확인하세요.");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("에러:", err.message ?? err);
  process.exit(1);
});
