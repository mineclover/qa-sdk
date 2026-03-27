# motion-workspace-client

`motion-workspace-client`는 온라인 motion workspace API를 위한 typed HTTP client다.

## 책임

- workspace CRUD 요청
- apply-command 요청
- conflict / error shape 정규화
- 브라우저와 Node에서 공통 사용 가능한 fetch 래퍼

## 포함하지 않는 것

- workspace schema 자체
- DOM editor shell
- 서버 persistence 구현
