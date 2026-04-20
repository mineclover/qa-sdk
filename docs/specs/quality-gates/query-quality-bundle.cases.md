---
def:
  id: query-quality-bundle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [scenario, quality-gate, query]
  links:
    - target: query-quality-bundle
      type: refines
    - target: query-system
      type: depends_on
---

# Query Quality Bundle — 소비자 기대 시나리오

## 목적 ^purpose

`query-quality-bundle`(build/test/gate-integration 게이트 + query-quality-contract)이 `query-system`에 의존할 때 기대하는 계약. 번들은 query-system 이 공개하는 resolve/rules/gate 연동 surface 가 안정적으로 제공되어야 claim audit 이 가능하다.

## 시나리오 1: query-quality-contract resolve API 검증 ^overview

**전제**: `query-system`이 `query-api`, `query-rules`, `query-gate-integration` 3개 하위 시스템으로 surface 를 구성.

**동작**: `gate-query-test` 게이트가 resolve 호출 → rules 적용 → gate 상태 합성 end-to-end 시나리오 실행.

**기대**:
- 각 계약 문서의 endpoint 가 실제 구현에 존재
- resolve 결과가 rules + gate 합성 순서 일관 (rules 우선, gate overlay)
- contract drift 발견 시 test 실패 + 어느 하위 문서를 수정할지 진단 메시지

**실패 시 수정 대상**: `query-system.md` — resolve path 설명이 partial 이면 gate 합성 시점(해소 전/후)이 구현별로 달라짐. 순서 명문화 필요.

## 시나리오 2: gate-query-build 배포 규약 ^overview

**전제**: `query-system`은 `@qa-sdk/query-service` ESM only + tsc build 규약.

**동작**: build 게이트가 `pnpm --filter query-service build` → publish dry-run 실행.

**기대**:
- TypeScript target ES2023, dist ESM only
- `process.env` 직접 접근 금지 (service는 config/env.ts zod 스키마 사용 규약)
- config env 미설정 시 서비스 시작 실패 (에러 명시)

**실패 시 수정 대상**: `query-system.md` — env 처리 규약(직접 접근 금지)이 spec 이 아닌 convention 문서에만 있어 build 게이트가 enforce 못함. query-system 에 명시 필요.

## 시나리오 3: gate-service URL 연동 검증 ^overview

**전제**: `query-system.md` §"서비스 의존" 이 `GATE_SERVICE_URL` 설정/미설정 분기를 규정.

**동작**: `gate-query-gate-integration` 이 `HttpGateStateClient` 와 `NoopGateStateClient` 각각에서 resolve 호출.

**기대**:
- Noop: gate 상태 미첨부, resolve 결과 rules 만 반영
- Http: gate 실패 → `gateFailureMode` 에 따라 fail-open / fail-closed
- 두 모드 모두 같은 API surface 로 동작

**실패 시 수정 대상**: `query-system.md` — gateFailureMode 기본값이 명문화되지 않으면 Http 경로 실패 시 결과가 환경별로 다름.

## 시나리오 4: rules store 어댑터 등가성 ^overview

**전제**: query-system 의 `PolicyRuleStore` 가 Memory/SQL 어댑터 모두 동일 계약.

**동작**: `gate-query-test` 가 InMemory 와 SqliteDriver(`:memory:`) 양쪽에서 rules CRUD.

**기대**:
- 같은 입력 → 같은 결과 (id, priority, pattern)
- SQL 어댑터 테스트는 NodeSqliteDriver(`:memory:`) + DDL 주입 (테스트 패턴 스펙 준수)
- breaking change 시 두 어댑터 동시 실패 (partial 실패는 port 파손 신호)

**실패 시 수정 대상**: `query-system.md` §"저장소 레이어" — 어댑터 등가성 요구가 spec 에 없으면 SQL/Memory 구현이 drift 되어 CI 신뢰도 저하.
