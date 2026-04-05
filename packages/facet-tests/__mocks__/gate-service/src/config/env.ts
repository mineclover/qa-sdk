/** gate-service env stub — 환경 의존 제거 */
export const env = {
  PORT: 3400,
  SQLITE_DRIVER: "node" as const,
  SQLITE_PATH: ":memory:",
};
