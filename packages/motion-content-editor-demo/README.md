# @qa-sdk/motion-content-editor-demo

`@qa-sdk/motion-content-editor-demo`는 Motion Content V1의 가장 얇은 소비 앱이다. preset composition과 editor shell, demo stage adapter를 연결하고, online workspace bootstrap/open/create 흐름을 통해 브라우저에서 빠르게 수동 검증할 수 있게 한다.

## 책임

- editor shell 마운트
- workspace id 기반 open/create bootstrap
- preset seed와 import source orchestration
- document / persisted editor state의 remote workspace 저장
- play / pause / restart / scrub / loop / playbackRate 수동 검증
- 브라우저 검증용 샌드박스 제공
- JSON 업로드/다운로드 workflow 검증

## 포함하지 않는 것

- 코어 타입/런타임 계약 정의
- 편집기 상태 모델 구현
- 라이브러리 외부 계약 확장

## 패키지 경계

- 이 앱은 `motion-content`와 `motion-content-editor`를 소비만 한다.
- remote workspace 저장은 `motion-workspace` / `motion-workspace-client` 계약을 그대로 따른다.
- acceptance QA의 기준 소비처이며, 기능 SSOT는 하위 라이브러리 패키지에 남겨둔다.

## 수동 검증 시나리오

1. `pnpm --filter @qa-sdk/motion-workspace-service dev`로 workspace service를 띄운다.
2. 다른 터미널에서 `pnpm --filter @qa-sdk/motion-content-editor-demo build` 후 `pnpm --filter @qa-sdk/motion-content-editor-demo preview`를 실행한다.
3. preview를 열면 URL에 `?workspace=...`가 붙은 새 workspace가 자동 생성되고, 현재 preset이 seed로 반영되는지 확인한다.
4. 상단 `Workspace ID`에 기존 id를 넣고 `Workspace 열기`를 눌러 같은 remote workspace가 다시 열리는지 확인한다.
5. preset selector를 바꾼 뒤 `현재 workspace에 preset 적용`을 눌러 현재 workspace 문서가 새 preset seed로 교체되고 revision/savedAt이 갱신되는지 확인한다.
6. Parameters나 timeline을 수정한 뒤 새로고침해서 변경사항이 remote workspace에서 다시 열리는지 확인한다.
7. editor toolbar의 `Download`로 현재 composition JSON을 저장하고, 수정 후 `Upload` 또는 textarea `Apply`로 다시 불러온다. 그 뒤 새로고침해서 import된 문서가 같은 remote workspace에 유지되는지 확인한다.
8. play / pause / restart / scrub / loop / playbackRate를 조작해 runtime transport와 timeline이 계속 동기화되는지 확인한다.

## Legacy Migration QA

- 기존 local demo state migration 검증은 `pnpm --filter @qa-sdk/motion-content-editor-demo qa:migration`으로 helper script를 실행해 DevTools snippet과 확인 항목을 생성한다.
- 이 QA는 `qa-sdk.motion-content-editor-demo/v1`만 remote workspace로 import하고, `mce-layout/v1` / `mce-theme/v1`은 계속 localStorage에 남는지 확인하는 데 초점을 둔다.
- migration 후에는 import banner가 사라지고, 새로고침 시 URL의 `?workspace=...` 기준으로 같은 remote workspace가 다시 열려야 한다.

## 로컬에 남는 것

- layout, theme 같은 shell preference만 localStorage에 남는다.
- workspace document, persisted editor state, preset/import provenance는 remote workspace service가 저장한다.

## 실행 메모

- demo는 `/api/motion-workspace` relative base URL을 사용한다.
- `vite dev`와 `vite preview` 모두 `motion-workspace-service` 기본 주소 `http://localhost:3710`으로 proxy된다.
- 다른 주소를 쓰려면 `MOTION_WORKSPACE_SERVICE_ORIGIN=http://host:port`를 주고 demo를 실행한다.

상세 용어집과 V1 계약은 [docs/specs/motion-content/v1-glossary-and-contracts.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/motion-content/v1-glossary-and-contracts.md)에서 본다.
