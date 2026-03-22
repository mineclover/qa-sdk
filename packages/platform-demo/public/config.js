// ── 배포 환경별 설정 ─────────────────────────────────────────
// 배포 시 이 파일을 환경에 맞게 교체한다.
// Vite dev proxy는 개발 전용. 프로덕션에서는 이 값을 사용.
window.__QA_CONFIG__ = {
  INGEST_URL: "http://localhost:3200",
  REGISTRY_URL: "http://localhost:3300",
  WS_URL: "ws://localhost:3200/v1/ws",
  DASHBOARD_URL: "http://localhost:3300/dev/",
};
