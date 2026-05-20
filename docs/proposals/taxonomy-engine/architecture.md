# Architecture

> 00-design.md §3 분리. v0.7 모듈화 (T-L1).

## 3.1 패키지 구조

```
packages/
  taxonomy-engine/                       ← 신규 (unscoped, tsup dual format)
    src/
      schema/        # YAML schema (zod) + IR 타입
      parser/        # yaml 텍스트 → IR (구조 검증)
      indexer/       # IR → coordinate index (address 할당, capacity, stride, version)
      query/         # 좌표 조회/순회/슬라이스
      ref/           # 참조 grammar parser + resolver (3-tier)
      codegen/       # IR → TS 타입/registry (결정론, contentHash)
      validate/      # 의미 검증 (axis 5Q, capacity ≥ entries*2, constraint)
      doctor/        # yaml ↔ 외부 SSOT drift 검출
      diff/          # 두 IR 비교, 변경 카탈로그
      index.ts
  cli/                                   ← 기존 @qa-sdk/cli 확장
    src/commands/taxonomy.ts             # 명령 구현 (T-M1에서 분리 예정)
    src/command-groups/taxonomy.commands.ts
```

## 3.2 책임 경계

| 컴포넌트 | 책임 | 비책임 |
|----------|------|--------|
| `schema` | YAML/IR 타입 정의 (zod), version stamp | 파일 I/O, CLI 출력 |
| `parser` | yaml 텍스트 → IR (구조 검증 only) | 의미 검증, 좌표 할당 |
| `indexer` | IR에 address 할당, capacity/stride/version 결정 | 영속화 |
| `query` | (axis, coordinate) → entries, traversal | 변경/편집 |
| `ref` | 참조 grammar parse + resolve (taxonomy 간 포함) | I/O |
| `codegen` | IR → TS 결정론적 출력 | 런타임 실행 |
| `validate` | 의미 검증 (axis 5Q, capacity, constraint) | 자동 수정 |
| `doctor` | yaml ↔ 외부 SSOT drift 검출 + 진단 발행 | 자동 수정 |
| `diff` | 두 IR 비교, DiffEntry 목록 생성 | I/O, 편집 |
| `cli/commands/taxonomy.ts` | CLI thin wrapper, exit code | 비즈니스 로직 |

## 3.3 의존 방향

```
cli → taxonomy-engine (public index.ts only) → zod, yaml
```

qa-sdk 내부 다른 패키지 의존 없음 (peer-zero). 라이브러리는 순수 — 파일 I/O/SQLite/fetch 없음.

## 3.4 핵심 원칙

1. **좌표계 1급** — Axis + Entry + Coordinate가 추상 모델의 기본. 계층/관계는 좌표 간 Relation으로 표현 (직교성 유지, qa-sdk 좌표계 컨벤션 계승).
2. **YAML SSOT + TS codegen** — yaml이 유일 입력. TS 타입/registry는 결정론적 codegen.
3. **address 불변 / id 가변** — qa-sdk의 (정수 address 불변 / kebab-case id 변경 가능) 패턴 그대로.
4. **순수 라이브러리 + thin CLI** — taxonomy-engine은 파일 I/O/SQLite/fetch 없음. I/O는 CLI 책임.
5. **fail-fast on validate, fail-open on query** — 검증 단계 errors=0 강제, 조회는 unknown coordinate에 undefined 반환.

## 참조

- 데이터 모델: [data-model.md](./data-model.md)
- 라이브러리 API: [api-surface.md](./api-surface.md)
- 에러 처리/진단: [diagnostics.md](./diagnostics.md)
- 개념 체계: [concepts/README.md](./concepts/README.md)
- 패키지 컨벤션: `CLAUDE.md` §패키지 규칙
