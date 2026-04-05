---
name: infra-deploy
description: "서비스 배포 — Pulumi + K3s 로컬 배포 파이프라인 실행. 5단계: Config→Provision→Register→Verify→Observe. 트리거: /infra-deploy, '배포', 'deploy', '서비스 올리기'."
---

# Infra Deploy — 서비스 배포

Pulumi Automation API로 서비스를 로컬 K3s 클러스터에 배포한다.
5단계 파이프라인: Config → Provision → Register → Verify → Observe.

## 사전 조건

- k3d 클러스터 실행 중: `k3d cluster list` → `qa-local`
- kubectl context: `k3d-qa-local`
- Pulumi CLI 설치: `pulumi version`
- registry-service 실행 중 (localhost:3300) — 선택 (미실행 시 mock)

### 클러스터 없으면

```bash
k3d cluster create qa-local \
  --servers 1 --agents 0 \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --k3s-arg "--disable=traefik@server:0" --wait

kubectl create namespace qa-dev
kubectl create namespace qa-stage
kubectl create namespace qa-prod
```

## 명령

```bash
cd packages/infra-engine

# nginx 테스트 배포 (이미지 빌드 불필요)
PULUMI_CONFIG_PASSPHRASE="" pnpm exec tsx scripts/deploy-local.ts nginx-test dev test-nginx.json

# 서비스 배포 (Docker 이미지 필요)
# 1. 이미지 빌드
docker build -t qa-sdk/ingest-server:latest -f Dockerfile.ingest-server .
# 2. k3d에 이미지 로드
k3d image import qa-sdk/ingest-server:latest -c qa-local
# 3. 배포
PULUMI_CONFIG_PASSPHRASE="" pnpm exec tsx scripts/deploy-local.ts ingest-server dev

# 다른 환경에 배포
PULUMI_CONFIG_PASSPHRASE="" pnpm exec tsx scripts/deploy-local.ts nginx-test stage test-nginx.json
```

### 인자

```
deploy-local.ts <service> <env> [config-file]
```

| 인자 | 설명 | 기본값 |
|------|------|--------|
| service | 서비스 ID | (필수) |
| env | 환경 (dev/stage/prod) | dev |
| config-file | 설정 JSON 파일명 | `{env}.json` |

## 파이프라인 출력

```
=== 배포 결과 ===
성공:     true
엔드포인트: http://127.0.0.1:20080
상태:     healthy
게이트:   pass
소요시간: 14509ms

스테이지별:
  config:    success (2ms)
  provision: success (14503ms)
  register:  success (1ms)
  verify:    success (3ms)
  observe:   success (0ms)
```

## 환경별 포트

| env | port offset | nginx(80) | ingest(3200) |
|-----|------------|-----------|--------------|
| dev | +20000 | 20080 | 23200 |
| stage | +21000 | 21080 | 24200 |
| prod | +22000 | 22080 | 25200 |

## 배포 후 확인

```bash
# K8s 리소스 확인
kubectl -n qa-dev get pods,svc

# 헬스체크
curl http://127.0.0.1:20080/

# 인프라 프로필 확인
cat ~/.qa-sdk/infra-profile.json

# 디스커버리로 확인
pnpm exec tsx scripts/discover.ts nginx-test dev
```

## 정리

```bash
# K8s 리소스 삭제
kubectl -n qa-dev delete deploy,svc --all

# Pulumi 상태 초기화
rm -rf ~/.pulumi-local/.pulumi

# port-forward 정리
pkill -f "port-forward"

# 클러스터 삭제
k3d cluster delete qa-local
```
