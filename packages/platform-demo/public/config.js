// ── 배포 환경별 설정 ─────────────────────────────────────────
// 로컬 개발: Vite dev proxy 사용. 프로덕션에서는 이 값을 사용.
window.__QA_CONFIG__ = {
  INGEST_URL: "https://qa-gateway.astralclover.workers.dev",
  REGISTRY_URL: "https://qa-gateway.astralclover.workers.dev",
  WS_URL: "wss://qa-ingest-server.astralclover.workers.dev/v1/ws",
  DASHBOARD_URL: "https://qa-gateway.astralclover.workers.dev/dev/",
  MONITOR_URL: "https://platform-demo-3v1.pages.dev/monitor",
};
