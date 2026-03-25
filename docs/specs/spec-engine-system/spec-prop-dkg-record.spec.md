---
def:
  id: spec-prop-dkg-record
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dkg-node-types
      type: depends_on
---

# Spec Propagation — 4단계: DKG Record

## 목적 ^purpose

스펙 변경을 DKG 그래프에 기록하는 4단계. VersionEvent + Decision 노드 생성.

---

## 기록 로직

activate 시 DKG에 자동 기록한다.

```
activate("permission", "v5"):

  1. VersionEvent.fromDiff:
     diff = registryService.diffVersions("v4", "v5")
     -> VE-permission-v4-v5

  2. Decision (있으면):
     사전에 scaffoldDecision()으로 생성한 DEC-xxx 연결

  3. graph.addEdge("justifies", DEC-xxx, VE-permission-v4-v5)
```

dkg-skills.md에서 정의한 `versionEventFromDiff()`를 여기서 호출한다.

---

## 종단 시나리오: 새 prefix 기록

```
versionEventFromDiff(diff, { date: "2026-03-20" })
-> VE-tracking-none-v1 (첫 버전)
```

---

## 종단 시나리오: version 업그레이드 기록

```
versionEventFromDiff(diff, { date: "2026-03-20" })
-> VE-permission-v4-v5 { changes: [{ kind: "capacity-changed", detail: "role max 8->16" }] }
```
