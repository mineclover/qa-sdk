# TODO: Facet-Port PRD 리뷰 보정

> 생성: 2026-04-02
> 대상: `tasks/prd-facet-port-model.md`, `docs/specs/meta-semantic/pipe-impl/pipe-flow-catalog.spec.md`
> 성격: PRD/스펙 문서 보정 (코드 변경 없음)

---

## 1. US-003 — `resolvePorts` AC 문구 보정

**문제:** PRD AC에 "명시 ports **∪** inferred ports 병합"이라 적혀 있으나, 구현과 테스트는 "명시 ports 우선, 없으면 dataContract에서 도출" (either/or).

**파일:** `tasks/prd-facet-port-model.md:99`

- [x] 현재: `resolvePorts(pipe: PipeSpec): PipePort[]` — 명시 ports ∪ inferred ports 병합
- [x] 변경: `resolvePorts(pipe: PipeSpec): PipePort[]` — 명시 ports 우선, 없으면 dataContract에서 도출

---

## 2. US-009 — `transition-scope` fold topology 테이블 누락

**문제:** `PipeFlow` union은 30종(`transition-scope` 포함)인데, PRD와 spec 테이블은 29종으로 기술. `pf-transition-scope.spec.md`에는 `transactional` 할당이 있으나 요약 테이블에서 빠짐.

### 2-a. PRD 보정

**파일:** `tasks/prd-facet-port-model.md`

- [x] L188: "29종 flow kind" → "30종 flow kind"
- [x] L192: "(14종, 29 flow kind 전수)" → "(14종, 30 flow kind 전수)"
- [x] L199: `transactional(2): compensate, finally` → `transactional(3): compensate, finally, transition-scope`

### 2-b. spec 테이블 보정

**파일:** `docs/specs/meta-semantic/pipe-impl/pipe-flow-catalog.spec.md`

- [x] L94: `transactional | compensate, finally |` → `transactional | compensate, finally, transition-scope |`
- [x] L103: "29개 flow kind" → "30개 flow kind"

---

## 3. US-004 — `classifyPipeRole` AC를 실제 구현에 맞게 보정

**문제:** PRD AC는 port-only 판정을 기술하지만, 실제 구현은 port shape 우선 + legacy `produces`/`emit` fallback 구조.

**파일:** `tasks/prd-facet-port-model.md:111-117`

- [x] 판정 로직 기술을 실제 구현 순서로 보정:
  1. `resolvePorts(pipe)` 호출
  2. input ports + output ports 모두 있음 → transformer
  3. output ports만 있음 → producer
  4. tap flow 포함 + legacy produces 없음 + emit 없음 → observer
  5. branch flow 포함 + ports 없음 → router
  6. legacy produces 있음 → transformer
  7. emit 있음 → producer
  8. fallback → consumer
- [x] TODO 추가: ports 명시된 pipe에서는 port-only 판정 우선, legacy fallback은 단계적 deprecation 예정
