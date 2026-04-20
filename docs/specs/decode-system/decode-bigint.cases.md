---
def:
  id: decode-bigint-cases
  type: spec
  tier: component
  scope: feature
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: decode-service
  tags: [scenario, decode, bigint]
  links:
    - target: decode-bigint
      type: refines
    - target: decode-system
      type: depends_on
---

# Decode BigInt — 소비자 기대 시나리오

## 목적 ^purpose

`decode-bigint`(BigInt 주소 decode facade)가 `decode-system`에 의존할 때 기대하는 계약. BigInt decoder는 decode-system이 제공하는 DecoderPool 자동 라우팅과 decode-bundle 포맷을 소비한다.

## 시나리오 1: DecoderPool numberType 라우팅 ^overview

**전제**: `decode-system`의 `DecoderPool`이 DecodeMap의 `numberType` 필드를 기반으로 PrefixDecoder/PrefixDecoderBig 를 자동 라우팅한다.

**동작**: `POST /decode/big` 요청이 들어오고, DecoderPool이 대상 prefix의 bundle에서 numberType을 읽는다.

**기대**:
- `numberType === "bigint"` → `PrefixDecoderBig` 사용
- `numberType === "number"` → `INVALID_INPUT` (400)
- `numberType` 미지정 → `PrefixDecoderBig` 허용 (호출자 판단 존중)

**실패 시 수정 대상**: `decode-system`의 `decode-bundle` 스키마. numberType 필드가 optional로 두면 라우팅 분기가 런타임에 숨겨진 결함 생성. 스펙에서 필수 또는 기본값을 명시.

## 시나리오 2: bundle TTL 기반 invalidation ^overview

**전제**: `decode-system`의 `DecoderPool`은 Node.js 에서 `CACHE_TTL_MS`(기본 60초) 기반 TTL 캐시를 쓴다.

**동작**: prefix 스키마가 변경되면 TTL 만료 후 다음 요청에서 null → 클라이언트 재요청 유도.

**기대**:
- TTL 만료 시 DecoderBig 인스턴스가 재생성 (새 bundle fetch)
- 재생성 실패 시 클라이언트에게 404 또는 503 (낡은 decoder로 잘못된 결과 반환 금지)
- 동시 요청이 TTL 만료 시점에 와도 dedup (stampede 방지)

**실패 시 수정 대상**: `decode-system`의 캐시 전략. stampede 방지 명시가 없으면 registry-service에 폭주 발생.

## 시나리오 3: registry fetch fail-open ^overview

**전제**: `decode-system`이 `REGISTRY_URL` 미설정 시 빈 pool로 시작 (fail-open)을 허용한다.

**동작**: decode-service 시작 시 `REGISTRY_URL`이 없거나 unreachable.

**기대**:
- 서비스 boot 성공 (빈 pool)
- 요청이 들어오면 404 (prefix not found) 반환
- registry 복구 시 자동 갱신 없음 (pull 모델, 다음 cache miss 시 fetch 시도)

**실패 시 수정 대상**: `decode-system`의 registry 의존 정책. fail-open 스펙이 명시되지 않으면 decode-service가 registry 장애 시 boot 실패로 cascading outage 유발.

## 시나리오 4: BigInt JSON 직렬화 ^overview

**전제**: `decode-system`의 REST endpoint들이 BigInt 응답을 문자열로 직렬화한다 (JSON bigint 미지원).

**동작**: `POST /decode/big` 응답의 address value가 string.

**기대**:
- 요청 body의 bigint input도 string (클라이언트가 `"123456789012345678"` 형태 전송)
- 응답의 bigint value도 string (10진수)
- 문자열 파싱 실패 시 `INVALID_INPUT` (400)

**실패 시 수정 대상**: `decode-system`의 `decode-api` spec. BigInt 직렬화 표준(hex vs decimal, 0x prefix, 등)이 명시되지 않으면 클라이언트 구현 간 비호환.
