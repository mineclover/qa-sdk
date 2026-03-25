---
name: def-audit
description: "definition-catalog 문서 품질 감사. purpose 품질, 링크 누락, 태그 미부여, 마커 미사용을 점검하고 개선한다."
---

# Definition Catalog — 문서 품질 감사

문서의 품질 지표를 점검하고 개선 작업을 수행한다.

## 실행

```bash
qa-sdk def audit       # 전체 품질 리포트
qa-sdk def validate    # 깨진 링크/순환/고아 검증
qa-sdk def stats       # 분포 통계
```

## 품질 기준

### ^purpose

| 등급 | 기준 | 조치 |
|------|------|------|
| 양호 | 30자+ | — |
| 짧음 | <30자 | 보강: "무엇+왜+범위" |
| 없음 | 마커 없음 | `## 목적 ^purpose` 추가 |

### links

리프 문서에 최소 1개 횡방향 관계. `/def-link`로 추가.

### tags

concern(security, performance 등) + tier(tier-infra 등) 태그 부여.

### ^overview

그룹 문서(depth: overview)에 `## 구성 ^overview` 필수.

## purpose 보강 패턴

```
❌ "서비스 메타데이터 CRUD."
✅ "서비스 메타데이터(이름, tier, team, ownedPrefixes)를 등록/조회/삭제하는
    REST API. 서비스 디스커버리의 입력 데이터."
```

무엇 + 왜 + 범위.
