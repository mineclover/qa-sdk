---
def:
  id: shop-web-spec
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: shop-web
  tags: [frontend, browser, demo]
  links:
    - target: browser-system
      type: refines
    - target: sdk-vite-onboarding-guide
      type: depends_on
---
# Shop Web

## 목적 ^purpose

브라우저 SDK와 카탈로그 로더를 소비하는 쇼핑 데모 사이트. 로그인, 탐색, 장바구니, 결제 흐름을 통해 브라우저 수집 경로를 실제 사용자 surface로 검증한다.

## 구성 ^overview

- 정적 `public/` 앱 진입점
- `qa-browser-sdk.js`와 카탈로그 로더 번들 소비
- `config.js` 기반 런타임 설정 주입
- Cloudflare Pages 배포 전제

## 관련 소스

- `packages/shop-web/public/index.html`
- `packages/shop-web/public/config.js`
- `packages/shop-web/public/qa-browser-sdk.js`
- `packages/shop-web/wrangler.toml`
