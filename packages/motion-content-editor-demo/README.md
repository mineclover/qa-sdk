# @qa-sdk/motion-content-editor-demo

`@qa-sdk/motion-content-editor-demo`는 Motion Content V1의 가장 얇은 소비 앱이다. preset composition과 editor shell, demo stage adapter를 연결해 브라우저에서 빠르게 수동 검증할 수 있게 한다.

## 책임

- editor shell 마운트
- preset composition 주입
- preset 전환과 localStorage 복원 orchestration
- play / pause / restart / scrub / loop / playbackRate 수동 검증
- 브라우저 검증용 샌드박스 제공
- JSON 업로드/다운로드 workflow 검증

## 포함하지 않는 것

- 코어 타입/런타임 계약 정의
- 편집기 상태 모델 구현
- 라이브러리 외부 계약 확장

## 패키지 경계

- 이 앱은 `motion-content`와 `motion-content-editor`를 소비만 한다.
- acceptance QA의 기준 소비처이며, 기능 SSOT는 하위 라이브러리 패키지에 남겨둔다.

## 수동 검증 시나리오

1. `pnpm --filter @qa-sdk/motion-content-editor-demo dev`로 demo를 연다.
2. 상단 preset selector에서 `런치 크로스페이드`, `세일 플래시`, `브랜드 리프트`를 번갈아 선택하고, headline/accent/transition 감각이 바뀌는지 확인한다.
3. editor toolbar의 `Download`로 현재 composition JSON을 저장한다.
4. Parameters나 timeline을 수정한 뒤, 방금 저장한 JSON을 `Upload` 또는 textarea `Apply`로 다시 불러온다.
5. 브라우저를 새로고침해 마지막 composition 또는 custom import 상태가 복원되는지 확인한다.
6. `로컬 저장 지우기`를 눌러 persisted state가 비워지고 현재 preset 기준 clean baseline으로 돌아오는지 확인한다.
7. play / pause / restart / scrub / loop / playbackRate를 조작해 preset 전환 뒤에도 runtime transport와 timeline이 계속 동기화되는지 확인한다.

상세 용어집과 V1 계약은 [docs/specs/motion-content/v1-glossary-and-contracts.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/motion-content/v1-glossary-and-contracts.md)에서 본다.
