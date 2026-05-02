// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

import { defineConfig } from "tsup";

/**
 * sim-gateway — 6 entry 산출:
 *   - src/server.ts                → dist/server.{js,d.ts}  (bin entry, 기본 export ".")
 *   - src/app.ts                   → dist/app.{js,d.ts}      ("./app" — createApp)
 *   - src/lib/jwt.ts               → dist/lib/jwt.{js,d.ts}  ("./jwt")
 *   - src/lib/bitmap-claim.ts      → dist/lib/bitmap-claim.{js,d.ts} ("./bitmap-claim")
 *   - src/test-bootstrap.ts        → dist/test-bootstrap.{js,d.ts} ("./test-bootstrap")
 *   - src/routing/routing-table.ts → dist/routing/routing-table.{js,d.ts}
 *                                     ("./routing" — RoutingPushSchema, RouteEntrySchema, types)
 *
 * 6 entry 라이브러리 스타일이므로 splitting=false + 정적 import만 사용.
 * server.ts 최상단 shebang 을 tsup 가 preserve.
 */
export default defineConfig({
  entry: [
    "src/server.ts",
    "src/app.ts",
    "src/lib/jwt.ts",
    "src/lib/bitmap-claim.ts",
    "src/test-bootstrap.ts",
    "src/routing/routing-table.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2023",
  platform: "node",
  splitting: false,
  shims: true,
});
