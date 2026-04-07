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

```bash
pnpm gate:event-taxonomy
```

환경별로:

```bash
REGISTRY_BASE_URL=http://localhost:3300 CATALOG_ID=demo pnpm gate:event-taxonomy
```

## 해석 순서

1. `taxonomy/check` 결과에서 failing service와 issue code를 본다.
2. `taxonomy/assert`가 409면 drift가 운영 게이트를 막는 상태다.
3. 필요하면 서비스 단위 surface로 내려간다.

```bash
curl -fsS "http://localhost:3300/api/event-catalog/services/<serviceId>/taxonomy?catalog=demo"
curl -fsS "http://localhost:3300/api/event-catalog/services/<serviceId>/taxonomy/check?catalog=demo"
```

## 주요 issue code

- `adoption-missing`
- `missing-pack-ids`
- `stale-pack-versions`
- `records-without-pack-metadata`
- `prefixes-without-ownership`

## 판정 기준

- `check.ok=true` 이고 `failingServiceCount=0` 이면 catalog 기준 합격
- `assert`가 201이면 운영 게이트 통과
- `assert`가 409면 해당 issue를 먼저 정리해야 한다

## 관련 소스

- `scripts/registry-event-taxonomy-gate.sh`
- `packages/registry-service/src/modules/events/event-catalog.service.ts`
- `docs/specs/event-vocab-system/service-event-adoption.plan.md`
