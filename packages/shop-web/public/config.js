// ── 로컬 실행 기본 설정 ───────────────────────────────────────
// query parameter (?ingest=...) 는 최우선 오버라이드로 동작.
// 로컬 개발: ?ingest=http://localhost:3200 으로 오버라이드 가능.
window.__QA_CONFIG__ = {
  INGEST_URL: 'http://localhost:8787',
  REGISTRY_URL: 'http://localhost:3300',
  MONITOR_URL: 'http://localhost:5176',
  DASHBOARD_URL: 'http://localhost:8787/dev/',
  ENV: 'dev',
  REGION: 'asia',
};
