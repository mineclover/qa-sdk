---
def:
  id: spec-code-reference-rollout
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: archived
  layer: mediation
  svc: definition-catalog
  tags: [rollout, contract, observability]
  links:
    - target: definition-catalog-spec
      type: traces_to
    - target: definition-extraction
      type: depends_on
---

# Spec ↔ 코드 참조 연결 — 점진 전개 계획

## 목적 ^purpose

문서와 코드의 양방향 탐색(`def find-by-file <path>` / frontmatter `source:`)을 repo 전체로 확산한다. 2026-04-19 현재 test.md는 100% 연결되었으나 spec.md는 43/784만 연결되어 있다. 단방향 `source:` 필드로는 **한 spec ↔ 여러 코드 파일** 관계를 표현 못 하므로, 코드 측 `@def.doc` 주석 기반 code_references를 주 전파 메커니즘으로 전환한다.

## 현재 상태 ^overview

| 항목 | 커버리지 | 비고 |
|------|---------|------|
| test.md `source:` | **25/25 (100%)** | 2026-04-19 완료 |
| spec.md `source:` | **43/784 (5.5%)** | 1:1 매핑만 자동 적용 가능 |
| svc 등록된 패키지 | **95/96** | drizzle 제외 |
| Orphan module 문서 | **0** | 16 contains 링크 추가 완료 |
| 신규 module 문서 | **21건** | packages/ 각각에 대응 |

나머지 741개 spec.md 중 상당수는 개념/계약/정책 문서 (`ontology`, `taxonomy`, `readiness-contract`, `*-convention`)로 단일 `.ts` 파일에 귀속되지 않는다. 따라서 단방향 `source:` 확산은 비효율적이고, 코드 주석 기반 다대다 매핑이 본질에 맞다.

## 목표 경계

본 plan은 다음을 수행한다:
- 핵심 3개 패키지 pilot에 `@def.doc` / `@def.boundary` 주석 주입
- `def sync`가 code_references 테이블을 갱신하는지 검증
- `def find-by-file <path>` 조회 동작 확인
- 주석 문법과 적용 기준 문서화

본 plan은 다음을 수행하지 않는다:
- 전 패키지 일괄 주석 주입 (pilot 검증 후 별도 PRD로 확산)
- spec.md 본문 rewrite (주석은 코드 측에만 부착)
- `source:` 필드의 일괄 제거 (공존 허용)

## 주석 문법 ^method

CLAUDE.md의 Definition 시스템 절에 명시된 2종 주석을 사용한다:

```typescript
// @def.boundary <group-or-module-doc-id>[#symbol]
// @def.doc <module-or-leaf-doc-id>[#symbol]
```

- **`@def.boundary`**: 파일 전체가 특정 group/module 경계 내부임을 선언 (보통 파일 상단)
- **`@def.doc`**: 특정 spec/leaf 문서의 구현임을 선언 (symbol 단위 가능)
- **`#symbol`** (선택): export 심볼 명. 동일 파일에 여러 spec 대응 시 사용

예시:

```typescript
// @def.boundary deterministic-label-architecture
// @def.doc doc-envelope
export type DocumentEnvelope = { ... };

// @def.doc doc-envelope#normalizeDocumentEnvelope
export function normalizeDocumentEnvelope(input) { ... }
```

## Pilot 범위

다음 3개 패키지에만 우선 적용한다. Pilot 선정 기준: svc 등록됨 + 신규 spec 문서 보유 + 경계 테스트 존재.

| 패키지 | 대응 주요 spec | source 파일 |
|--------|---------------|------------|
| `doc-envelope` | `doc-envelope` | `packages/doc-envelope/src/index.ts` |
| `ralph-tui-integration` | `ralph-tui-integration` | `packages/ralph-tui-integration/src/index.ts`, `ralph-session.ts`, `ralph-prd-json.ts`, `completed-ralph-prd.ts` |
| `deterministic-label-registry` | `deterministic-label-architecture`, `deterministic-label-coordinate-stability`, `deterministic-label-projection-determinism` | `packages/deterministic-label-registry/src/*.ts` (6 파일: coordinate/projection/collision/records/inventory/shared) |

## 절차

### 1. 주석 주입

각 pilot 패키지의 public entry(`src/index.ts`)와 주요 모듈 파일에 `@def.boundary` / `@def.doc` 주석 부착.

