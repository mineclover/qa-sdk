---
def:
  id: ingest-quality-bundle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, quality-bundle, ingest]
  links:
    - target: ingest-quality-bundle
      type: refines
    - target: ingest-system
      type: depends_on
sources:
  - packages/ingest-server/src/app.ts
  - packages/ingest-server/src/routes/ingest.ts
  - packages/ingest-server/src/lib/phase-two-worker.ts
  - packages/ingest-server/src/sdk-to-ingest.e2e.test.ts
---

# Ingest Quality Bundle — 소비자 기대 시나리오

## 목적 ^purpose

`ingest-quality-bundle`(build/test/sdk-bridge 게이트)이 `ingest-system`에 의존할 때 기대하는 계약. quality bundle은 ingest-system의 공개 계약(입력/출력/파이프라인 전제)을 claim audit의 기준점으로 사용하며, ingest-system 계약 변화가 적절한 채널로 전파되어야 게이트가 유효.

## 시나리오 1: 공개 계약 고정 ^overview

**전제**: `ingest-quality-contract`가 ingest-system의 공개 입력/출력을 기준으로 선언된다.

**동작**: ingest-system의 API endpoint, payload 스키마, response 코드 변경.

**기대**:
- 공개 계약에 속한 필드/endpoint 변경은 quality-bundle의 contract 버전 bump 필수
- contract version 불일치 시 gate-ingest-test 실패 (명시적 mismatch 에러)
- 내부 리팩토링(private 구현)은 bundle에 영향 없음

**실패 시 수정 대상**: `ingest-system`의 공개 vs 내부 경계. 공개 계약이 문서화되지 않으면 quality bundle 기준점이 흔들려 game-over 상황 발생.

## 시나리오 2: build 게이트 — 서비스 시작 검증 ^overview

**전제**: `gate-ingest-build`가 ingest-server 빌드 및 boot 가능성을 검증한다.

**동작**: CI에서 `pnpm --filter ingest-server build && node dist/index.js --dry-run` 실행.

**기대**:
- ingest-system이 요구하는 모든 peer dependency가 install 시점에 해결됨
- boot 시 외부 fetch가 있다면 `AbortSignal.timeout(5_000)` 적용 (CLAUDE.md 규칙)
- dry-run이 30초 이내 완료 (CI 시간 예산)

**실패 시 수정 대상**: `ingest-system` 패키지 매니페스트와 boot sequence. timeout 적용이 선택적이면 CI가 네트워크 이슈로 간헐적 실패.

## 시나리오 3: test 게이트 — 전체 테스트 ^overview

**전제**: `gate-ingest-test`가 ingest-server의 전체 테스트 스위트를 실행한다.

**동작**: `pnpm --filter ingest-server test`.

**기대**:
- 테스트가 In-memory store 기반 (SSOT 테스트 원칙)
- 외부 서비스 의존 없음 (registry/gate는 mock)
- 테스트 실패 시 실패 endpoint 또는 pipeline phase를 명시적으로 식별

**실패 시 수정 대상**: `ingest-system`의 `scenario-spec`/테스트 구조. mock 경계가 흐려지면 테스트가 네트워크 의존으로 CI flakiness.

## 시나리오 4: SDK bridge 게이트 ^overview

**전제**: `gate-ingest-sdk-bridge`가 SDK → ingest 통합 경로를 검증한다.

**동작**: SDK 패키지를 emit → 테스트 앱이 ingest-server로 envelope 전송.

**기대**:
- 전송된 envelope이 ingest-system Zod 스키마와 일치
- SDK 버전과 ingest-system `schemaVersion`이 호환 (major 일치)
- bridge 실패 시 SDK contract 또는 ingest-system 수신 endpoint 둘 중 어느 쪽이 drift 인지 명시

**실패 시 수정 대상**: `ingest-system`과 `browser-codec`의 version compatibility 매트릭스. 명시되지 않으면 major/minor drift 감지가 불가능.
