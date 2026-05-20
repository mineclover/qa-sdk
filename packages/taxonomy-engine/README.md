# taxonomy-engine

YAML 텍소노미 선언·검증·인덱싱·코드 생성 라이브러리.

설계: `../../docs/proposals/taxonomy-engine/00-design.md`

## 로컬 CI

전체 taxonomy 게이트 실행:

```bash
pnpm tax:ci
```

게이트: build / typecheck / unit tests / CLI integration / fixture validate / doctor drift / codegen hash drift.

codegen hash 변경이 의도된 경우:

```bash
pnpm tax:codegen:update
```
