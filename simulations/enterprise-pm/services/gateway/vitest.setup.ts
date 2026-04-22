// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

// 테스트 환경에서 env.ts module-level parseEnv가 JWT_SECRET 요구하므로 사전 주입.
// 각 테스트가 parseEnv({ ... })로 스키마 검증하는 것과 별개.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret-32-bytes-long-for-hs256-ok";
}
