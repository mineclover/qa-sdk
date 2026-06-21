# vendor — 외부 저장소 (git submodule)

qa-sdk 모노레포에서 fork·실험·참조용으로 포함하는 외부 저장소 목록이다.
`git clone --recurse-submodules` 또는 `git submodule update --init --recursive`로 체크아웃한다.

| 경로 | 저장소 | qa-sdk 연동 |
|------|--------|-------------|
| `projectvisbug` | [mineclover/ProjectVisBug](https://github.com/mineclover/ProjectVisBug) | pnpm workspace(`visbug`) + `packages/visbug-bridge`가 `workspace:*`로 소비. **edit-log 프로토콜 SSOT는 fork 쪽** (`app/edit-log/`). bridge는 typed 소비층만 담당 |
| `headroom` | [chopratejas/headroom](https://github.com/chopratejas/headroom) | submodule 참조만 (패키지 `file:` 의존 없음) |

## archi-adr

[archi-adr](https://github.com/mineclover/archi-adr)는 **qa-sdk 외부에서 별도로 시도 중인 아키텍처 설계 라이브러리**다. 현재 로컬 checkout은 `../architecture-labs/archi-adr`로 이동했다.
TypeSpec 기반 YAML 모델·검증·Mermaid 렌더 CLI(`@archi-adr/cli`)를 제공한다.

- qa-sdk `packages/archi`(`archi` CLI) 및 `architecture/` DSL과 **직접 연동되지 않는다**
- `pnpm-workspace`/`file:` 의존으로 묶지 않았으며, 독립 모노레포로 로컬 개발·실험한다
- 향후 연동이 필요하면 `visbug-bridge` 패턴(bridge 패키지 + `file:`)을 검토한다

로컬 작업:

```bash
cd ../architecture-labs/archi-adr
pnpm install
pnpm run build:spec
pnpm run demo:minimal
```
