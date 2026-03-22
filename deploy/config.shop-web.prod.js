// ── shop-web 프로덕션 설정 ────────────────────────────────
// 배포 시 이 파일을 config.js로 교체한다.
// 예: docker run -v $(pwd)/config.shop-web.prod.js:/usr/share/nginx/html/config.js shop-web
window.__QA_CONFIG__ = {
  INGEST_URL: "https://ingest.example.com",
  REGISTRY_URL: "https://registry.example.com",
  ENV: "prod",
  REGION: "asia",
};
