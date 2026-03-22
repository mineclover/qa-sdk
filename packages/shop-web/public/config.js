// ── 배포 환경별 설정 ─────────────────────────────────────────
// 이 파일을 배포 대상 환경에 맞게 교체하거나,
// Docker 빌드 시 envsubst로 치환할 수 있다.
// query parameter (?ingest=...) 는 여전히 최우선 오버라이드로 동작.
window.__QA_CONFIG__ = {
  INGEST_URL: "http://localhost:3200",
  REGISTRY_URL: "http://localhost:3300",
  MONITOR_URL: "http://localhost:5176",
  DASHBOARD_URL: "http://localhost:3300/dev/",
  ENV: "dev",
  REGION: "asia",
};
