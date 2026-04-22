---
def:
  id: coordinate-storage-pr-checklist
  type: spec
  tier: component
  scope: meta
  aspect: proposal_design
  depth: validation
  lifecycle: approved
  layer: mediation
  tags: [pr-checklist, governance, storage, weighted-index]
  links:
    - target: coordinate-storage
      type: implements
---

# 좌표 저장 PR 체크리스트

## 목적 ^purpose

새 테이블이 좌표(`weighted-index` encode 결과) 또는 좌표 컨텍스트(JSON)를 저장한다면 본 체크리스트를 만족해야 한다. `coordinate-storage.rule §5.1` 자동 검출 보완용 작성자 가이드.

---

## 신규 테이블 추가 시

- [ ] `prefix_id` + `version` + `address`(또는 `packed_key`) 컬럼이 모두 있는가
- [ ] PK 또는 UNIQUE 제약이 위 3 컬럼 조합인가 (또는 집계 테이블이면 `(prefix_id, version)` 조합)
- [ ] `def validate` 통과 — `coordinate-storage-violation` 0건
- [ ] 좌표 쓰기·읽기 코드가 `(prefix_id, version)`을 항상 명시하는가 (§2.2 격리)
- [ ] 새 prefix면 prefix_ref 등록 + `latestPrefixVersion()` 동적 조회 사용

## 좌표 저장이 아닌데 검사기에 걸린 경우

- [ ] 테이블 선언 직전 `// @def.coord-storage-exempt: <명확한 사유>` 1줄 추가
- [ ] 사유에 후속 이행 plan/backlog 문서 ID 명시 (예: `Plan 07b backlog 참조`)
- [ ] exempt는 일시적 — backlog 항목으로 등록되어 있는지 확인

## JSON 저장 (address_context 등)

- [ ] JSON 안에 `version` 필드 포함 (`AddressContextV1` zod 스키마 사용 권장)
- [ ] 쓰기 경로에서 `AddressContextV1Schema.parse()`로 검증
- [ ] `def validate` 자동 검출은 INTEGER address만 대상 — JSON 경로는 본 체크리스트 수동 확인

## 마이그레이션

- [ ] shape 변경 시 새 version 발급 (기존 address 재해석 금지)
- [ ] 이행 기간 동안 양 version 병행. 이행 완료 후 구 version 아카이브
- [ ] 마이그레이션 도구 또는 plan 문서 작성

---

## 근거

- `docs/specs/system/coordinate-storage.rule.md` — 규칙 본문
- `docs/proposals/ingest-coordinate-storage-audit/README.md` — 이행 사례
- `docs/proposals/auth-model-implementation-backlog/plans/03-coordinate-storage-validation.md` — 자동 검출 도입 plan

## CI 동작

`.github/workflows/def-gate.yml`이 `def validate`를 호출하므로 본 규칙 위반은 PR CI에서 자동 실패한다. 우회는 `--no-code-checks=true` (권장하지 않음, 임시 진단용).
