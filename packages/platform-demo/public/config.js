// ── 배포 환경별 설정 ─────────────────────────────────────────
// Vite 앱은 VITE_API_BASE로 platform-demo-api를 사용한다.
// 정적 관찰 페이지도 동일한 demo API와 gateway ingest API를 직접 호출한다.
const QA_DEMO_ORIGIN = window.location.origin;
const QA_DEMO_API_ORIGIN = 'https://platform-demo-api.astralclover.workers.dev';
const QA_INGEST_ORIGIN = 'https://qa-gateway.astralclover.workers.dev';

window.__QA_CONFIG__ = {
  INGEST_URL: QA_INGEST_ORIGIN,
  REGISTRY_URL: QA_DEMO_API_ORIGIN,
  DIAGRAM_URL: '',
  WS_URL: 'wss://qa-ingest-server.astralclover.workers.dev/v1/ws',
  DASHBOARD_URL: `${QA_DEMO_ORIGIN}/dashboard.html`,
  MONITOR_URL: `${QA_DEMO_ORIGIN}/monitor.html`,
};
