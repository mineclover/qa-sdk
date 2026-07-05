---
def:
  id: taxonomy-engine-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: overview
  sources:
    - packages/taxonomy-engine/src/index.ts
    - packages/taxonomy-engine/package.json
    - packages/taxonomy-engine/__tests__/unit/public-api.test.ts
    - packages/taxonomy-engine/__tests__/dogfooding.test.ts
    - packages/cli/src/commands/taxonomy/index.ts
    - packages/cli/src/commands/taxonomy/shared.ts
    - packages/cli/src/commands/taxonomy.test.ts
    - package.json
status: implemented
date: 2026-05-20
part_of: taxonomy-engine
role: overview
supersedes: -
superseded_by: -
---

# Taxonomy Engine — 설계 개요

## 목적 ^purpose

임의의 텍소노미(좌표 체계, 계층 구조, 분류 도식)를 **선언적으로 표현·탐색·분석·시각화·편집**할 수 있는 메타 시스템.

OpenAPI가 HTTP API에 대해 했던 것을 텍소노미에 대해 한다 — YAML SSOT + 도구 생태계.

해결 대상:
1. 텍소노미의 **상위/하위 구조 정의**를 코드/문서 곳곳에 흩어두지 않고 한 곳에 선언.
2. 상위→하위로의 **데이터 흐름** (예: lesson-builder의 Clip → Asset.controlParams)을 1급 시민으로 표현.
3. **인덱싱 전략** (좌표 주소화, capacity, version) 일관 적용.
4. **다양한 텍소노미의 동시 관리** (qa-sdk 좌표계, lesson-builder, DKG 등을 같은 도구로).

## 핵심 원칙 ^defines

1. **좌표계 1급** — Axis + Entry + Coordinate가 추상 모델의 기본. 계층/관계는 좌표 간 Relation으로 표현 (직교성 유지, qa-sdk 좌표계 컨벤션 계승).
2. **YAML SSOT + TS codegen** — yaml이 유일 입력. TS 타입/registry는 결정론적 codegen (qa-sdk 코드젠 패턴과 정합).
3. **address 불변 / id 가변** — qa-sdk의 (정수 address 불변 / kebab-case id 변경 가능) 패턴 그대로. ref 시스템 안정성의 근거.
4. **순수 라이브러리 + thin CLI** — taxonomy-engine은 파일 I/O/SQLite/fetch 없음. CLI 책임.
5. **fail-fast on validate, fail-open on query** — 검증 단계 errors=0 강제, 조회는 unknown coordinate에 undefined 반환.

## 결정 사항 (브레인스토밍 결과)

| 항목 | 결정 | 근거 |
|------|------|------|
| Scope | 메타 시스템 우선, lesson-builder는 후속 사례 | 사용자 메시지: 일반 도구가 가치의 본질 |
| Position | qa-sdk 내 신규 패키지, def-catalog와 동계 | def-catalog는 "메타데이터/lifecycle", 텍소노미는 "구조 자체" → 관심사 분리 |
| Spec format | YAML SSOT + TS 코드제너레이터 | 외부 도구 생태계 + 타입 안전 동시 확보 |
| Abstract model | 좌표계 (Axis + Dimension) | qa-sdk 좌표계 메모리/컨벤션과 강한 정합 |
| MVP scope | 라이브러리 코어 + CLI (탐색/분석) | Web은 후속 spec. 검증 가능한 단위. |
| Reference case | qa-sdk 좌표계 (도그푸딩) | 가장 친숙, def-catalog와 즉시 비교 검증 |
| 패키지 구조 | 단일 라이브러리 + `@qa-sdk/cli` 명령 확장 | qa-sdk cli 컨벤션 정합 (`commands/<topic>.ts`) |

## 분해 파일

이 overview에서 섹션별로 분리한 상세 문서:

| 파일 | 내용 | 원 섹션 |
|------|------|--------|
| [architecture.md](./architecture.md) | 패키지 구조 + 책임 경계 + 의존 방향 | §3 |
| [data-model.md](./data-model.md) | yaml 구조 + IR 타입 + 1급 개념 | §4 |
| [reference-grammar.md](./reference-grammar.md) | 3-tier ref + 7 참조 단위 + cross-tax | §5 |
| [api-surface.md](./api-surface.md) | 라이브러리 API + CLI 명령 목록 | §6 |
| [diagnostics.md](./diagnostics.md) | 에러 처리 정책 + fail 정책 + 위치 정보 | §7 |
| [testing.md](./testing.md) | 테스트 전략, 4계층, round-trip, CI | §8 |

## 구현 상태 ^implementation-status

core library와 thin CLI 표면은 `packages/taxonomy-engine` 및 `@qa-sdk/cli tax` 명령으로 구현되어 있다. Web UI와 registry 서비스화 같은 확장은 별도 proposal/plan에서 추적하며, 이 문서의 구현 증거는 YAML SSOT → parse/validate/query/codegen/doctor/diff/migration → CLI wrapper 경계까지만 닫는다.

## 미결 사항 (Open Issues)

- [ ] lesson-builder를 후속 사례로 적용하는 시점/spec (별도 proposal)
- [ ] Web UI spec (별도 proposal — 라이브러리 + 진단 형식 공유). v0.5 brainstorming 참조: [plans/v0.5.md](./plans/v0.5.md)
- [ ] Taxonomy registry 영속/검색 (메모리 registry로 시작, 서비스화는 별도 결정)
- [ ] DKG 연관 — 15노드/18엣지를 taxonomy로 표현 가능한지 PoC (v0.4에서 부분 진행)
- [ ] docs/specs 승격 여부 — proposal frontmatter는 부여됐고, 정식 spec 위치로의 이동은 별도 결정

## 완료된 정리

- v0.7 문서 분해: `architecture.md`/`data-model.md`/`reference-grammar.md`/`api-surface.md`/`diagnostics.md`/`testing.md` 분해 완료
- v0.7 코드 분해: CLI taxonomy command modules, query submodules, doctor extract submodules, schema barrel, drift module 분리 완료

## 참고

- `docs/specs/definition-catalog/definition-catalog.spec.md` — def-catalog (자매 시스템)
- `docs/definition-system-philosophy.md` — 좌표 기반 문서화 원리
- `packages/cli/src/commands/def.ts` — qa-sdk CLI 컨벤션 참고
- `/Users/junwoobang/workflow/pipe-builder/packages/mono-story/packages/lesson-builder/TAXONOMY.md` — 후속 사례 후보 (lesson-builder 6-layer)
- [concepts/README.md](./concepts/README.md) — 1급 개념 인덱스
- [plans/](./plans/README.md) — v0.1~v0.14 구현 계획

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine test
pnpm --filter @qa-sdk/cli test taxonomy.test
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
