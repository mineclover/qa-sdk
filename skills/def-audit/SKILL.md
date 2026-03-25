---
name: def-audit
description: "definition-catalog 문서 품질 감사. purpose 품질, 링크 누락, 태그 미부여, 마커 미사용을 점검하고 개선한다."
---

# Definition Catalog — 문서 품질 감사

문서의 품질 지표를 점검하고 개선 작업을 수행한다.

## 사용법

```
/def-audit                — 전체 품질 리포트
/def-audit <문서ID>       — 특정 문서 품질 점검
/def-audit --fix-purpose  — 짧은 purpose 보강
/def-audit --fix-tags     — 태그 미부여 문서에 태그 추가
/def-audit --fix-overview — overview 미작성 그룹에 overview 추가
```

## 전체 품질 리포트

```bash
node -e '
const fs=require("fs"),cp=require("child_process");
const files=cp.execSync("grep -rl \"lifecycle: approved\" docs/ 2>/dev/null",{encoding:"utf-8"}).trim().split("\n");

let total=0, issues=[];
for(const f of files){
  const c=fs.readFileSync(f,"utf-8");
  const fm=(c.match(/^---\n([\s\S]*?)\n---/)||["",""])[1];
  const id=(fm.match(/id: (.+)/)||["",""])[1];
  if(!id) continue;
  total++;

  // ^purpose 체크
  if(!c.includes("^purpose")) issues.push({id,issue:"^purpose 없음",severity:"high"});

  // purpose 길이 체크
  const lines=c.split("\n");
  let pStart=-1;
  for(let i=0;i<lines.length;i++){if(/^## .*\^purpose/.test(lines[i])){pStart=i+1;break}}
  if(pStart>0){
    let pEnd=lines.length;
    for(let i=pStart;i<lines.length;i++){if(/^## /.test(lines[i])){pEnd=i;break}}
    const pText=lines.slice(pStart,pEnd).filter(l=>l.trim()).join(" ");
    if(pText.length<30) issues.push({id,issue:"purpose 짧음 ("+pText.length+"자)",severity:"medium"});
  }

  // links 체크 (그룹 제외)
  if(!fm.includes("type: contains") && !fm.includes("target:"))
    issues.push({id,issue:"links 없음",severity:"medium"});

  // 그룹인데 ^overview 없으면
  if(fm.includes("type: contains") && !c.includes("^overview"))
    issues.push({id,issue:"그룹인데 ^overview 없음",severity:"low"});
}

console.log("총 "+total+"건, 이슈 "+issues.length+"건\n");
const bySeverity={high:[],medium:[],low:[]};
issues.forEach(i=>(bySeverity[i.severity]||[]).push(i));
for(const [sev,items] of Object.entries(bySeverity)){
  if(items.length===0) continue;
  console.log("["+sev+"] "+items.length+"건");
  items.slice(0,5).forEach(i=>console.log("  "+i.id+": "+i.issue));
  if(items.length>5) console.log("  ... 외 "+(items.length-5)+"건");
  console.log();
}
'
```

## 품질 기준

### ^purpose (필수)

| 등급 | 기준 | 조치 |
|------|------|------|
| 양호 | 30자 이상, 문서 정체성 설명 | — |
| 짧음 | 30자 미만 | 보강: "무엇을 하는가" + "왜 필요한가" 추가 |
| 없음 | ^purpose 마커 없음 | 긴급: `## 목적 ^purpose` 섹션 추가 |

### purpose 보강 가이드

좋은 purpose는 3가지를 포함한다:
1. **무엇**: 이 문서가 정의하는 것
2. **왜**: 이것이 필요한 이유 (1줄)
3. **범위**: 이 문서에 포함되는 것과 안 되는 것 (선택)

```
❌ "서비스 메타데이터 CRUD."
✅ "서비스 메타데이터(이름, tier, team, ownedPrefixes)를 등록/조회/삭제하는 REST API. 서비스 디스커버리의 입력 데이터."
```

### links (권장)

리프 문서에 최소 1개의 횡방향 관계를 선언한다.
`/def-link`로 추론 + 추가.

### ^overview (그룹 필수)

그룹 문서(depth: overview)에는 `## 구성 ^overview`가 필요하다.
멤버 수 + 각 멤버의 1줄 요약.

### tags (권장)

concern 태그(security, performance, observability 등)와
tier 태그(tier-frontend, tier-backend, tier-infra, tier-system)를 부여한다.

## 특정 문서 품질 점검

```bash
node -e '
const fs=require("fs"),cp=require("child_process");
const id="<문서ID>";
const f=cp.execSync(`grep -rl "  id: ${id}$" docs/ 2>/dev/null`,{encoding:"utf-8"}).trim().split("\n")[0];
const c=fs.readFileSync(f,"utf-8");
const fm=(c.match(/^---\n([\s\S]*?)\n---/)||["",""])[1];

console.log("=== "+id+" 품질 점검 ===\n");

// purpose
const hasPurpose=c.includes("^purpose");
console.log("^purpose: "+(hasPurpose?"✓":"✗"));

// overview
const hasOverview=c.includes("^overview");
console.log("^overview: "+(hasOverview?"✓":"—"));

// links
const hasLinks=fm.includes("target:");
console.log("links: "+(hasLinks?"✓ ("+((fm.match(/target:/g)||[]).length)+"건)":"✗"));

// tags
const hasTags=fm.includes("tags:");
console.log("tags: "+(hasTags?"✓":"✗"));

// svc
const hasSvc=fm.includes("svc:");
console.log("svc: "+(hasSvc?"✓":"—"));

// custom markers
const customMarkers=(c.match(/\^(?!purpose|overview)[a-z][a-z0-9-]*/g)||[]);
console.log("자유마커: "+(customMarkers.length>0?customMarkers.join(", "):"—"));
'
```
