# Taxonomy Engine — 1급 개념

> 텍소노미 좌표 공간을 구성하는 1급(first-class) 추상 4종. 다른 모든 시스템 요소는 이것들의 조합 또는 위의 도구.

## 4개념

| 개념 | 한 줄 |
|------|------|
| [Axis](./axis.md) | 좌표 공간의 한 차원 (방향). |
| [Entry](./entry.md) | Axis 위의 한 점. id(가변)와 address(불변) 이중 이름. |
| [Coordinate](./coordinate.md) | 여러 Axis의 Entry를 묶은 좌표 튜플 — 공간의 한 점. |
| [Relation](./relation.md) | Coordinate/Entry 간 의미적 화살표. 직교성을 깨지 않고 구조 표현. |

## 관계도

```
Taxonomy (공간)
  │
  ├── Axis ──────► Entry (axis의 원소)
  │     │             │
  │     │             │ ▲
  │     ▼             │ │
  │   (직교 곱) ──► Coordinate (점)
  │                     │
  │                     ▼
  └── Relation (점/entry 사이 화살표)
```

## 지원 개념 (supporting)

1급은 아니지만 시스템 동작에 필수:

- **Constraint** — 좌표/관계 조합의 선언적 제약. spec §7.2 DiagnosticCode + spec §4.1 yaml `constraints:` 필드 참조.
- **Taxonomy** — Axis + Relation + Constraint의 묶음 (yaml 파일 단위). spec §4 참조.
- **Registry** — 여러 Taxonomy를 함께 보관하고 cross-taxonomy 참조 허용. spec §5.3 참조.

## 다른 문서에서 인용 시

본문에서 1급 개념을 처음 언급할 때는 `[[axis]]` 같은 wiki-link 또는 `[Axis](concepts/axis.md)` 명시 링크로 참조. 각 개념 파일이 SSOT, 본문은 사용 맥락만.

## 참조

- spec 본문: `../00-design.md`
- 구현 plan: `../01-plan.md` (v0.1) + `../02-plan-v2.md` (v0.2)
- 좌표계 시스템 철학: `docs/definition-system-philosophy.md`
