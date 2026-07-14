// ── 배포 환경별 설정 ─────────────────────────────────────────
// query parameter (?ingest=...) 는 최우선 오버라이드로 동작.
// 로컬 개발: ?ingest=http://localhost:3200 으로 오버라이드 가능.
window.__QA_CONFIG__ = {
  INGEST_URL: 'https://qa-gateway.astralclover.workers.dev',
  REGISTRY_URL: 'https://qa-gateway.astralclover.workers.dev',
  MONITOR_URL: 'https://platform-demo-3v1.pages.dev',
  DASHBOARD_URL: 'https://qa-gateway.astralclover.workers.dev/dev/',
  ENV: 'prod',
  REGION: 'asia',
};
