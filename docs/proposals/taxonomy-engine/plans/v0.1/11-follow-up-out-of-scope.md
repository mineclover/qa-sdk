# Taxonomy Engine v0.1 — 후속 (Out of Scope — Open Issues)

## 목적 ^purpose

v0.1에서 제외한 후속 범위 원문을 보존한다.

## 후속 (Out of Scope — Open Issues)

이 plan은 spec §9의 Open Issues 중 핵심 라이브러리 + 도그푸딩까지 다룬다 (T-0~T-9). **T-10 CLI 통합은 후속 별도 PR로 분리** (사유: `taxonomy-engine`이 main에 머지되기 전 worktree에서 CLI가 같은 패키지를 의존하면 pnpm workspace symlink가 main의 stub을 우선시하는 문제). 후속 별도 plan:

- **T-10 재개 — CLI `tax validate` 통합** (`packages/cli`에 taxonomy.ts + command-groups + index.ts wiring). taxonomy-engine이 main에 머지된 후 별도 branch에서 진행. 코드 자체는 본 plan §Task 10 그대로 사용 가능.
- **Web UI** — 시각화/탐색 (라이브러리 + 진단 형식 공유)
- **lesson-builder 적용** — Layer 6단을 텍소노미로 표현, mono-story 런타임 연결
- **DKG 표현 PoC** — 15노드/18엣지를 텍소노미로 표현 가능한지
- **frontmatter 승격** — `docs/proposals/taxonomy-engine/` → `docs/specs/taxonomy-engine/` 이동 + def-catalog frontmatter 부여
- **Taxonomy registry 영속화** — 메모리 → 파일 / 서비스화
- **CLI 추가 명령** — §6.3 승격 기준 만족 시 (`show`, `codegen`, `diff` 등)
