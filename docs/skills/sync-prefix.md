---
name: sync-prefix
description: "prefix/axis/domain 변경 후 Obsidian spec-prefix 볼트에 동기화. 트리거: 'prefix 동기화', 'obsidian 동기화', 'sync prefix', 'sync obsidian', '볼트 업데이트', prefix/axis/domain 추가/변경/삭제 작업 완료 시"
---

# Prefix → Obsidian 동기화

prefix, axis, domain 변경 작업 후 Obsidian spec-prefix 볼트를 동기화한다.

## 언제 사용하는가

1. **DEMO_CATALOG에 axis/prefix 추가/변경** 후
2. **DEMO_DKG_CONFIG에 domain/dsl 추가/변경** 후
3. **DKG skill 실행** (dkg decide, dkg observe 등) 후 결과를 Obsidian에 반영할 때
4. 사용자가 명시적으로 Obsidian 동기화를 요청할 때

## 실행 순서

### 1단계: 의존 패키지 빌드 (소스 변경 시)

```bash
pnpm --filter demo-snapshot build && pnpm --filter @qa-sdk/spec-core build && pnpm --filter @qa-sdk/cli build
```

DEMO_CATALOG만 수정한 경우 demo-snapshot + cli만 빌드해도 됨.

### 2단계: 동기화 실행

```bash
node packages/cli/dist/index.js sync-obsidian          # 전체 동기화
node packages/cli/dist/index.js sync-obsidian --dry-run # 미리보기
node packages/cli/dist/index.js sync-obsidian --vault <name> # 다른 볼트
```

### 3단계: 확인

```bash
node packages/cli/dist/index.js obs stats              # 볼트 현황
node packages/cli/dist/index.js obs read prefix/<id>.md # 특정 노트
node packages/cli/dist/index.js obs backlinks role      # 백링크
```

## 볼트 구조 (149개 노트)

| 폴더 | 수 | kind | 내용 |
|------|-----|------|------|
| axis/ | 74 | axis | 1차원 축 (entries, capacity, 사용하는 prefix wikilink) |
| prefix/ | 39 | prefix | N-D 주소 공간 (dims wikilink, domain, signal-role) |
| dsl/ | 11 | dsl | DSL 번들 (members, invariants) |
| domain/ | 6 | domain | prefix 그룹 바운더리 |
| layer/ | 4 | layer | 아키텍처 계층 |
| arch/ | 6 | architecture | 런타임 아키텍처 (observation-loop, msa-topology, catalog-registry, projection, browser-sdk, codegen-pipeline) |
| concepts/ | 5 | concept | 핵심 개념 (좌표 축, 유한 상태, 관측성, 서비스 정체성, 산출물 단위) |
| 루트 | 3 | - | identity, signal-model, _index |

## SSOT 원칙

- **단방향**: DEMO_CATALOG → Obsidian. Obsidian 수정은 소스에 반영되지 않음
- **구현**: `packages/cli/src/commands/sync-obsidian.ts` (execa 기반)
