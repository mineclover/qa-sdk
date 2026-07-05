# weighted-index-explorer

`weighted-index-explorer`는 `weighted-index` 개념을 브라우저에서 탐색하는 데모 앱이다. 전용 package spec과 indexing 루트 문서를 함께 기준으로 읽는다.

## 먼저 볼 문서

- [weighted-index-explorer.spec.md](../../docs/specs/weighted-index-system/weighted-index-explorer.spec.md) — 패키지 계약
- [indexing/README.md](../../docs/specs/indexing/README.md) — 좌표 시스템 개념 맵과 패키지 위치
- [system-packages.spec.md](../../docs/specs/system/system-packages.spec.md) — 프론트엔드/데모 패키지 맥락
- [weighted-index/README.md](../../docs/specs/indexing/weighted-index/README.md) — explorer가 보여주는 핵심 개념

## 패키지 역할

- address, version, concept, filter, multi-index 같은 weighted-index 개념을 페이지 단위로 시연한다.
- `weighted-index`와 `weighted-ui`를 조합한 탐색형 데모 surface다.
- production 서비스라기보다 학습/디버깅/설명용 브라우저 UI에 가깝다.

## 코드 진입점

- `src/main.ts` — 앱 부팅
- `src/pages/address.ts` — 주소 탐색
- `src/pages/version.ts` — 버전 탐색
- `src/pages/multi-index.ts` — 다중 인덱스 시연
- `src/pages/layout-planner.ts` — 레이아웃/계획형 뷰
- `src/ui/*` — 공통 detail/grid/list UI

## 실행

```bash
pnpm --filter weighted-index-explorer dev
pnpm --filter weighted-index-explorer build
pnpm --filter weighted-index-explorer test
```

`test`는 production build 뒤 주요 sheet/container marker, JS/CSS asset, v1/v2/v3 mixed-radix shape와 encode/decode 예시를 검증한다.

새 페이지를 추가할 때는 먼저 어떤 indexing 개념을 시각화하는지 central docs와 전용 spec의 대응점을 잡는 것이 좋다.
