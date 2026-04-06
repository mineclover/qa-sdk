---
def:
  id: config-loader-spec
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: config-loader
  tags: [runtime, config, cross-scope]
  links:
    - target: system-support
      type: refines
---
# config-loader

## 목적 ^purpose

Catalog와 DKG 설정 파일을 `.ts/.js/.json`에서 자동 탐지해 로드하는 보조 라이브러리. 로컬 파일 기반 bootstrap 경로를 캡슐화해 CLI와 소비자 앱이 같은 fallback 규칙을 공유하게 한다.

## 구성 ^overview

- `catalog-loader` — catalog 파일 탐지와 로딩
- `dkg-config-loader` — DKG 설정 탐지와 로딩
- 확장자 fallback — `.ts → .js → .json` 순으로 시도
- runtime direct import와 registry 기반 대체 경로 사이의 얇은 adapter 역할

## 관련 소스

- `packages/config-loader/src/catalog-loader.ts`
- `packages/config-loader/src/dkg-config-loader.ts`
- `packages/config-loader/src/index.ts`
