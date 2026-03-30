---
def:
  id: registry-service-scenario-2
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: registry-service
  links:
    - target: registry-system
      type: refines
    - target: registry-version-lifecycle
      type: depends_on
---
# Prefix 버전 관리

## 목적 ^purpose

기존 prefix에 대해 새 draft 버전을 만들고, lock/release/activate를 거쳐 이전 active 버전을 대체하는 버전 라이프사이클의 기준 시나리오를 정의한다.

개발자가 기존 prefix에 capacity를 확장한 새 버전을 생성하고, draft → locked → released → active 라이프사이클 전이를 완료하는 기준 시나리오.

## 행위자 ^actor

- **개발자** — prefix 스키마를 설계하며 버전 라이프사이클을 관리한다.
- **registry-service** (port 3300) — prefix/version CRUD와 라이프사이클 전이를 제공한다.
- **ActivationGateService** — `CONSTRAINT_GATE_ENABLED=true` 시 활성화 전 DKG 기반 제약 검사를 수행한다.

## 사전 조건 ^preconditions

- registry에 `cart_event` prefix가 등록되어 있으며 `v1`이 active 상태
- `v1`의 `flow_type` 축 capacity가 8이고 entry 6개가 사용 중 (headroom = 2)
- 새 entry 추가 요구로 capacity 확장이 필요한 상황 (headroom ≤ 1 경고 임계값에 근접)
- `latestPrefixVersion(catalog, "cart_event")`로 동적 조회 시 `"v1"` 반환

## 스텝 ^steps

1. `GET /prefixes/cart_event` → prefix 상세 조회. 현재 versions 목록에서 `v1`이 active임을 확인
2. `GET /prefixes/cart_event/versions` → 버전 목록 조회. `v1` status=active 확인
3. `POST /prefixes/cart_event/versions` → 새 draft 버전 생성 요청. body에 `flow_type` 축 capacity를 `nextPowerOf2(6 * 2)` = 16으로 확장한 dims 명세 포함. 새 entry 추가
4. 응답 확인 → HTTP 201 수신. 반환된 version에 `status: "draft"`, 서버 생성 `versionId` 포함
5. `PATCH /prefixes/cart_event/versions/:versionId` → draft 상태에서 entry 라벨 수정
6. `POST /prefixes/cart_event/versions/:versionId/lock` → draft를 locked로 전이. capacity/entries 확정
7. `GET /prefixes/cart_event/versions/:versionId` → 조회하여 `status: "locked"` 확인. stride 계산 완료 검증
8. `POST /prefixes/cart_event/versions/:versionId/release` → locked를 released로 전이. 배포 준비 완료
9. `GET /prefixes/cart_event/versions/:versionId` → `status: "released"` 확인
10. `POST /prefixes/cart_event/versions/:versionId/activate` → released를 active로 전이. 이전 `v1`은 자동 deprecated
11. `GET /prefixes/cart_event/versions` → 버전 목록에서 새 버전이 `active`, `v1`이 `deprecated`임을 확인
12. `GET /prefixes/cart_event` → prefix 상세에서 `latestPrefixVersion` 결과가 새 버전을 가리키는지 확인

## 검증 ^assertions

- draft 상태에서만 capacity/entries 변경이 가능하다. locked 이후 `PATCH`는 거부된다
- 새 축 capacity는 `nextPowerOf2(entries.length * 2)` 이상이어야 한다 (눈대중 금지)
- locked → draft 역전이(`unlock`)는 가능하지만, released 이후는 역전이 불가
- active는 prefix당 최대 1개. 새 버전 activate 시 이전 active는 자동 deprecated
- deprecated → active 역전이는 불가하며, 새 버전으로만 대체 가능
- `CONSTRAINT_GATE_ENABLED=true` 시 activate 전에 `checkActivationReadiness` 통과 필수
- `POST_ACTIVATION_HOOK_ENABLED=true` 시 activate 후 DKG VersionEvent가 기록된다
- headroom = 0인 축이 존재하면 critical 경고가 발생한다
- stride 계산은 lock 시점에 확정되며, 이후 불변이다

## 변형 ^variants

- **V1 — locked 상태에서 수정 시도**: `PATCH /prefixes/cart_event/versions/:versionId` 호출 → 거부 에러 반환. capacity 불변 보장
- **V2 — unlock 후 재수정**: locked 상태에서 `POST .../unlock` → draft로 복귀 → capacity 변경 → 다시 lock. 설계 변경 허용
- **V3 — activation gate 실패**: `CONSTRAINT_GATE_ENABLED=true`, `CONSTRAINT_GATE_MODE=strict` 상태에서 DKG 제약 미충족 → activate 거부. warn 모드에서는 경고만 발생하고 통과
- **V4 — headroom 고갈**: 확장 없이 모든 entry를 사용한 축에서 headroom = 0 → critical 경고 발생. 운영자에게 capacity 확장 필요 알림
- **V5 — deprecated prefix에서 신규 버전**: deprecated 상태의 `v1`만 존재하고 active가 없는 상태에서 새 draft 생성 → 정상. active 부재는 허용됨

## 재검토 트리거 ^update-trigger

- 버전 라이프사이클 상태 전이 규칙이 변경될 때 (예: 새 상태 추가)
- activation gate 제약 검사 로직이 확장될 때
- capacity 계산 규칙 (`nextPowerOf2` 등)이 변경될 때
- `VersionController` API surface에 새 전이 엔드포인트가 추가될 때
- definition-service consumption 기록 연동이 변경될 때
