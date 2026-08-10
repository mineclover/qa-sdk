# Browser Layout Inspector — Delivery Plan

## 범위

- **변경 유형 / owner**: browser source behavior / `browser-layout-inspector`.
- **목표**: 페이지에서 DOM을 직접 선택해 stylesheet selector 단위, final computed style, CSS px 측정값, document·reference 상대 위치를 보고, 두 요소 간 거리를 재며, 임시 inline style을 실시간 편집한다.
- **비범위**: 원본 stylesheet 수정·저장, CORS로 차단된 stylesheet CSSOM 우회, 이미지 기반 ruler, 모든 pseudo-element의 cascade provenance.

## 기준선

- VisBug는 두 요소 edge gap과 box model을 제공하지만 일반-purpose JSON inspection API는 없다.
- `rlsc-analysis/browser`는 화면 전체 수집기이며 selector별 CSS source 추출 API는 없다.
- repository에는 `scripts/measure-page.mjs`가 없다.

## 단계

1. cases와 test contract를 고정한다.
2. DOM inspection library를 구현한다.
3. `activeTab` + `scripting`만 쓰는 MV3 shell에 페이지 선택 overlay, A→B 측정, tab-local style mutation/restore를 만든다.
4. focused package test/typecheck/build와 package surface gate를 확인한다.
