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
    - generic [ref=e10] [cursor=pointer]: 장바구니 1
    - generic [ref=e11] [cursor=pointer]: 마이페이지
  - generic [ref=e15]:
    - heading "로그인" [level=2] [ref=e16]
    - generic [ref=e17]:
      - generic [ref=e18]: 이메일
      - textbox [ref=e19]: user@shop.com
    - generic [ref=e20]:
      - generic [ref=e21]: 비밀번호
      - textbox [ref=e22]: password
    - button "로그인" [ref=e23] [cursor=pointer]
  - generic [ref=e24]:
    - generic [ref=e25]: "qa: page.login"
    - generic [ref=e26]: "events: 34"
  - link "⊞ Monitor" [ref=e28] [cursor=pointer]:
    - /url: https://platform-demo-3v1.pages.dev/monitor.html
```