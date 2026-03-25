---
name: def-split
description: "definition-catalog 대형 문서 분할. 150줄 이상인 리프 문서를 scope별로 분할하여 그룹 + 멤버 구조로 만든다."
---

# Definition Catalog — 문서 분할

150줄 이상인 리프 문서를 scope별로 분할하여 그룹(overview) + 멤버(specification) 구조로 만든다.

## 사용법

```
/def-split
```

## 분할 대상 찾기

```bash
node -e '
const fs=require("fs"),cp=require("child_process");
const files=cp.execSync("grep -rl \"lifecycle: approved\" docs/ 2>/dev/null",{encoding:"utf-8"}).trim().split("\n");
for(const f of files){const c=fs.readFileSync(f,"utf-8");
  if(c.split("\n").length>=150&&!c.includes("type: contains")){
    const id=(c.match(/  id: (.+)/)||["",""])[1];
    console.log(c.split("\n").length+"줄  "+id+"  "+f)}}
'
```

## 절차

1. `grep "^## " <파일>`로 섹션 구조 분석
2. 각 섹션의 scope 분류 (API→interface, 모델→data, 기능→feature, 흐름→flow, 제약→constraint, 상태→state)
3. 그룹 문서 생성 (depth: overview + contains 링크)
4. 멤버 문서 생성 (depth: specification + `## 목적 ^purpose`)
5. 원본 lifecycle: deprecated

## frontmatter 형식

```yaml
---
def:
  id: <id>
  scope: <scope>
  aspect: <aspect>
  depth: <depth>
  lifecycle: approved
---
# <제목>

## 목적 ^purpose

<purpose>
```

**필수**: `def:` 래퍼 + 2칸 들여쓰기. `## 목적 ^purpose` 필수.

## scope 결정: "주 독자가 누구인가"

constraint(규칙 준수자) → state(상태 설계자) → data(데이터 구조자) → feature(기능 구현자) → flow(흐름 이해자) → interface(API 호출자) → ui(UI 개발자)

## 검증

```bash
# ^purpose 누락 확인
grep -rl "^def:" docs/ | while read f; do
  lc=$(grep "lifecycle:" "$f" | head -1 | sed 's/.*lifecycle: //')
  [ "$lc" != "deprecated" ] && ! grep -q "\^purpose" "$f" && echo "MISSING: $f"
done

# 테스트
pnpm --filter definition-catalog test
```
