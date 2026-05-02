# config-loader

`config-loader`는 catalog와 DKG 설정을 `.ts/.js/.json`에서 자동 탐지해 읽는 보조 라이브러리다. 전용 package spec은 아직 없고, 현재는 registry 연결/초기화 문서를 기준으로 읽는다.

## 먼저 볼 문서

- [config-loader.spec.md](../../docs/specs/system/config-loader.spec.md) — 패키지 계약
- [realization-registry-connection.md](../../docs/realization-registry-connection.md) — registry 기반 catalog 로딩 경로가 왜 분리됐는지
- [system-overview.md](../../docs/system-overview.md) — 설정 로딩 패키지의 저장소 내 위치
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 플랫폼 체인과 패키지 의존 맥락

## 패키지 역할

- local file 기반 catalog/DKG config 로딩을 캡슐화한다.
- `.ts/.js/.json` 확장자를 자동 감지하고 fallback 체인을 제공한다.
- registry/direct import 양쪽 경로 사이의 얇은 적응층 역할을 맡는다.

## 코드 진입점

- `src/index.ts` — public export
- `src/catalog-loader.ts` — catalog 로딩
- `src/dkg-config-loader.ts` — DKG config 로딩

## 실행

```bash
pnpm --filter config-loader build
pnpm --filter config-loader typecheck
```

이 패키지는 작지만 catalog bootstrap 경로를 결정하므로, 동작을 바꿀 때는 registry 연결 문서와 소비자 초기화 흐름을 먼저 확인한다.
