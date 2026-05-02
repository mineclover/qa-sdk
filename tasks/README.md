# packages/tasks

구현 패키지와 분리된 작업 산출물 허브.

## 목적

- 여러 패키지를 가로지르는 PRD, task JSON, execution plan을 한 곳에 모은다
- 특정 패키지 소유로 보기 어려운 cross-package 작업을 정리한다
- `ralph-tui` 같은 실행 도구의 입력 산출물을 코드 패키지와 분리한다

## 배치 규칙

- 기능 축 단위 하위 디렉터리를 만든다
  - 예: `packages/tasks/motion-editor/`
- 구현 코드가 아닌 계획/작업 산출물만 둔다
- `package.json`은 두지 않는다
