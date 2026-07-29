---
name: prefix-add
description: "새 축/prefix를 DEMO_CATALOG에 추가하는 전체 플로우. 트리거: 'prefix 추가', '축 추가', '새 prefix', 'new axis', 'new prefix', 'prefix 만들어', '축 등록'"
---

# Prefix/Axis 추가

새 축 또는 prefix를 DEMO_CATALOG에 추가하는 전체 플로우.

## Step 1: 5Q Checklist 판정

새 차원이 축(axis)인지 table_ref인지 판단:

| 질문 | YES → axis | NO → table_ref |
|------|------------|----------------|
| 유한한가? | 경우의 수가 정해져 있다 | 무제한 증가 |
| 의사결정에 쓰이는가? | 분기/필터/권한 판단 | 단순 데이터 |
| 여러 prefix가 공유하는가? | 2개 이상 prefix에서 사용 | 1개 전용 |
| 안정적인가? | 변경 빈도 낮음 | 자주 바뀜 |
| capacity 산정 가능한가? | 상한 예측 가능 | 불가 |

## Step 2: 기존 중복 확인

```bash
node packages/cli/dist/index.js dkg overlaps  # 축 중복 스캔
```

## Step 3: DEMO_CATALOG에 등록

축 추가 위치: `packages/demo-snapshot/src/demo-catalog.ts` → `axes` 섹션
prefix 추가 위치: 같은 파일 → `prefixes` 섹션

축 템플릿:
```typescript
new_axis: {
  id: "new_axis", name: "표시 이름",
  versions: {
    v1: {
      entries: ["entry1", "entry2", "entry3"],
      capacity: 8,  // nextPowerOf2(entries × 2) 이상
      ko: { entry1: "한국어1", entry2: "한국어2", entry3: "한국어3" },
    },
  },
},
```

prefix 템플릿:
```typescript
new_prefix: {
  id: "new_prefix", name: "표시 이름",
  description: "dim1 × dim2 — 무엇의 경우의 수인가",
  labels: ["dim1", "dim2"],
  meta: { category: "observation", layer: 2, ... },
  dims: {
    dim1: { kind: "axis", axisId: "existing_axis" },
    dim2: { kind: "prefix_ref", prefixId: "service" },  // 또는 axis/table_ref
  },
  versions: [
    { version: "v1", axisVersions: { existing_axis: "v1" }, refEntries: { ... } },
  ],
},
```

## Step 4: 빌드 + 검증

```bash
pnpm --filter demo-snapshot build
pnpm --filter demo-snapshot test
pnpm --filter @qa-sdk/spec-core build
node packages/cli/dist/index.js dkg self-check
```

## Step 5: 문서 구조 검증

```bash
cd /path/to/spec-management-platform
corepack pnpm --filter @spec-platform/qa-sdk-adapter build
corepack pnpm --filter @spec-platform/qa-sdk-adapter start -- scan-audit /path/to/qa-sdk --json
```

문서 파싱·taxonomy·코드 연결 검증은 `spec-management-platform`이 소유한다. qa-sdk는
카탈로그와 DKG의 정의만 제공한다.

## 주의사항

- capacity는 `nextPowerOf2(entries.length × 2)` 이상 — 눈대중 금지
- 문자열은 영구 고정 — 한번 등록하면 변경 불가 (entry ID)
- ko 필드는 표시용 — entry ID와 독립
- prefix_ref 사용 시 refEntries 파생 필요 (catalog-builder.ts의 *_MEANING 패턴)

## Skill 기반 검증

| 단계 | skill | 용도 |
|------|-------|------|
| 추가 안전성 | `dkg run skill-entry-add-chain <axis> <entry>` | headroom + constraint + domain 종합 판정 |
| 영향 분석 | `dkg run skill-analyze-impact <axis>` | cascade 범위 확인 |
| 용량 확인 | `dkg run skill-prefix-capacity-audit <prefix>` | 추가 후 headroom 상태 |
| 마이그레이션 | `dkg run skill-infer-migrator <from> <to>` | dim 변경 시 변환 패턴 추론 |
| 결정 기록 | `dkg run skill-record-decision <axis> new-axis <title> <rationale>` | 축 신설 결정 영속 |
