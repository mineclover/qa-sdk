---
status: source-backed
sources:
  - packages/infra-engine/src/adapters/coordinate.ts
  - packages/infra-engine/__tests__/adapters/coordinate.test.ts
  - packages/infra-engine/src/cli/cmd-deploy.ts
  - packages/infra-engine/src/index.ts
---

# CoordinateAdapter 좌표 실인코딩 전환 설계

> 2026-04-06. fail-open → Catalog 기반 실인코딩.

## 목적

infra-engine의 CoordinateAdapter를 fail-open(빈 값 반환)에서 Catalog 기반 실인코딩으로 전환. deploy/health 이벤트에 실제 좌표 address_context를 부여.

## 접근법

Catalog 생성자 주입. 현재는 demo-snapshot의 DEMO_CATALOG을 주입하고, 서버 이관 시 와이어링만 교체.

## 핵심 함수

`@qa-sdk/core/catalog/runtime.ts`의 canonical 함수 사용:
- `latestPrefixVersion(catalog, prefixId)` — 버전 동적 조회 (v1 하드코딩 금지)
- `encodePrefixByValue(catalog, prefixId, version, values)` — 시맨틱 값 → 정수 주소
- `encodePrefix(catalog, prefixId, version, positions)` — 위치(0-based) → 정수 주소

## 메서드별 설계

### resolveSvcRef(serviceId, env, region, namespace?)

1. `service` prefix에서 `encodePrefixByValue(catalog, "service", version, { env, region, svc_name: serviceId, namespace: namespace ?? "shop" })`
2. 반환: `"service:{version}:{address}"` 또는 실패 시 `null`
3. namespace 기본값: `"shop"` (INFRA_SVC 매핑의 기본 네임스페이스)

### encodeDeployEvent(svcRef, action, actor?)

1. svcRef가 null이면 `{}` (fail-open 유지)
2. svcRef에서 정수 주소 추출 (파싱: `"service:v1:42"` → 42)
3. `deploy_event` prefix는 3차원: svc_ref(prefix_ref) × deploy_action(axis) × actor(table_ref)
4. actor가 table_ref (동적) → 위치 0 기본값
5. `encodePrefix(catalog, "deploy_event", version, { svc_ref: refIdx, deploy_action: actionIdx, actor: actorIdx })` 사용
   - `refIdx`: refEntries.values에서 svcRef 주소의 index
   - `actionIdx`: deploy_action axis entries에서 action의 index
   - `actorIdx`: actor 파라미터가 없으면 0
6. 반환: `{ deploy_event: "deploy_event:{version}:{address}" }`

### encodeHealthEvent(svcRef, status)

1. svcRef가 null이면 `{}` (fail-open 유지)
2. `health_event` prefix는 2차원: svc_ref(prefix_ref) × health_status(axis)
3. `encodePrefix` 사용 (prefix_ref + axis 위치 직접 계산)
4. 반환: `{ health_event: "health_event:{version}:{address}" }`

### 에러 처리

모든 메서드를 try-catch로 감싸서 인코딩 실패 → `null` / `{}` 반환 (fail-open). 이유:
- catalog에 해당 prefix/axis가 없을 수 있음 (개발 환경)
- axis entry에 매칭되지 않는 값이 올 수 있음

## 파일 변경

| 파일 | 변경 |
|------|------|
| `infra-engine/src/adapters/coordinate.ts` | createCoordinateAdapter(catalog) → 실인코딩 |
| `infra-engine/__tests__/adapters/coordinate.test.ts` | 실인코딩 결과 검증 |
| `infra-engine/package.json` | demo-snapshot 의존 추가 |
| `infra-engine/src/cli/cmd-deploy.ts` | DEMO_CATALOG 주입 와이어링 |
| `infra-engine/src/index.ts` | adapter 생성 시 catalog 주입 |

## 테스트

- mock catalog (DEMO_CATALOG 구조 축소판) 주입으로 단위 테스트
- resolveSvcRef: 정상 → 주소 문자열, 미등록 서비스 → null
- encodeDeployEvent: 정상 → address_context, svcRef null → {}
- encodeHealthEvent: 정상 → address_context, 미등록 status → {}
- 인코딩 실패 → fail-open 검증
