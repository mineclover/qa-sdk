# Taxonomy Engine v0.4 구현 계획 — 부채 청산 + 사용 사례 확장

> v0.3 + DKG PoC 리뷰 결과. Phase F (라이브러리 부채 청산) + Phase G (사용 사례 확대).

**Goal v0.4:** 
- Phase F: yaml lib 통합 (N-1) + doctor 자동 추출 (N-2) + CLI codegen/diff/--registry
- Phase G: qa-sdk의 다른 서비스 좌표 체계 1-2개 yaml 추가 (사례 누적)

**Branch:** `feat/taxonomy-engine-v4`. Base: main@e8f42f9f (DKG PoC 머지 완료, 106 tests + tax:ci).

---

## Task 분해

### Phase F — 라이브러리 부채 청산

**T-F1: yaml lib 통합 (N-1)**
- `js-yaml`을 `yaml` (eemeli)로 완전 교체
- `parser/index.ts`의 `yaml.load()` → `parseDocument().toJS()` 또는 `parse()` 직접 사용
- yaml line/column 정보는 이미 T-E3에서 yaml lib 사용 중 — 통합으로 일관성
- `package.json`에서 js-yaml 제거
- 모든 테스트 + tax:ci 회귀 X

**T-F2: doctor expected 자동 추출 (N-2)**
- `packages/taxonomy-engine/src/doctor/extract.ts` 신규
- 첫 적용: dkg-schema의 expected JSON을 `docs/specs/dkg-system/dkg-node-types.spec.md` + `dkg-edge-types.spec.md`의 markdown 표에서 추출
- 추출 함수 `extractDkgExpected(specText): ExpectedTaxonomy`
- 추출 결과 = 기존 hardcoded JSON과 일치 (회귀 안전)
- CLI 또는 script로 expected 갱신: `node scripts/tax-doctor-extract-dkg.mjs > .../expected-dkg-schema.json`
- 두 번째 적용은 후속 (qa-sdk-coordinate-system: ts source에서 추출은 별 task — 어려움)

**T-F3: CLI tax codegen 명령**
- `qa-sdk tax codegen <file> --out <dir>` — 5 TS 파일 디스크에 기록
- `--skip-validate` 옵션 (codegen-validate gate 우회)
- 기존 tax validate/show 패턴 mirror
- 테스트 2-3건

**T-F4: CLI tax diff 명령**
- `qa-sdk tax diff <a> <b>` — 두 yaml의 entries/relations 차이
- 출력: 추가/제거/변경된 entries + address 충돌 + relation rule 차이
- 텍스트 출력 (--json 옵션)
- 테스트 2건

**T-F5: CLI --registry <dir> 옵션**
- 모든 명령에 `--registry <dir>` 추가 — 디렉토리의 모든 yaml을 registry에 로드
- cross-tax import 검증 정상 작동
- 테스트 1건

### Phase G — 사용 사례 확대

**T-G1: 추가 사례 yaml 작성 (1-2개)**

후보 (사용자 결정):
- ingest 좌표 체계
- registry 좌표 체계
- gate 좌표 체계
- decision-flow 좌표 체계
- query/decode 좌표 체계

각 사례:
- yaml 작성 (`docs/taxonomies/<service>-coords.yaml`)
- expected fixture (가능하면 자동 추출 — T-F2 활용)
- 도그푸딩 테스트

이번 plan에는 첫 1-2개만. 나머지는 후속.

---

## 실행 순서

```
T-F1 (yaml 통합) — 다른 모든 작업 기반
  ↓
T-F2 (doctor 추출)
  ↓
T-F3 (codegen 명령) ─┐
T-F4 (diff 명령)     ├── 병렬 가능
T-F5 (--registry)    ─┘
  ↓
T-G1 (추가 사례)
```

---

## 회귀 정책

- 매 task 후 `pnpm tax:ci` 통과
- T-F1 (yaml lib 변경) 후 _loc 정확성 회귀 우선 확인
- T-G1 (새 yaml 추가) 후 hash lockfile 자동 갱신

## 제외 (out of scope)

- Web UI (별도 spec)
- N-3 edge-compat 완전 표현 (N-2 후 자연스럽게 따라옴)
- N-4 Constraint expression DSL (사용 사례 누적 후)
- frontmatter 승격 (의존자 나타날 때)
- history squash (push 시점)
