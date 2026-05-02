# deterministic-label-registry

Repository configuration unit을 **read-only semantic coordinate candidate**로 투영하는 라이브러리. 모든 출력은 source state의 결정론적 함수이며, 영속/쓰기를 수행하지 않는다.

본 패키지는 스펙 2종의 구현체다:
- 좌표 안정성 계약 (coordinate stability) — URN format, subtype 추론, collision 규칙
- 투영 결정론 계약 (projection determinism) — 정렬, diagnostic 순서, non-determinism 거부

※ 두 spec은 `docs/specs/definition-catalog/deterministic-label-*.spec.md`에서 관리. 설계 결정 요약과 거부된 대안은 `deterministic-label-stability-boundary.memo.md` 참조. FSM readiness/transition dry-run은 2026-04-18 단순화에서 제거됨.

## 공개 API

### Semantic coordinate candidate (좌표 후보)

- `buildSemanticCoordinateCandidate(input)` — single candidate 생성 + diagnostic
- `buildSemanticCoordinateCandidatesFromDocument(doc)` — envelope 1개에서 파생 후보 수집
- `collectSemanticCoordinateCandidatesFromDocuments(docs, options?)` — 다수 envelope에서 후보 + 스킵 문서 리포트
- `detectSemanticCoordinateCandidateCollisions(candidates)` — 같은 label이 서로 다른 physical ref에서 나오는 collision 감지 (warning)
- `isSemanticCoordinateLabelKind(value)` — 타입 가드
- `SEMANTIC_COORDINATE_CANONICAL_EXAMPLES` — canonical URN 예시
- `SEMANTIC_COORDINATE_LABEL_KINDS` (8종), `SEMANTIC_COORDINATE_DOMAINS` (5종), `SEMANTIC_PHYSICAL_REF_KINDS` (8종), `SEMANTIC_COORDINATE_DIAGNOSTIC_CODES` (10종)

### Label record (라벨 레코드)

- `buildDeterministicLabelRecord(input)` — candidate를 record로 포장 (상태 없음 — 순수 투영)
- `projectDeterministicLabelRecordsFromDocuments(docs, options?)` — envelope 리스트를 정렬된 record projection으로 투영

### Inventory 조립

- `buildDeterministicLabelInventory(options)` — document + record + summary를 한 번에 조립
- `DeterministicLabelInventoryOptions.adapters` 또는 `.documents`로 envelope 소스 주입 (기본 adapter 자동 생성 없음)
- `DeterministicLabelInventoryOptions.extraRecords`로 caller가 pack/artifact 등에서 조립한 외부 record 주입 (purpose unit isolation)

## 사용 패턴

```typescript
import { buildDeterministicLabelInventory } from "deterministic-label-registry";

// CLI가 adapter와 외부 record를 주입
const inventory = await buildDeterministicLabelInventory({
  rootDir: "/repo",
  adapters: createCliAdapters({ rootDir: "/repo" }),
  extraRecords: externalPackRecords,
});
```

## 비목표

- **쓰기 금지** — registry 영속, transition event 발행, state override 없음
- **persistence 없음** — 실행할 때마다 source에서 재계산
- **adapter 소유 안 함** — envelope 수집 방법은 소비자가 adapter 주입으로 결정
- **FSM/transition 없음** — 2026-04-18 단순화에서 이 패키지 범위의 readiness/transition dry-run을 제거. 전역 FSM 금지가 아니며 재도입은 별도 설계 필요
- **JSON API surface 아님** — 공개 CLI 명령은 `@qa-sdk/cli`가 관리

## 의존

- `doc-envelope` — envelope 타입 + 수집 유틸

※ 이전에는 `ontology-pack-validate`에도 의존했으나 pack projection이 caller 쪽으로 이관됨 (2026-04-18).
