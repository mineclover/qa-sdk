// ── 로컬 실행 기본 설정 ───────────────────────────────────────
// Vite 앱은 VITE_API_BASE로 platform-demo-api(로컬 Worker)를 사용한다.
// 정적 관찰 페이지는 로컬 registry/gateway/ingest를 직접 호출한다.
const QA_DEMO_ORIGIN = window.location.origin;
const QA_DEMO_API_ORIGIN = 'http://localhost:8788';
const QA_INGEST_ORIGIN = 'http://localhost:8787';
const QA_REGISTRY_ORIGIN = 'http://localhost:3300';

window.__QA_CONFIG__ = {
  INGEST_URL: QA_INGEST_ORIGIN,
  REGISTRY_URL: QA_REGISTRY_ORIGIN,
  DIAGRAM_URL: '',
  WS_URL: 'ws://localhost:3200/v1/ws',
  DASHBOARD_URL: `${QA_DEMO_ORIGIN}/dashboard.html`,
  MONITOR_URL: `${QA_DEMO_ORIGIN}/monitor.html`,
};
