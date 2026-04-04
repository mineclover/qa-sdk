---
def:
  id: query-rule-migration
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: implemented
  layer: mediation
  svc: query-service
  links:
    - target: query-rules
      type: refines
---

# 규칙 버전 마이그레이션 (Rule Version Migration)

## 목적 ^purpose

index version 변경 시 StoredPolicyRule의 pattern을 자동 변환한다. `translateConstraint` 기반으로 이전 버전의 position을 새 버전의 position으로 매핑하며, 변환 불가(entity 미존재)인 규칙은 건너뛰고 보고한다.

## 정의 ^defines

### RuleMigrationService

규칙 마이그레이션의 핵심 서비스 클래스. `PolicyRuleStore`와 `MetaRegistry`를 조합한다.

- **`migrateRules(indexId, fromVersion, toVersion)`** — 특정 index의 모든 규칙을 일괄 변환
- **`patternToConstraintRecord(pattern, dimIds)`** — CoordConstraint 배열을 dim별 Record로 변환 (translateConstraint 입력 형식)
- **`constraintRecordToPattern(record, dimIds)`** — Record를 다시 CoordConstraint 배열로 복원

### RuleMigrationResult

| 필드 | 타입 | 설명 |
|------|------|------|
| `migrated` | `number` | 변환 성공 규칙 수 |
| `skipped` | `string[]` | 변환 실패로 건너뛴 규칙 ID 목록 |
| `rules` | `StoredPolicyRule<unknown>[]` | 변환된 규칙 목록 |

### POST /rules/migrate

규칙 마이그레이션 REST 엔드포인트.

- Body: `{ indexId: string, fromVersion: string, toVersion: string }` (zod 검증)
- 성공: 200 OK + `RuleMigrationResult`
- 에러: 400 (동일 버전, 잘못된 payload), 404 (index/version 미존재)

## 소비 ^consumes

- `packages/query-service/src/lib/rule-migration-service.ts` — 구현 소스
- `packages/index-meta/src/version-query.ts` — `translateConstraint` (position 변환 핵심 함수)
- `packages/query-service/src/stores/policy-rule-store.ts` — `PolicyRuleStore`, `StoredPolicyRule`
- `packages/query-service/src/routes/rules.ts` — REST 라우트 등록

## 변환 흐름 ^overview

```
migrateRules(indexId, fromVersion, toVersion)
  │
  ├─ 검증: fromVersion !== toVersion
  ├─ MetaRegistry에서 index 정의 + 양쪽 version 유효성 확인
  ├─ policyRuleStore.findByIndex(indexId, fromVersion)
  │
  └─ 규칙별 루프:
       ├─ patternToConstraintRecord(pattern, dimIds) → Record<dimId, constraint>
       ├─ translateConstraint(indexId, from, to, record, registry)
       │    ├─ null → skipped (entity가 target version에 없음)
       │    └─ Record → constraintRecordToPattern → newPattern
       ├─ store.update({ ...rule, versionId: toVersion, pattern: newPattern, updatedAt })
       └─ 결과 집계: { migrated, skipped, rules }
```

## 변환 시나리오

| 시나리오 | 설명 | 결과 |
|----------|------|------|
| append-only | 새 entry만 추가, 기존 position 유지 | position 보존 |
| swap (migration edge) | entry 순서 변경, indexMap 제공 | position 재매핑 |
| shrink | target version에서 entry 제거 | 해당 규칙 skipped |
| wildcard | 모든 dim이 null | 변환 없이 유지 (version만 갱신) |
| range constraint | "1-2" 같은 범위 패턴 | translateConstraint가 범위 단위로 변환 |

## 에러 처리

| 조건 | 에러 코드 | HTTP |
|------|----------|------|
| `fromVersion === toVersion` | INVALID_INPUT | 400 |
| index 미존재 | NOT_FOUND | 404 |
| fromVersion 미존재 | NOT_FOUND | 404 |
| toVersion 미존재 | NOT_FOUND | 404 |
| store.update 실패 | 예외 전파 | 500 |

## 타임스탬프 규칙

- `createdAt`은 변경하지 않는다 (원본 생성 시각 보존)
- `updatedAt`만 마이그레이션 실행 시점으로 갱신한다
- skipped 규칙은 store에서 변경하지 않는다 (원본 유지)
