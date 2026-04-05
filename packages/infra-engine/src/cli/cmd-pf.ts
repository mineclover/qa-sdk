import type { CommandHandler } from "cli-command";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { PROFILE_DIR } from "./context.js";
import { isSafePid } from "../lib/validation.js";

const pfPath = resolve(PROFILE_DIR, "infra-pf.json");

/** pf list — 활성 port-forward 목록 */
export const pfListHandler: CommandHandler = async (_ctx) => {
  try {
    const map = JSON.parse(await readFile(pfPath, "utf-8"));
    const entries = Object.entries(map);
    if (entries.length === 0) {
      console.log("활성 port-forward 없음");
    } else {
      console.log("\n=== 활성 Port-Forward ===\n");
      for (const [key, val] of entries as [string, any][]) {
        let alive = false;
        if (isSafePid(val.pid)) {
          try { process.kill(val.pid, 0); alive = true; } catch {}
        }
        const icon = alive ? "[alive]" : "[dead]";
        console.log(`  ${icon} ${key.padEnd(25)} PID=${val.pid}  port=${val.localPort}  svc=${val.service}`);
      }
    }
  } catch {
    console.log("활성 port-forward 없음");
  }
};

/** pf cleanup — 죽은 PID 정리 */
export const pfCleanupHandler: CommandHandler = async (_ctx) => {
  try {
    const map = JSON.parse(await readFile(pfPath, "utf-8"));
    let cleaned = 0;
    for (const [key, val] of Object.entries(map) as [string, any][]) {
      if (!isSafePid(val.pid)) {
        delete map[key];
        cleaned++;
        continue;
      }
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
};