- `src/index.ts`: `@def.boundary <최상위 architecture doc id>` 1줄
- 각 모듈 파일: `@def.doc <대응 spec id>` 1줄 (파일 상단)
- 공개 함수/타입: 필요 시 `@def.doc <id>#<symbol>` 추가

### 2. DB 동기화 + 검증

```bash
qa-sdk def sync                                    # code_references 갱신
qa-sdk def find-by-file packages/doc-envelope/src/index.ts
qa-sdk def find-by-file packages/deterministic-label-registry/src/coordinate.ts
qa-sdk def validate                                # 깨진 링크 0 확인
```

기대: `def find-by-file`이 해당 파일이 속한 spec 문서 목록을 반환한다.

### 3. 역방향 조회 검증

```bash
qa-sdk def boundary-context deterministic-label-architecture --mode direct
qa-sdk def boundary-context doc-envelope --mode direct
```

기대: boundary-context 결과에 주입한 코드 파일 경로가 `code_references` 섹션으로 표시된다.

### 4. 회귀 방지 테스트

`packages/cli/src/lib/deterministic-label-boundary.test.ts`와 동일한 패턴으로 코드 주석→spec 매핑이 유지되는지 확인하는 테스트 고려. 구체 설계는 pilot 실행 후 결정.

## 확장 경계

Pilot 완료 후 다음 우선순위로 확산:

1. **핵심 라이브러리**: `weighted-index`, `bit-index`, `permission-engine`, `@qa-sdk/core`
2. **서비스**: `ingest-server`, `registry-service`, `gate-service`, `query-service`, `definition-service`
3. **Layer 2 도구**: `ontology-pack-validate`, `definition-catalog`
4. **CLI 명령군**: `@qa-sdk/cli` 각 command 파일
5. **웹 앱**: `viz-web`, `registry-ui`, `docs-explorer` 등

각 wave는 별도 PRD로 진행하되, 본 plan의 주석 문법·검증 절차를 재사용한다.

## 참고 자료

- CLAUDE.md § "Definition 시스템" — level/layer/svc 정의, 서비스 운영 포트
- `docs/definition-system-philosophy.md` — 좌표 기반 문서화 원리
- `docs/specs/definition-catalog/deterministic-label-architecture.spec.md` — Layer 1-5 경계 (pilot 구조 참고)
- `packages/cli/src/lib/deterministic-label-boundary.test.ts` — 기계적 경계 강제 예시

## 성공 기준

- Pilot 3개 패키지의 주요 모듈 파일에 주석 부착 완료
- `qa-sdk def find-by-file` 으로 3개 패키지 각 파일에서 올바른 spec 조회
- `qa-sdk def validate` 경고 0 유지
- 본 plan의 절차대로 다음 wave를 수행할 수 있음을 확인

### Pilot Rollout 결과 (2026-04-19)

1. **커버리지 변화**:
   - Baseline: 43개 문서 (`source:` 기준)
   - Pilot 후: 161개 고유 파일이 문서와 연결됨 (`code_references` DB 기준)
   - 총 263건의 code-to-doc / doc-to-code 매핑 정규화 완료

2. **작업 내용**:
   - `doc-envelope`, `ralph-tui-integration`, `deterministic-label-registry` 3개 패키지 주석 주입 완료.
   - `deterministic-label-architecture`를 `module` 레벨로 승격하고 하위 spec들을 `contains`로 묶어 authoritative boundary로 설정.
   - `docs-control-plane.spec.md` 및 `definition-catalog.spec.md`에서 중복된 source/contains 정의 정리.

3. **검증**:
   - `qa-sdk def sync && qa-sdk def validate`: 경고 0건 확인.
   - `qa-sdk def find-by-file`: 파일별 boundary 해석 정상 작동 확인.

4. **결론**:
   - Pilot 성공. 코드 주석 기반의 boundary 선언이 문서 frontmatter의 source 선언보다 관리 효율성이 높음(코드 이동 시 자동 추적).
   - 향후 모든 core 라이브러리에 `@def.boundary` 도입 권장.

## 세션 핸드오프 체크리스트

세션 진입 시:

1. [x] 현재 커버리지 재확인: `grep -rE "^  source: packages/" docs/specs --include="*.spec.md" -l | wc -l`
2. [x] pilot 3개 패키지 주석 주입 (Step 1)
3. [x] `qa-sdk def sync && qa-sdk def validate` 경고 0 확인 (Step 2)
4. [x] `qa-sdk def find-by-file` 왕복 검증 (Step 3)
5. [x] 완료 후 본 plan에 결과 메모 추가 또는 후속 PRD 착수
