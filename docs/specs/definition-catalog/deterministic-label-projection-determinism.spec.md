---
def:
  id: deterministic-label-projection-determinism
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [contract, structural, testing]
  links:
    - target: deterministic-label-stability-plan
      type: refines
    - target: deterministic-label-stability-boundary
      type: traces_to
    - target: deterministic-label-coordinate-stability
      type: depends_on
    - target: deterministic-label-registry-extraction-plan
      type: depends_on
sources:
  - packages/deterministic-label-registry/src/records.ts
  - packages/deterministic-label-registry/src/inventory.ts
  - packages/cli/src/lib/deterministic-label-inventory-determinism-live.test.ts
  - packages/cli/scripts/run-vitest.mjs
---

# Deterministic Label — 투영 결정론 계약

## 목적 ^purpose

`deterministic-label-registry`의 투영 결과(candidates, records, inventory)가 **같은 입력 → byte-identical 출력**임을 계약으로 고정한다. 거부 대상 non-determinism 소스를 명시하고 live 재실행 단언으로 증명한다. 2026-04-18 단순화에서 FSM readiness와 transition dry-run은 제거됨 — 상세는 `deterministic-label-stability-boundary.memo.md`.

## 구성 ^overview

입력 계약 (source state만 의존) + 출력 계약 (정렬/정규화 규칙) + 거부 대상 non-determinism + snapshot scope + 증명 방법.

## 1. 입력 계약

### 허용되는 입력 소스

투영 함수의 출력은 **다음 세 가지의 순수 함수**다:

1. `DocumentEnvelope[]` 입력 리스트 (필드 값과 순서)
2. `options`로 전달된 설정 (`completedRecords`, `packValidateResults`, `includeArchive`, `includeTransient`, `exactTarget` 등)
3. `buildDeterministicLabelInventory`에 주입된 외부 함수 (`adapters[]`, `readDocsFamily`) — 이들이 반환하는 envelope/pack validation도 위 1-2에 포함

### 거부되는 입력 (non-determinism 소스)

다음에 **의존해서는 안 된다**:

- **환경변수**: 투영 코드는 `process.env` 직접 접근 금지. env 읽기가 필요하면 caller가 주입하는 options으로 받는다
- **현재 시각 / timezone**: `Date.now()`, `new Date()` 금지 (이벤트 `committedAt` 같은 controller 소유 필드는 dry-run 결과에 포함되지 않음 — projection 소유 아님)
- **locale**: 정렬 `localeCompare` 사용은 현재 허용하나(아래 §2의 예외), 지역화된 대소 구분 규칙에 의존하는 비교 금지
- **랜덤**: `Math.random()`, `crypto.randomUUID()` 금지
- **git state**: untracked/modified 파일 유무, current branch, 커밋 해시 독립
- **파일시스템 접근 순서**: `readdir` 순서는 OS 의존이므로 adapter가 정렬 보장 (adapter 계약)
- **실행 순서**: 같은 입력 세트를 여러 번 호출 → byte-identical 결과

## 2. 출력 계약

### 전체 records 정렬

`compareDeterministicLabelRecords(a, b)`:

```
1. a.label.localeCompare(b.label)
2. a.kind.localeCompare(b.kind)
3. firstPhysicalRef(a).localeCompare(firstPhysicalRef(b))
```

`localeCompare`는 **JS 기본 locale**로 고정. 소비자가 다른 locale로 실행해도 결과 동일해야 하므로 tester는 process locale을 명시적으로 설정하거나, v2에서 byte-wise 비교로 전환을 검토한다.

### 개별 필드 정렬

- `dependencyLabels`, `sourceRefs`, `evidenceRefs` — `normalizeRecordRefs`로 중복 제거 + `localeCompare` 정렬
- `physicalRefs` — 입력 순서 보존 (role 기반 의미가 순서에 있음)
- `diagnostics` — 생성 순서 보존 (소스별로 deterministic하게 push됨)

### tie-breaker 완결성

정렬 키가 모두 같은 두 record는 중복이다 (coordinate/physical ref가 동일). collision diagnostic 발행 후 **제거 없이 유지**하므로 정렬 결과에 tie가 남을 수 있다. 이 경우 입력 순서를 최종 tie-breaker로 사용한다 (`toSorted`는 stable).

## 3. 증명 대상

Live 재실행 byte-identical 대상 데이터:

- `DeterministicLabelRecord[]` 전체 (label, kind, physicalRefs, dependencyLabels, sourceRefs, evidenceRefs, candidate, metadata)
- `DeterministicLabelInventory` 전체 (records + candidates + diagnostics + skippedDocuments + completedRecords + summary)

### 제외되는 필드

- `DocumentEnvelope.diagnostics[].rawSource.path` 절대 경로 부분 — 상대 경로로 정규화 필요
- 실행 시각 관련 모든 필드 (애초에 projection에 없어야 함)

## 4. Normalization 규칙

### Path 정규화

```
normalizeCoordinatePart(value) = value.trim().replaceAll("\\", "/").replace(/\/+/g, "/")
```

Windows/Unix 경로 차이 흡수. `/repo/abs/path`가 입력에 들어오면 caller가 rootDir 기준 상대 경로로 먼저 변환해야 함 (adapter 책임).

### Metadata 정규화

`normalizeMetadata` — `undefined` 값 제거 + spread copy. 순서는 입력 순서 보존 (JSON.stringify 기준 byte 동등을 해치지 않음).

### Record key

```
documentKey(document) = [
  document.adapterId,
  document.stableId,
  normalizeCoordinatePart(document.path) ?? document.path,
].join("\u001f")
```

