---
def:
  id: decode-deploy
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
---
# Decode 배포 토폴로지

## 목적 ^purpose

Decode Service의 3가지 배포 형태와 각각의 제약 조건을 정의한다.

## 배포 형태 ^constraint

- **Embedded**: 애플리케이션 프로세스 내부에서 직접 호출. 네트워크 비용 없음. DecodeMap을 메모리에 보유.
- **Sidecar**: 같은 노드의 별도 프로세스. localhost 호출. Edge Worker에서 사용.
- **Standalone**: 독립 서비스. 네트워크 호출. 중앙 집중 캐시 관리.
