# Taxonomy Engine v0.8 — Phase E — Doctor vocab cross-check

## 목적 ^purpose

v0.8 Phase E doctor vocab cross-check 계획 원문을 보존한다.

## Phase E — Doctor vocab cross-check

### Task E1: DEF_LIFECYCLE entries와 taxonomy lifecycle 사용 비교

**Files:**
- Modify: `packages/taxonomy-engine/src/doctor/extract/vocab.ts`
- Modify: `packages/taxonomy-engine/test/doctor-vocab.test.ts` (있으면)
- Create: `packages/taxonomy-engine/test/doctor-lifecycle.test.ts` (없으면)

- [ ] **Step 1: 실패 테스트 작성** — vocabulary.ts에 있는 5 lifecycle 값이 schema의 6 enum과 일치(tbd만 예외)하는지

```typescript
it("DEF_LIFECYCLE 5 entries + tbd = schema 6 enum", () => {
  // doctor extract-vocab가 DEF_LIFECYCLE을 보고 schema의 LifecycleSchema와 비교
  // 차이가 tbd만 있어야 OK, 그 외 차이는 doctor-drift
  const diags = runDoctorOnLifecycle();
  expect(diags.filter((d) => d.code === "doctor-drift")).toHaveLength(0);
});
```

- [ ] **Step 2: vocab.ts에 lifecycle 특별 처리 추가** — DEF_LIFECYCLE 추출 시 schema의 Lifecycle enum과 비교, `tbd`만 예외.

```typescript
const VOCAB_LIFECYCLE_ENTRIES = ["draft", "review", "approved", "deprecated", "archived"];
const SCHEMA_LIFECYCLE_VALUES = ["draft", "review", "approved", "deprecated", "archived", "tbd"];
const expectedExtras = ["tbd"];
const actualExtras = SCHEMA_LIFECYCLE_VALUES.filter((v) => !VOCAB_LIFECYCLE_ENTRIES.includes(v));
const unexpectedExtras = actualExtras.filter((v) => !expectedExtras.includes(v));
if (unexpectedExtras.length > 0) {
  diags.push({
    severity: "warning",
    code: "doctor-drift",
    message: `schema lifecycle에 vocabulary 외 값: ${unexpectedExtras.join(", ")}`,
  });
}
```

- [ ] **Step 3: 테스트 통과 + commit**

```bash
pnpm --filter taxonomy-engine test
git add packages/taxonomy-engine/src/doctor/extract/vocab.ts packages/taxonomy-engine/test/doctor-lifecycle.test.ts
git commit -m "feat(taxonomy-engine): doctor cross-check vocabulary DEF_LIFECYCLE vs schema"
```

---
