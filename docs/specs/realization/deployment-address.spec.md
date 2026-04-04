---
def:
  id: deployment-address
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: runtime-service-address
      type: depends_on
---
# DeploymentAddress

## 목적 ^purpose

provider/project/stack/resourceKey와 runtime target(env/region)을 결합한 배포 주소를 정의해 배포 대상을 완성된 주소 단위로 다룬다.

## ^defines

- `DeploymentAddress = serviceId + runtime(RuntimeServiceAddress) + provider + project + stack + resourceKey`
- `env/region` 없는 deployment ref는 미완성 주소로 취급한다.
- `urn`은 canonical address가 아니라 locator metadata다.

## provider별 locator metadata 규칙

| provider | project | stack | resourceKey | urn 형식 |
|---|---|---|---|---|
| `gcp` | GCP project ID | Pulumi stack name | Cloud Run service name / GKE deployment | `urn:gcp:{project}:{region}:{resourceType}/{resourceKey}` |
| `aws` | AWS account ID | CloudFormation stack | Lambda function name / ECS service | `urn:aws:{account}:{region}:{resourceType}/{resourceKey}` |
| `cloudflare` | Cloudflare account ID | — (stack 없음) | Worker name | `urn:cf:{account}:{resourceKey}` |
| `local` | `local` | `dev` | process name / port | — (urn 없음) |

- **urn은 locator**: canonical address가 아니라 provider가 발급한 식별자. 같은 서비스라도 provider마다 urn이 다름
- **resourceKey 유일성**: 같은 provider+project+stack 내에서 유일해야 함. 중복 시 `createDeploymentAddress`에서 에러
- **stack 미지원 provider**: `stack` 필드를 빈 문자열이 아닌 고정 값(`"default"`)으로 설정
- **env/region 필수**: `runtime.env`와 `runtime.region`이 없으면 미완성 주소. 배포 파이프라인에서 거부

## ^consumes

- `packages/registry-service/src/modules/services/service.types.ts`
- `packages/registry-service/src/modules/services/service-control-plane.ts`
