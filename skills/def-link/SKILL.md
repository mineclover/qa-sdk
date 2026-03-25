---
name: def-link
description: "definition-catalog 문서 간 링크 연결. 고아 문서에 depends_on/implements/refines/constrains 관계를 추가한다."
---

# Definition Catalog — 문서 링크 연결

links가 없는 리프 문서에 횡방향 관계(depends_on, implements, refines, constrains)를 추가한다.

## 사용법

```
/def-link <문서ID>        — 특정 문서의 링크 추론 + 추가
/def-link --audit         — 링크 없는 문서 전체 목록
/def-link --batch <시스템> — 시스템 그룹 내 멤버 일괄 연결
```

## 링크 없는 문서 찾기

```bash
node -e '
const fs=require("fs"),cp=require("child_process");
const files=cp.execSync("grep -rl \"lifecycle: approved\" docs/ 2>/dev/null",{encoding:"utf-8"}).trim().split("\n");
for(const f of files){
  const c=fs.readFileSync(f,"utf-8");
  const fm=(c.match(/^---\n([\s\S]*?)\n---/)||["",""])[1];
  if(fm.includes("type: contains")) continue;
  if(!fm.includes("target:")){
    const id=(c.match(/  id: (.+)/)||["",""])[1];
    const scope=(c.match(/scope: (\w+)/)||["",""])[1];
    console.log(id+" ("+scope+")  "+f);
  }
}
'
```

## 링크 추론 규칙

문서의 scope와 본문 내용을 기반으로 관계를 추론한다.

### scope 기반 추론

| 이 문서의 scope | 가능한 관계 | 대상 scope |
|----------------|-----------|-----------|
| interface | implements → | feature (구현하는 기능) |
| interface | depends_on → | data (사용하는 스키마) |
| feature | depends_on → | data (사용하는 데이터 모델) |
| feature | depends_on → | state (참조하는 상태) |
| flow | refines → | feature 또는 interface (상세화하는 대상) |
| flow | depends_on → | data, state |
| constraint | constrains → | interface, feature (제약하는 대상) |
| state | depends_on → | data (상태가 저장되는 스키마) |
| data | depends_on → | data (참조하는 다른 데이터) |

### 본문 키워드 추론

문서 본문에서 다른 문서의 ID나 제목이 언급되면 관계 후보:

```bash
# 대상 문서의 본문에서 다른 문서 ID 참조 찾기
node -e '
const fs=require("fs"),cp=require("child_process");
const targetId = "<문서ID>";
const targetFile = cp.execSync(`grep -rl "  id: ${targetId}$" docs/ 2>/dev/null`,{encoding:"utf-8"}).trim().split("\n")[0];
const content = fs.readFileSync(targetFile,"utf-8");

// 모든 문서 ID 수집
const allFiles = cp.execSync("grep -rl \"^def:\" docs/ 2>/dev/null",{encoding:"utf-8"}).trim().split("\n");
const allIds = new Set();
for(const f of allFiles){
  const c=fs.readFileSync(f,"utf-8");
  const id=(c.match(/  id: (.+)/)||["",""])[1];
  if(id && id !== targetId) allIds.add(id);
}

// 본문에서 다른 문서 ID 참조 찾기
for(const id of allIds){
  if(content.includes(id)){
    console.log("참조 발견: "+id);
  }
}
'
```

### 같은 그룹 멤버 간 관계 추론

같은 시스템 그룹에 소속된 문서 간 관계:

```
constraint → constrains → interface, feature (같은 그룹 내)
state → (다른 멤버가) depends_on → state
data → (다른 멤버가) depends_on → data
feature → implements → interface (같은 그룹 내)
flow → refines → feature, interface (같은 그룹 내)
```

## 링크 추가 방법

frontmatter에 links 섹션을 추가하거나 기존에 추가:

```yaml
---
def:
  id: some-doc
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  links:
    - target: some-data-model
      type: depends_on
    - target: some-api
      type: implements
---
```

이미 links가 있으면 기존 항목 아래에 추가.
links가 없으면 `lifecycle:` 다음 줄에 `links:` 섹션 생성.

## 검증

```bash
# 링크 추가 후 확인
grep -A2 "target:" <수정파일>

# blast radius 변화 확인
/def-bottomup <문서ID>

# 전체 테스트
pnpm --filter definition-catalog test
```

## 주의

- traces_to는 추적 관계일 뿐 — 영향 전파 안 됨. 테스트/시나리오 문서에만 사용
- 순환 참조 주의: A depends_on B, B depends_on A는 피한다
- 관계가 불확실하면 추가하지 않는다 — 잘못된 링크가 없는 것보다 나쁨
