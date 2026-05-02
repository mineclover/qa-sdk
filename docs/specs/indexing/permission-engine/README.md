# permission-engine 패키지 스펙

> `weighted-index` 위에 구축된 비트마스크 권한 엔진.
> 내부 닫힌 차원은 `PermissionSet`으로 압축하고, 상속/예외 정책은 `TernaryMask`, 외부 컨텍스트 분리는 `ScopedEngine`으로 다룬다.

패키지: `permission-engine`
의존: `weighted-index`
운영 흐름: `[S2]` 권한 해소/검사 — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)

## 상태

implemented

## 문서 구조

| 문서 | 관심사 | 상태 |
|---|---|---|
| [core.spec.md](core.spec.md) | `PermissionSet`, `TernaryMask`, `ScopedEngine` — binary/ternary mask, 계층 상속, scope 라우팅 | implemented |
| [codec.spec.md](codec.spec.md) | `PermissionCodec` — 3-tier protocol stack, Tier 1↔2↔3 변환, PrefixCodec/index-meta 호환성 | implemented |
| [resource.spec.md](resource.spec.md) | `resource`, `service-ref`, `permission-code` — canonical resource 규칙, service identity/context, permission address text contract | implemented |
| [migration.spec.md](migration.spec.md) | `migration.ts` — shape 변경 시 grant 재배치, ID 매칭 자동 변환, `CoordMapper` 커스텀 변환 | implemented |

## 레이어 구조

```
┌──────────────────────────────────────────────────────────────┐
│  외부 식별자 레이어                                           │
│  service-ref.ts · resource.ts · permission-code.ts          │
├──────────────────────────────────────────────────────────────┤
│  주소 코덱 레이어                                             │
│  permission-codec.ts  (text ↔ integer ↔ bitmask 연결)        │
├──────────────────────────────────────────────────────────────┤
│  코어 권한 레이어                                             │
│  permission-set.ts   [feature, role] binary mask            │
│  ternary-mask.ts     3-state authoring + inherit            │
│  scoped-engine.ts    env/region/device scope router         │
├──────────────────────────────────────────────────────────────┤
│  변경 적응 레이어                                             │
│  migration.ts        shape 변경 시 grant 재배치              │
└──────────────────────────────────────────────────────────────┘
```

## 모듈 의존 관계

```
weighted-index
├── permission-set.ts
├── ternary-mask.ts
│
├── permission-codec.ts ──→ permission-code.ts ──→ resource.ts
│                           └────────────────────→ service-ref.ts
│
├── scoped-engine.ts ─────→ permission-set.ts
└── migration.ts ─────────→ permission-set.ts

index.ts
├── core: PermissionSet / TernaryMask / ScopedEngine
├── codec: PermissionCodec
├── resource identity: resource / service-ref / permission-code
├── migration: migratePermissions
└── weighted-index re-export: createBinder / PartialBinder
```

## 현재 스펙 범위

- `core.spec.md`는 core layer (`PermissionSet`, `TernaryMask`, `ScopedEngine`)를 다룬다.
- `codec.spec.md`는 address codec layer (`PermissionCodec`)와 3-tier 프로토콜, `PrefixCodec`/`MetaCodec` 호환성을 다룬다.
- `resource.spec.md`는 external identity layer (`resource.ts`, `service-ref.ts`, `permission-code.ts`)와 canonical text contract를 다룬다.
- `migration.spec.md`는 migration layer (`migration.ts`)의 ID 매칭 자동 변환과 `CoordMapper` 기반 커스텀 재배치를 다룬다.
- `composite-address.ts`는 현재 public source/export가 없고, 관련 내용은 `composite-address.test.ts` 탐색 테스트로만 남아 있다.

## 횡단 문서

| 문서 | 설명 |
|---|---|
| [../README.md](../README.md) | 인덱싱 전체 개념 맵 |
| [../foundation.md](../foundation.md) | 닫힌 주소 공간과 전단사 원리 |
| [../patterns.md](../patterns.md) | 인덱싱 시스템 사용 패턴 |
| [../../indexing-core-system/conventions-system.md](../../indexing-core-system/conventions-system.md) | 프로젝트 관례 |
| [../../operations/runtime-flows.spec.md](../../operations/runtime-flows.spec.md) | `[S2]` 등 런타임 흐름 심볼 체계 |
