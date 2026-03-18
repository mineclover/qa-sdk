# Unit 3 — Monitoring API

> 집계 데이터(Transition/Path)를 조회하는 전용 API를 제공한다.
> raw event를 직접 조회하지 않고 projection 기반으로 운영 가시성을 확보한다.

## 흐름 심볼

`[A6]` Metrics Store 조회 (읽기 경로)

## 현재 상태

- Metrics Store: 📋 (Unit 2에서 구축)
- 조회 API: 📋 없음
- 현재 조회: ingest-server `/v1/traces`, `/v1/sessions` (raw record 기반)

## 선행 조건

- **unit-2-pipeline** — Metrics Store + 집계 데이터 존재

## 작업 항목

| # | 작업 | 설명 |
|---|---|---|
| 1 | Monitoring API 패키지 또는 ingest-server 확장 | 별도 서비스 vs 기존 서버 확장 판단 |
| 2 | Transition 조회 엔드포인트 | `GET /v1/metrics/transitions?from=&to=&window=hour` |
| 3 | Path 조회 엔드포인트 | `GET /v1/metrics/paths?from=&to=&top=10` |
| 4 | 축별 필터 | `?axis=role&value=admin` → matchRanges 기반 범위 필터 |
| 5 | 시각화 연동 | viz-web 또는 별도 Ops UI에서 대시보드 |

## 조회 패턴

```
Ops UI → GET /v1/metrics/transitions?window=hour&axis=role&value=admin
       → Monitoring API
       → matchRanges({ role: "admin" }) → [from, to][]
       → SELECT FROM transition_metrics WHERE packed_key BETWEEN ? AND ?
       → 집계 결과 반환
```

## 산출물

- Monitoring 엔드포인트 (최소 2종: transition, path)
- 축 기반 필터 (matchRanges 활용)
- 운영 대시보드 데이터 소스