U+001F(unit separator)를 구분자로 사용해 필드 내 충돌 방지.

## 5. Byte-identical 증명 방법

### 동일 입력 재실행

```typescript
const first = await buildDeterministicLabelInventory(options);
const second = await buildDeterministicLabelInventory(options);
expect(JSON.stringify(first, null, 2)).toBe(JSON.stringify(second, null, 2));
```

실제 저장소를 대상으로 한 이 증명은 `packages/cli/src/lib/deterministic-label-inventory-determinism-live.test.ts`
에서 수행하며, 일반 CLI 병렬 회귀와 분리된 stability lane으로 실행한다.

```bash
corepack pnpm --filter @qa-sdk/cli test:slow
```

일반 `test`/`test:parallel`은 이 live 파일을 제외하고 worker 수를 제한한 뒤 나머지 contract 회귀를
수행한다. 따라서 live 증명을 생략하는 것이 아니라, full-repo I/O와 5초 성능 budget을 가진 검증을
전용 lane에서 독립적으로 항상 실행하는 구조다.

### Snapshot 정착

커밋된 snapshot fixture는 사용하지 않는다 (역사 = git SSOT). 대신 **같은 실행 세션 안에서 2회 호출 결과 byte-identical** 을 단언.

### 증명 범위

- `DeterministicLabelInventory` 전체 (records + candidates + diagnostics + summary)
- `projectDeterministicLabelRecordsFromDocuments` 결과

## 6. 거부 대상 non-determinism 점검 목록

본 spec이 선언하는 계약을 위반하는 구현은 **버그**다:

| 위반 패턴 | 감지 방법 |
|----------|----------|
| `process.env.*` 직접 참조 | lint rule + code review |
| `Date.now()` / `new Date()` | 검색 (`Date\\.now\\b`) |
| `Math.random()` | 검색 |
| `crypto.random*` | 검색 |
| 파일시스템 명시 정렬 없음 | adapter 테스트에서 `readdir` mock 순서 변경 시 동일 출력 |
| 절대 경로 유출 | snapshot에서 `/Users/`, `/home/`, `C:\\` 검색 |
| Wall-clock 시간 필드 | snapshot에서 ISO-8601 날짜 패턴 검색 |

## 7. Regression gate (이 spec의 보강)

본 spec 자체는 PRD의 수용 기준이 된다:

1. **P1** — 좌표 edge case 테스트: 한글/유니코드 id, Windows path, version 생략, subtype 추론 경계
2. **P2** — Real-repo exploration: `buildDeterministicLabelInventory`를 실제 `docs/specs/**`, `tasks/**`, `packages/**`에 실행 → 분포 측정
3. **P4** — Byte-identical snapshot: P2 결과를 커밋 후 재실행 시 동일성 단언

이들은 stability PRD의 user story로 분해된다 (본 spec 범위 밖).

## 8. 규칙

### R-1. 새 projection 함수 추가

새 함수가 `DeterministicLabelInventory` 또는 `projectDeterministicLabelRecordsFromDocuments`의 결과 일부를 반환한다면:
- §1 입력 계약 준수
- §2 출력 정렬 규칙 적용
- §6 거부 대상 none 확인

### R-2. Snapshot 업데이트

- 같은 입력 state에서 snapshot이 변하면 **버그** — 조사 후 수정
- 새 입력 문서 추가로 인한 변화 = 정상 — 커밋에 데이터 변경 사유 명시
- 스냅샷 포맷 변경 (키 추가/rename) = **coordinate-stability.spec의 §8 breaking 판정** 참조

### R-3. 외부 주입 함수 계약

`adapters[].listDocuments()`, `readDocsFamily()`는 **caller가 제공**하는 비결정론 경계다. 주입자가 결정론적 함수를 제공할 책임:
- 같은 rootDir에서 같은 호출 → 같은 문서 리스트
- 정렬된 순서 반환 (adapter 내부에서 보장)

cli의 기본 adapter(`createDeterministicLabelInventoryAdapters`)는 이 계약을 구현한다.

### R-4. Diagnostic 결정론

- 같은 입력 → 같은 diagnostic 리스트 (순서/내용)
- diagnostic message에 변화 필드(wall time, random id) 포함 금지
- metadata 순서가 JSON 직렬화 결과에 영향을 주므로 구축 순서 고정

## 구현 참조

- 구현:
  - `packages/deterministic-label-registry/src/records.ts` — `projectDeterministicLabelRecordsFromDocuments()`, `compareDeterministicLabelRecords()`, `documentKey()`
  - `packages/deterministic-label-registry/src/candidates.ts` — `normalizeRecordRefs()`, `normalizeCoordinatePart()`, `normalizeMetadata()`
  - `packages/deterministic-label-registry/src/inventory.ts` — `buildDeterministicLabelInventory()` 조립
- 테스트: `packages/cli/src/lib/deterministic-label-registry.test.ts` — 28 tests
  - collision signature 결정론
  - record 정렬 안정성
  - historical dry-run mutation safety (제거된 FSM 범위의 회귀 기록)

## 비목표

- **좌표 형식 자체** — `deterministic-label-coordinate-stability.spec.md` 담당
- **FSM readiness / transition dry-run** — 2026-04-18 단순화에서 제거됨. `deterministic-label-stability-boundary.memo.md` 참조.
- **실제 snapshot 파일 구조** — stability PRD의 user story에서 확정 (P4 범위)
- **성능 목표** — 본 spec은 정확성만. 성능 상한은 PRD에서 선언
