# Slice Topology Taxonomy

> 슬라이스의 **위상 (topology)** 은 슬라이스가 어떤 종류의 책임을 지는지 명시하는 first-class 분류. validator 가 이를 읽어 룰을 분기한다 — substring/path 휴리스틱이 아니라 명시적 선언.

## 1. 5 위상

| topology | 의미 | aggregate | use-case | transaction port | outbox port | read-model | bff |
|---|---|---|---|---|---|---|---|
| `service` | 표준 도메인 슬라이스 — write + read 정상 | 필수 | 필수 | 필수 | 필수 (boundary 시) | 선택 | 선택 |
| `read-model` | 변경 명령은 admin port 로 분리, 본체는 query/projection | 부재 정상 | 흔치 않음 | 부재 정상 | 부재 정상 | 필수 | 선택 |
| `bff` | UI 합성 (`presentation/bff/*`) — read 전용 | 부재 정상 | 흔치 않음 | 부재 정상 | 부재 정상 | 선택 | 필수 |
| `command-only` | aggregate 없는 순수 command (예: `authenticate`) | 부재 정상 | 필수 | 필수 | 선택 | 부재 정상 | 부재 정상 |
| `read-mostly` | cache/lookup 위주 (예: `bitmap` 발급) | 부재 정상 | 흔치 않음 | 부재 정상 | 부재 정상 | 필수 | 선택 |

## 2. SSOT — `metadata/openmetadata.seed.json` top-level `topology`

```json
{
  "topology": "read-model",
  "openmetadata": { ... }
}
```

- 1순위: 명시된 `topology` 필드 (5 enum 중 하나).
- 2순위 (폴백): 슬라이스 디렉터리 시그너처. `presentation/bff/` → `bff`, `application/queries/` 또는 `infrastructure/read-model/` 단독 → `read-model`.
- 3순위 (기본): `service`.

알려지지 않은 값은 무시되고 폴백으로 떨어진다 (validator `resolveTopology` 참조).

## 3. Validator 룰 분기

| Rule | 발동 위상 |
|---|---|
| `transaction-and-logging-are-ports` (transaction port 강제) | `service`, `command-only` |
| `transaction-and-logging-are-ports` (logger port 강제) | 모든 위상 |
| `transaction-outbox-use-unit-of-work` | `service`, `command-only` (transaction + outbox 둘 다 있는 경우) |
| `metadata-ships-with-domain-slice` (OM seed 강제) | `read-model`, `bff`, `read-mostly` (무조건); `service` 는 read-model/BFF 시그너처 보일 때만 |
| `metadata-ships-with-domain-slice` (read-model cache key) | `read-model`, `read-mostly`; `service` + read-model 시그너처 |
| `metadata-ships-with-domain-slice` (bff cache key) | `bff`; `service` + bff 시그너처 |
| `topology-shape-mismatch` (read-model 산출물) | `read-model` (read-model artifact 부재 시 ERROR) |
| `topology-shape-mismatch` (bff 산출물) | `bff` (`presentation/bff/*` 부재 시 ERROR) |

## 4. 24 슬라이스 분포 (시뮬레이션 마이그레이션, 2026-04-27)

| 위상 | 개수 | 예시 |
|---|---|---|
| `service` | 17 | assignment, project, task, member, document, comment, version, budget, expense, resource, timeoff, notification, subscription, audit-event, user, role, role-assignment |
| `read-model` | 3 | reporting (project/budget/expense aggregates) |
| `bff` | 2 | audit-explorer, graph-explorer |
| `command-only` | 1 | authenticate |
| `read-mostly` | 1 | bitmap |

## 5. 위상 결정 가이드

새 슬라이스 진입 시 다음 순서로 자문:

1. **쓰기 명령이 있는가?** 없음 → `bff` (UI 합성) 또는 `read-model` (query/projection) 또는 `read-mostly` (cache/lookup).
2. **aggregate 가 있는가?** 없음 + 쓰기 있음 → `command-only`.
3. **`presentation/bff/*` 디렉터리에 합성 controller 가 있는가?** → `bff`.
4. **본체 산출물이 `application/queries/*` + `infrastructure/read-model/*` 인가?** → `read-model`.
5. 그 외 → `service` (기본).

## 6. 안티 패턴

- **admin-port 흉내** — `read-model` 슬라이스가 admin write API 를 슬라이스 내부에 두고 transaction port 를 강제로 도입. 정직한 표현은 `read-model` 위상 + admin write 를 별도 슬라이스로 분리.
- **위상 미선언** — OM seed 에 `topology` 필드 없음 → validator 가 시그너처로 폴백 추정. 선언이 없으면 의도 가시성 손실. 모든 슬라이스에 명시 권장.
- **위상 vs 시그너처 불일치** — `topology: bff` 인데 `presentation/bff/*` 부재 → `topology-shape-mismatch` ERROR.

## 7. 참조

- `packages/architecture-schematics/src/validator.ts` — `SliceTopology` 정의, `resolveTopology()`, 위상별 룰 분기 (lines 23~309)
- `simulations/enterprise-pm/services/auth-api/src/auth/authenticate/metadata/openmetadata.seed.json` — `command-only` 예시
- `simulations/enterprise-pm/services/auth-api/src/auth/bitmap/metadata/openmetadata.seed.json` — `read-mostly` 예시
- `simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/metadata/openmetadata.seed.json` — `bff` 예시
- `docs/plan/simulations-domain-slice-migration/lessons-learned.md` §3 — B7/B9 위상 도입 commits (`60f19529`, `7ed87cc9`, `68c93f12`)
