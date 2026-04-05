// config/sops-loader.ts — SOPS CLI 래퍼
import { execa } from "execa";

export interface SopsLoader {
  decrypt(configPath: string): Promise<Record<string, unknown>>;
}

export function createSopsLoader(): SopsLoader {
  return {
    async decrypt(configPath) {
      try {
        const { stdout } = await execa("sops", ["--decrypt", "--output-type", "json", configPath]);
        return JSON.parse(stdout);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          throw new Error("sops CLI가 설치되어 있지 않습니다. brew install sops 또는 공식 릴리스에서 설치하세요.");
        }
        throw new Error(`SOPS 복호화 ���패: ${msg}`);
      }
    },
  };
}
