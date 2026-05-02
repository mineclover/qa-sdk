---
name: event-taxonomy-gate
description: "registry event taxonomy 운영 게이트를 실행하고 해석한다. `pnpm gate:event-taxonomy`로 taxonomy check/assert를 수행하고, drift issue를 보고 어떤 서비스와 pack이 정리 대상인지 판단할 때 사용한다."
---

# Event Taxonomy Gate

registry event taxonomy의 운영 정합성을 점검하고 정리하는 스킬이다.

## 언제 쓰는가

- `event-adoption` 변경 후 운영 정합성을 확인할 때
- 배포 전 registry event taxonomy drift를 실패시키고 싶을 때
- 어떤 서비스가 pack/adoption/ownership 기준에서 문제가 있는지 보고 싶을 때

## 기본 루프

먼저 registry-service가 떠 있는지 확인한다. 연결 실패(curl 7)는 taxonomy drift가 아니라 운영 전제 미충족이다.

```bash
curl -fsS "http://localhost:3300/api/event-catalog/taxonomy/check?catalog=demo"
```

서비스가 꺼져 있으면 별도 터미널에서 실행한다.

```bash
pnpm dev:registry
```

그 다음 gate를 실행한다.

```bash
pnpm gate:event-taxonomy
```

환경별로:

```bash
REGISTRY_BASE_URL=http://localhost:3300 CATALOG_ID=demo pnpm gate:event-taxonomy
```

## 해석 순서

1. curl connection refused면 registry-service를 먼저 올린다. drift로 해석하지 않는다.
2. `taxonomy/check` 결과에서 failing service와 issue code를 본다.
3. `taxonomy/assert`가 409면 drift가 운영 게이트를 막는 상태다.
4. 필요하면 서비스 단위 surface로 내려간다.

```bash
curl -fsS "http://localhost:3300/api/event-catalog/services/<serviceId>/taxonomy?catalog=demo"
curl -fsS "http://localhost:3300/api/event-catalog/services/<serviceId>/taxonomy/check?catalog=demo"
```

## 주요 issue code

- `adoption-missing`
- `missing-pack-ids`
- `stale-pack-versions`
- `adopted-prefixes-without-ownership`
- `records-without-pack-metadata`
- `prefixes-without-ownership`

## 판정 기준

- `check.ok=true` 이고 `failingServiceCount=0` 이면 catalog 기준 합격
- `assert`가 201이면 운영 게이트 통과
- `assert`가 409면 해당 issue를 먼저 정리해야 한다
- curl 7/connection refused면 registry-service 미기동이다. `pnpm dev:registry` 후 재시도한다.

## logger fallback event key

- `svc_log.<level>`은 logger bridge의 diagnostic fallback이다.
- 이 key는 core vocabulary 또는 adoption-clean mapping pack으로 자동 인정하지 않는다.
- gate-clean event가 필요하면 호출부가 명시 `eventKey`를 넣거나, fallback key를 포함한 mapping pack과 service adoption을 별도로 추가한다.

## 관련 소스

- `scripts/registry-event-taxonomy-gate.sh`
- `packages/registry-service/src/modules/events/event-catalog.service.ts`
- `docs/specs/event-vocab-system/service-event-adoption.spec.md`
- `docs/specs/event-vocab-system/service-event-adoption.rule.md`
- `docs/specs/observability-system/event-logging-lifecycle.rule.md`
