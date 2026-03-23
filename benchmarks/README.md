# QA-SDK 로깅 벤치마크 결과

## 실행 환경
- Node.js v24, macOS, localhost (네트워크 지연 ≈ 0)
- ingest-server: InMemory store (DB 쓰기 없음)
- 순수 프로토콜 + 서버 처리 성능 측정

## 결론

### 순차 요청 (p50 지연)
| Transport | 1 record | 10 records |
|-----------|:--------:|:----------:|
| JSON string | 0.23ms | 0.16ms |
| JSON binary | 0.19ms | 0.15ms |
| QAPB | 0.16ms | 0.15ms |

**→ 순차에서는 프로토콜 차이 무의미 (0.15~0.23ms)**

### Concurrent 요청 (req/s)
| 동시성 | JSON | QAPB | 차이 |
|-------:|-----:|-----:|-----:|
| 1 | 1,424 | 1,744 | QAPB 1.2x |
| 5 | 3,258 | 5,190 | QAPB 1.6x |
| 20 | 5,399 | 9,299 | **QAPB 1.7x** |
| 50 | 8,641 | 7,319 | JSON 1.2x |

**→ 동시 5~20 요청에서 QAPB가 1.6~1.7배 빠름**
**→ 동시 50+ 요청에서는 차이 소멸 (서버 CPU 포화)**

### Batch 효과 (가장 큰 영향)
| 구성 | rec/s |
|------|------:|
| JSON 1건씩 | 6,035 |
| JSON 12건 batch | 14,951 |
| QAPB 12건 batch | 59,141 |

**→ batching이 프로토콜 선택보다 2~10배 더 중요**

## 실전 권장

```
성능 최적화 우선순위:
  1. Batching (2~10x) — 이벤트를 세션/시간 윈도우로 묶기
  2. QAPB 바이너리 (1.2~1.7x) — 동시 요청 5~20일 때 효과
  3. 프로토콜 변경 (≈1x) — 순차 요청에서는 차이 없음
```

### 가장 빠른 설정
- **브라우저**: BeaconTransport + batch (페이지 이탈 시 flush)
- **Node.js 서비스**: ProtobufTransport + 시간/건수 윈도우 batch (5초 or 50건)
- **고부하 서비스**: ProtobufTransport + concurrent 10~20 + batch 50건

## 실행
```bash
# ingest-server 시작 후
node benchmarks/logging-transport.js
```
