# K3s 로컬 개발 환경 세팅 가이드

> infra-engine 로컬 배포 테스트를 위한 k3d (K3s in Docker) 환경 구성

## 사전 요구사항

- Docker Desktop 실행 중
- kubectl 설치 (`brew install kubectl`)
- k3d 설치 (`brew install k3d`)

## 1. 클러스터 생성

```bash
# qa-local 클러스터 생성 (단일 노드, traefik 비활성)
k3d cluster create qa-local \
  --servers 1 \
  --agents 0 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --k3s-arg "--disable=traefik@server:0" \
  --wait
```

| 옵션 | 설명 |
|------|------|
| `--servers 1` | 컨트롤 플레인 1개 (로컬이므로 충분) |
| `--agents 0` | 워커 노드 없음 (서버가 워커 겸용) |
| `--port 8080:80` | 호스트 8080 → 클러스터 80 (HTTP) |
| `--port 8443:443` | 호스트 8443 → 클러스터 443 (HTTPS) |
| `--disable=traefik` | 기본 ingress 비활성 (직접 NodePort 사용) |

## 2. 네임스페이스 생성

```bash
kubectl create namespace qa-dev
kubectl create namespace qa-stage
kubectl create namespace qa-prod
```

환경별 네임스페이스 분리:
- `qa-dev` — 개발 환경 배포
- `qa-stage` — 스테이징 환경 배포
- `qa-prod` — 프로덕션 환경 배포 (로컬 시뮬레이션)

## 3. 확인

```bash
# 클러스터 상태
kubectl cluster-info
kubectl get nodes

# 네임스페이스
kubectl get ns

# kubeconfig 확인 (Pulumi가 사용)
kubectl config current-context
# 출력: k3d-qa-local
```

## 4. 서비스 배포 테스트

infra-engine으로 서비스 배포 시 `local` 프로바이더가 kubectl/Pulumi를 통해 K3s에 배포합니다.

```bash
# 수동 테스트: nginx 배포
kubectl -n qa-dev run test-nginx --image=nginx:alpine --port=80
kubectl -n qa-dev expose pod test-nginx --type=NodePort --port=80
kubectl -n qa-dev get pods,svc

# 정리
kubectl -n qa-dev delete pod test-nginx
kubectl -n qa-dev delete svc test-nginx
```

## 5. 클러스터 관리

```bash
# 클러스터 중지 (Docker 컨테이너 정지, 상태 보존)
k3d cluster stop qa-local

# 클러스터 재시작
k3d cluster start qa-local

# 클러스터 삭제 (모든 데이터 제거)
k3d cluster delete qa-local

# 클러스터 목록
k3d cluster list
```

## 6. 리소스 사용량

| 항목 | 수치 |
|------|------|
| Docker 컨테이너 | 2개 (server + loadbalancer) |
| RAM | ~300MB |
| Disk | ~500MB (이미지 포함) |

## 7. Pulumi 연동

infra-engine의 `local` 프로바이더가 사용하는 kubeconfig:

```bash
# kubeconfig 경로 확인
echo $KUBECONFIG
# 또는
k3d kubeconfig get qa-local
```

Pulumi `@pulumi/kubernetes` 프로바이더는 `~/.kube/config`의 `k3d-qa-local` 컨텍스트를 자동 감지합니다.

## 트러블슈팅

### 포트 충돌
```bash
# 8080 포트 사용 중이면 다른 포트로 생성
k3d cluster create qa-local --port "9080:80@loadbalancer"
```

### Docker 리소스 부족
Docker Desktop → Settings → Resources에서 메모리를 4GB 이상으로 설정.

### kubeconfig 컨텍스트 전환
```bash
# k3d 클러스터로 전환
kubectl config use-context k3d-qa-local

# 현재 컨텍스트 확인
kubectl config current-context
```
