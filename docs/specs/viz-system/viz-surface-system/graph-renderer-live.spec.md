---
def:
  id: graph-renderer-live
  address: def_document:v2:273553
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: platform-demo
  tags: [observability, runtime, performance]
  links:
    - target: viz-surface-system
      type: refines
---

# 그래프 렌더러 실시간 규칙

## 목적 ^purpose

그래프 스타일 매핑과 SSE 기반 실시간 업데이트 규칙을 분리해 렌더러의 런타임 변경 비용을 줄인다.

## 구성 ^overview

platform-demo의 monitor.html이 3D 좌표 시각화를 실시간으로 렌더링한다. Three.js 기반 3D 그리드, SSE 이벤트 스트림, Signal Role 분류를 결합하여 좌표 주소가 발생할 때마다 해당 셀을 하이라이트한다.

## 3D 그리드 렌더링 — viz-3d-core.js

### 카테고리별 스타일 매핑

| 카테고리 | color | emissive | 용도 |
|----------|-------|----------|------|
| `observation` | `0x00E5FF` | `0x009797` | 관측 prefix |
| `event` | `0xFFAA00` | `0xBF8000` | 이벤트 prefix |
| `policy` | `0x00E676` | `0x009624` | 정책/권한 prefix |
| `relation` | `0xB388FF` | `0x7C5CFF` | 관계형 prefix |
| `entity` | `0x546E7A` | `0x37474F` | 엔티티 prefix |
| `table` | `0xFF6B72` | `0xC62828` | 테이블 prefix |

### 레이어 컬러

`layerColors: [0x64FFDA, 0xFFC043, 0x7C5CFC, 0xFF4C30]` — 최대 4개 레이어 구분

### 셀 상태

- `cellOpacity: 0.12` — 기본 상태 (비활성 셀)
- `activeOpacity: 0.85` — 이벤트 발생 시 활성 셀
- `beamOpacity: 0.4` — 빔 이펙트 (이벤트 연결선)

## Signal Role 기반 분류

`browser-codec`의 `SignalRole` 분류가 실시간 렌더링의 의미 레이어를 구성한다:

| Role | 설명 | 매핑 prefix 예시 |
|------|------|-----------------|
| `context` | 환경/위치 | service, page_view |
| `trigger` | 유저 행동/시스템 이벤트 | tracking, cart_event, auth_event |
| `channel` | API/webhook 경로 | endpoint |
| `state` | 비즈니스 흐름 위치 | flow_point |
| `guard` | 권한/정책 | permission, rbac |
| `effect` | 결과/파이프라인 | pipeline_point, health_event |
| `data` | 데이터 접점 | members, orders, items |

## 실시간 업데이트 규칙

### 부분 갱신 원칙

- 전체 그래프를 다시 그리지 않는다
- 이벤트 발생 시 해당 셀의 opacity만 `activeOpacity`로 변경
- 일정 시간 후 `cellOpacity`로 fade-back

### Flow Timeline Panel

- 하단 우측에 최근 이벤트를 시간순으로 표시
- 각 항목: role dot(색상), prefix 이름, 차원 값, 타임스탬프
- `ft-slide-in` 애니메이션으로 새 항목 등장
- `ft-fading` 클래스로 오래된 항목 페이드아웃

### Signal Legend

- 좌측 하단에 role별 범례 표시
- 각 role 클릭으로 필터링 (dimmed/active 토글)
- `sl-dot` 색상이 3D 그리드 셀 색상과 일치

## 스트림 안정성

- SSE 연결이 끊어지면 마지막 일관된 상태 유지
- 이벤트 순서 뒤틀림 시 타임스탬프 기준 정렬
- 스트림 지연 시 UI가 멈추지 않음 — 렌더링과 데이터 수신이 독립
