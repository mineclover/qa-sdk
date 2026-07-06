---
def:
  id: decode-quality-bundle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, quality-bundle, decode]
  links:
    - target: decode-quality-bundle
      type: refines
    - target: decode-system
      type: depends_on
sources:
  - packages/decode-service/src/app.ts
  - packages/decode-service/src/routes/decode.ts
  - packages/decode-service/src/lib/decoder-pool.ts
  - packages/decode-service/src/app.test.ts
---

# Decode Quality Bundle — 소비자 기대 시나리오

## 목적 ^purpose

`decode-quality-bundle`(build/test/route 게이트)이 `decode-system`에 의존할 때 기대하는 계약. quality bundle은 decode-system의 decode API surface와 decoder pool 동작을 claim audit의 기준점으로 사용한다.

## 시나리오 1: decode API surface 고정 ^overview

**전제**: `decode-quality-contract`가 decode-system의 공개 endpoint 집합을 고정한다.

**동작**: decode-system이 endpoint 추가/제거.

**기대**:
- 추가: 하위 호환 (기존 클라이언트 깨지지 않음)
- 제거: major version bump + deprecation 주기 (최소 1 release)
- 변경: URL, method, response shape 중 하나라도 바뀌면 bundle contract 갱신

**실패 시 수정 대상**: `decode-system`의 `decode-api` 버저닝 정책. deprecation 주기가 명시되지 않으면 클라이언트가 조용히 깨짐.

## 시나리오 2: build 게이트 — 번들 크기 ^overview

**전제**: `gate-decode-build`가 decode-service 번들의 크기와 의존성을 검증한다.

**동작**: `pnpm --filter decode-service build` + 번들 크기 측정.

**기대**:
- CF Workers 배포 타깃의 경우 번들 크기 제한 (워커 1MB 제한) 충족
- tree-shaking 후 사용하지 않는 decode-system export는 제외
- node-only 코드가 worker 번들에 포함되면 build 실패 (런타임 에러 방지)

**실패 시 수정 대상**: `decode-system`의 `decode-deploy` 스펙. 배포 타깃별 번들 제약이 명시되지 않으면 CF Workers 배포 시 런타임에 발견.

## 시나리오 3: test 게이트 — 라운드트립 ^overview

**전제**: `gate-decode-test`가 PrefixDecoder encode → decode 라운드트립을 검증한다.

**동작**: 테스트 스위트가 소형(3x3x3=27 주소) + 대형(256^3=16,777,216 주소) 공간에서 전수 라운드트립.

**기대**:
- `encode(decode(x)) === x` for all x in [0, size)
- BigInt와 Number 양쪽 모두 검증 (decode-system의 numberType 분기 커버리지)
- 대형 공간은 샘플링 허용 (소수 스팟 + 경계값)

**실패 시 수정 대상**: `decode-system`의 `decode-bundle` 결정론 규칙. encode-decode 비대칭 이 발견되면 bundle 생성 algorithm에 버그.

## 시나리오 4: route 게이트 ^overview

**전제**: `gate-decode-route`가 REST route 정책을 검증한다.

**동작**: 각 route에 대해 happy path + error path 테스트.

**기대**:
- 모든 route에 대해 CORS, auth, rate-limit 정책 적용됨
- 에러 응답 포맷 통일 (`{ error, message, request_id }`)
- `decode-service`에 정의된 모든 route가 `decode-api` 스펙에 존재 (orphan route 금지)

**실패 시 수정 대상**: `decode-system`의 `decode-api`. orphan route 감지 테스트가 없으면 spec 에 없는 endpoint 가 배포될 수 있음.
