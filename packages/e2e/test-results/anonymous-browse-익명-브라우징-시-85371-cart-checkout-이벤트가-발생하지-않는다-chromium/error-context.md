# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - heading "QA Shop" [level=1] [ref=e3] [cursor=pointer]
    - generic [ref=e4]:
      - generic [ref=e5]: user@shop.com
      - generic [ref=e6] [cursor=pointer]: 로그아웃
  - navigation [ref=e7]:
    - generic [ref=e8] [cursor=pointer]: 홈
    - generic [ref=e9] [cursor=pointer]: 상품
    - generic [ref=e10] [cursor=pointer]: 장바구니 0
    - generic [ref=e11] [cursor=pointer]: 마이페이지
  - generic [ref=e14]:
    - button "← 목록으로" [ref=e15] [cursor=pointer]
    - heading "스마트 워치 Ultra" [level=2] [ref=e16]
    - paragraph [ref=e17]: ₩299,000
    - paragraph [ref=e18]: 건강 모니터링 + GPS + 5ATM 방수.
    - generic [ref=e19]:
      - button "장바구니에 담기" [ref=e20] [cursor=pointer]
      - button "장바구니 보기" [ref=e21] [cursor=pointer]
  - generic [ref=e22]:
    - generic [ref=e23]: "qa: page.product_detail"
    - generic [ref=e24]: "events: 18"
  - link "⊞ Monitor" [ref=e26] [cursor=pointer]:
    - /url: https://platform-demo-3v1.pages.dev/monitor.html
```