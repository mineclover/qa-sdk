---
def:
  id: registry-service-scenario-1
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: registry-service
  links:
    - target: registry-system
      type: refines
    - target: registry-api
      type: depends_on
---
# 서비스 등록/조회

## 목적 ^purpose

registry-service에서 서비스 등록, 수정, 조회, prefix 소유권 반영, 삭제까지의 기본 관리 흐름이 일관되게 유지되는 기준 시나리오를 정의한다.

플랫폼 운영자가 새 서비스를 등록하고, 조회/수정/엔드포인트 추가까지 수행하는 기준 시나리오.

## 행위자 ^actor

- **플랫폼 운영자** — 서비스 토폴로지를 관리하며 registry-service API를 직접 호출한다.
- **registry-service** (port 3300) — D1/SQLite 기반 서비스 메타데이터 저장소. NestJS 런타임.

## 사전 조건 ^preconditions

- registry-service가 기동 완료 상태이며 seed가 정상 수행됨
- D1/SQLite DB에 `checkout_web` 이름의 서비스가 존재하지 않음
- 등록할 서비스의 `ownedPrefixes`에 해당하는 prefix가 이미 registry에 등록되어 있음 (예: `cart_event`, `order_event`)
- `ServiceBootConfig`가 서비스 정체성의 단일 진입점으로 유효함

## 스텝 ^steps

1. `POST /api/services` → 서비스 등록 요청 전송. body에 `service_name: "checkout_web"`, `description`, `owner: "team-checkout"`, `ownedPrefixes: ["cart_event", "order_event"]`, `endpoints`, `attributes` 포함
2. 응답 확인 → HTTP 201 수신. 반환된 `ServiceEntry`에 서버 생성 `serviceId`가 포함됨
3. `GET /api/services` → 전체 서비스 목록 조회. `checkout_web`이 목록에 존재하는지 확인
4. `GET /api/services/:serviceId` → 단건 조회. `service_name`, `ownedPrefixes`, `owner` 필드가 등록 시 값과 일치하는지 검증
5. `PATCH /api/services/:serviceId` → `description` 필드 변경 요청 전송
6. `GET /api/services/:serviceId` → 재조회하여 `description`이 변경된 값으로 반영됐는지 확인
7. `GET /api/services/svc-owners` → prefix → serviceId 매핑에서 `cart_event`와 `order_event`가 `checkout_web`의 `serviceId`로 매핑되는지 확인
8. `GET /api/services/urls?env=dev` → 서비스별 URL 맵에서 `checkout_web`의 dev 환경 URL이 반환되는지 확인
9. `DELETE /api/services/:serviceId` → 서비스 삭제 요청 전송
10. `GET /api/services/:serviceId` → 삭제 후 조회 시 404 반환 확인

## 검증 ^assertions

- 서비스 등록 시 `service_name` 중복이면 적절한 에러(409 또는 동등)가 반환된다
- `serviceId`는 클라이언트가 지정할 수 없으며 서버가 내부 생성한다
- `ownedPrefixes`에 선언된 prefix는 해당 서비스만 이벤트를 생산하는 prefix여야 한다 (생산자 단일 책임)
- 같은 prefix를 두 서비스가 동시에 `ownedPrefixes`로 소유하면 등록/수정이 거부된다
- `GET /api/services/svc-owners`의 결과는 등록된 서비스의 `ownedPrefixes`와 정합적이다
- `GET /api/services/gateway`는 등록된 서비스의 endpoint 정보를 기반으로 게이트웨이 라우팅 구성을 반환한다
- `PATCH`와 `PUT`은 같은 `replaceAll()` 로직으로 연결되어 기존 클라이언트 호환성이 유지된다
- 삭제 후 해당 서비스가 소유하던 prefix의 svc-owners 매핑도 제거된다

## 변형 ^variants

- **V1 — 중복 서비스명 등록 시도**: 이미 존재하는 `service_name`으로 `POST /api/services` 호출 → 충돌 에러 반환. 기존 서비스 데이터는 변경되지 않음
- **V2 — ownedPrefixes 충돌**: 다른 서비스가 이미 소유한 prefix를 `ownedPrefixes`에 포함하여 등록 시도 → 거부. 생산자 단일 책임 위반
- **V3 — 엔드포인트 오버레이**: 서비스 등록 후 `PUT /api/endpoints/:ns/:svc/:env/:region`으로 endpoint를 추가/변경하고, `GET /api/endpoints/resolve`로 올바른 URL이 resolve되는지 확인
- **V4 — 서비스 health 조회**: 등록 후 `GET /api/health/services`에서 해당 서비스의 health 상태가 포함되는지 확인

## 재검토 트리거 ^update-trigger

- `ServiceController` 또는 `ServiceTopologyService`의 API surface가 변경될 때
- `ownedPrefixes` 검증 로직이 강화되거나 완화될 때
- `ServiceEntry` 스키마에 필수 필드가 추가될 때
- endpoint overlay 메커니즘이 변경될 때
