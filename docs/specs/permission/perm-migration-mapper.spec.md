---
def:
  id: perm-migration-mapper
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [migration, tier-backend]
  links:
    - target: perm-migration-algorithm
      type: depends_on
    - target: perm-migration-spec
      type: refines
---

# Permission Migration 매퍼 규칙

## 목적 ^purpose

`CoordMapper`의 커스텀 보정 규칙과 한계를 분리해, rename/split/merge 같은 비호환 PermissionSet 변경을 호출자가 안전하게 보정하는 범위를 정의한다.

## 구성 ^overview

- **CoordMapper 계약**: old shape 1-based 좌표를 입력받아 new shape 좌표 또는 null(삭제)을 반환하는 함수 타입
- **실행 규칙**: source bit가 1인 slot만 mapper에 전달, null이면 삭제, 좌표 반환 시 target.grant() 호출
- **지원 패턴**: one-to-one(rename 포함), many-to-one, drop 가능 — one-to-many는 불가 (후처리 필요)
- **composite 경계**: migration API는 [feature, role] 2D grant 재배치에 한정, composite-address는 비공개 맥락

## 1. CoordMapper 계약

```ts
type CoordMapper = (
  oldFeatureIdx: number,
  oldRoleIdx: number,
) => [newFeatureIdx: number, newRoleIdx: number] | null;
```

- 입력은 old shape 기준 1-based 좌표다.
- 반환이 좌표면 새 shape 기준 1-based target slot에 grant를 쓴다.
- 반환이 `null`이면 해당 old grant를 삭제한다.
- `mapper`를 제공하면 자동 ID 매칭은 섞이지 않고, 전체 보존/삭제 정책이 호출자 책임이 된다.

## 2. 실행 규칙

1. 구현은 old shape 전체를 순회한다.
2. source bit가 0인 slot은 mapper를 호출하지 않고 건너뛴다.
3. source bit가 1인 slot만 `mapper(oldFeatureIdx, oldRoleIdx)`에 전달한다.
4. `null`이면 아무 것도 쓰지 않는다.
5. 좌표를 반환하면 새 shape의 ID를 읽어 `target.grant()`한다.

권장 절차:

1. old 1-based index를 old ID로 복원한다.
2. rename/split/merge 정책을 old ID 기준으로 적용한다.
3. new ID를 새 shape 배열에서 찾아 1-based index로 변환한다.
4. 대응 target이 없으면 `null`을 반환한다.

## 3. 표현 가능한 변화와 한계

| 패턴 | 지원 여부 | 비고 |
|---|---|---|
| one-to-one | 가능 | rename 포함 |
| many-to-one | 가능 | 여러 old grant가 같은 new slot로 수렴 가능 |
| drop | 가능 | `null` 반환 |
| one-to-many | 불가 | 단일 반환값만 허용 |

- 하나의 old grant를 여러 new grant로 복제해야 하면 migration 후 후처리 grant가 필요하다.
- 반환 좌표는 새 shape의 유효한 1-based 범위여야 한다.
- 잘못된 좌표를 반환하면 이후 ID 조회나 `grant()`에서 런타임 오류가 난다.

## 4. composite address와의 경계

현재 public source 기준으로 `permission-engine`에는 `composite-address.ts`가 없다.

- migration layer의 공식 contract는 `[feature, role]` 2D grant 재배치에 한정된다.
- `composite-address.test.ts`는 더 넓은 인덱싱 시스템에서 permission address를 다른 차원 그룹과 합성하는 설계 참고 자료다.
- 따라서 composite address는 public migration API가 아니라, weighted-index 부분 바인딩 원리를 검증하는 비공개 맥락으로 취급해야 한다.
