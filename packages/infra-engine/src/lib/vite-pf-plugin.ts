// @def.boundary infra-engine-system
// @def.doc infra-engine-system

/**
 * Vite Dev Server ↔ infra pf-registry 자동 연동 플러그인.
 *
 * Vite 시작 시 실제 할당 포트를 ~/.qa-sdk/infra-pf.json에 등록하고,
 * 종료 시 해제한다. `infra pf list`로 dev server URL 조회 가능.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { vitePfPlugin } from "infra-engine/vite";
 *
 * export default defineConfig({
 *   plugins: [vitePfPlugin({ service: "my-app" })],
 * });
 * ```
 */
import { registerPfEntry, removePfEntry } from './pf-registry.js';

export interface VitePfPluginOptions {
  /** 서비스 식별자 (infra pf list에 표시) */
  service: string;
  /** pf-registry 키. 기본: `${service}-dev` */
  key?: string;
  /** 네임스페이스. 기본: "local" */
  namespace?: string;
  /** 메모. 기본: "Vite dev server" */
  note?: string;
}

/**
 * Vite 플러그인: dev server 시작/종료 시 pf-registry 자동 등록/해제.
 *
 * 포트가 충돌로 변경되더라도 실제 할당된 포트를 등록한다.
 */
export function vitePfPlugin(options: VitePfPluginOptions) {
  const pfKey = options.key ?? `${options.service}-dev`;
  const namespace = options.namespace ?? 'local';
  const note = options.note ?? 'Vite dev server';

  // Vite의 Plugin 타입을 직접 import하지 않고 구조로 반환
  // (vite는 devDependency가 아닐 수 있으므로)
  return {
    name: 'infra-pf-registry',

    configureServer(server: {
      httpServer?: {
        address(): { port: number } | string | null;
        once(event: string, cb: () => void): void;
      } | null;
    }) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        if (!addr || typeof addr === 'string') return;
        const port = addr.port;

        registerPfEntry(pfKey, {
          pid: process.pid,
          localPort: port,
          service: options.service,
          namespace,
          kind: 'dev-server',
          note,
        }).catch(() => {});

        console.log(`[pf-registry] ${pfKey} → :${port}`);
      });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        removePfEntry(pfKey).catch(() => {});
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);
    },
  };
}
