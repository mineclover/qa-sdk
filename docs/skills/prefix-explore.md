---
name: prefix-explore
description: "prefix/axis/domain/dsl 정보를 조회하고 탐색. 트리거: 'prefix 조회', 'axis 확인', 'domain 확인', 'dsl 확인', 'prefix 정보', '축 정보', '도메인 구조'"
---

# Prefix 탐색

qa-sdk CLI에서 카탈로그와 DKG를 기준으로 prefix, axis, domain, dsl 정보를 조회한다.

## DKG CLI (심층 분석)

```bash
node packages/cli/dist/index.js dkg prefix permission   # prefix 프로파일
node packages/cli/dist/index.js dkg impact role          # 축 변경 영향 분석
node packages/cli/dist/index.js dkg overlaps             # 축 중복 스캔
node packages/cli/dist/index.js dkg domains              # 도메인 건강
node packages/cli/dist/index.js dkg dsl dsl-checkout     # DSL 번들 프로파일
node packages/cli/dist/index.js dkg service auth         # 서비스 프로파일
node packages/cli/dist/index.js dkg trace permission     # 인과 체인 역추적
```

## Skill 기반 탐색

```bash
dkg run skill-explore-prefix <prefixId>  # prefix 심층 프로파일
dkg run skill-explore-service <serviceId> # 서비스 소유/소비 맵
dkg run skill-explore-dsl <dslId>        # DSL 멤버 + 불변조건
dkg run skill-trace <nodeId>             # 인과 체인 역추적
dkg run skill-system-overview            # 전체 대시보드
dkg run skill-table-impact <tableId>     # DB 의존 추적
```

필터: `dkg skills read` — 탐색 skill만 조회

## 사용 가이드

- **간단한 조회** → `dkg` CLI
- **영향 분석, 수렴 검토** → `dkg run skill-*`
- **문서 구조·코드 연결 검증** → `spec-management-platform`의 `qa-spec-platform`

## 검증 매핑

- `dkg prefix`, `dkg impact`, `dkg trace`
  - 검증: `packages/cli/src/skills-workflows.test.ts`
