---
def:
  id: query-rule-migration-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: query-service
  links:
    - target: query-rule-migration
      type: refines
---

# 규칙 버전 마이그레이션 테스트 명세

## 목적 ^purpose

`RuleMigrationService`의 규칙 변환 로직과 `POST /rules/migrate` 엔드포인트를 검증한다.

소스: `packages/query-service/src/lib/rule-migration-service.test.ts`

## 전제 ^preconditions

- InMemoryPolicyRuleStore — 테스트용 인메모리 규칙 저장소
- MetaRegistry mock 3종:
  - **APPEND_ONLY_INPUT** — role dim에 entry 추가 (rv1→rv2: guest 추가), action/resource 불변. 3-dim index `perm`
  - **SWAP_INPUT** — role dim에 migration edge (indexMap: editor↔viewer swap). 2-dim index `perm`
  - **SHRINK_INPUT** — role dim에서 viewer 제거 (sv1→sv2). 2-dim index `perm`
- 고정 시각: AT=2026-01-01T00:00:00.000Z, LATER=2026-01-01T00:10:00.000Z

## 단위 테스트: RuleMigrationService ^steps

### 기본 마이그레이션

| # | 시나리오 | 입력 | 기대 결과 |
|---|----------|------|----------|
| 1 | append-only version 변경 시 position 보존 | admin(1), editor(2) 규칙 + v1→v2 | migrated=2, skipped=[], pattern 동일 유지, versionId=v2 |
| 2 | migration edge(swap)에서 position 변환 | editor(2), viewer(3) + v1→v2 | editor: 2→3, viewer: 3→2 |
| 3 | 와일드카드 패턴 변환 없이 유지 | pattern=[null, null, null] + v1→v2 | migrated=1, pattern 동일, versionId=v2 |
| 4 | range constraint 변환 | pattern=["1-2", null, null] + v1→v2 | append-only이므로 position 보존 |

### 스킵 처리

| # | 시나리오 | 입력 | 기대 결과 |
|---|----------|------|----------|
| 5 | entity가 target version에 없는 규칙 | admin(변환 가능) + viewer(제거됨) | migrated=1, skipped=["rule-viewer"] |
| 6 | skipped 규칙 원본 유지 | viewer 규칙 skip 후 조회 | versionId=v1, pattern 원본 유지 |

### 타임스탬프

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 7 | 마이그레이션 후 타임스탬프 | createdAt 불변, updatedAt만 LATER로 갱신 |

### 에러 케이스

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 8 | fromVersion === toVersion | INVALID_INPUT (400) |
| 9 | 존재하지 않는 index | NOT_FOUND (404) |
| 10 | 존재하지 않는 fromVersion | NOT_FOUND (404) |
| 11 | 존재하지 않는 toVersion | NOT_FOUND (404) |

### 빈 규칙셋

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 12 | 해당 version에 규칙 없음 | migrated=0, skipped=[], rules=[] |

## 통합 테스트: POST /rules/migrate

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 13 | 규칙 마이그레이션 성공 | 200 + migrated=1, skipped=[], rules.length=1 |
| 14 | fromVersion === toVersion | 400 + error.code=INVALID_INPUT |
| 15 | 존재하지 않는 index | 404 + error.code=NOT_FOUND |
| 16 | 잘못된 payload (빈 indexId) | 400 |

### API 후속 검증

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 17 | 마이그레이션 후 v1 조회 | 빈 배열 (규칙이 v2로 이동) |
| 18 | 마이그레이션 후 v2 조회 | 규칙 1건, versionId=v2 |

## 검증 ^assertions

- append-only: position 값이 변환 전후 동일
- swap: migration edge에 따라 position이 정확히 교차
- shrink: 변환 불가 규칙이 skipped 배열에 포함되고, 원본은 store에 불변 (2-pass 사전 변환으로 store 오염 방지)
- 에러: code + statusCode 조합으로 에러 유형 식별
- 타임스탬프: createdAt 불변, updatedAt만 갱신
- API: HTTP status + JSON body 구조 검증, 마이그레이션 후 version별 조회 정합성
