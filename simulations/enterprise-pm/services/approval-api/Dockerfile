# 시뮬 sim-approval-api — Plan 09c의 monorepo Dockerfile.service에 빌드 인자 전달
# 본 wrapper는 docker-compose.sim.yaml이 build context를 service-specific으로 지정할 때 사용한다.
ARG SERVICE_PATH=simulations/enterprise-pm/services/approval-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-approval-api
# 단계 8(Plan C): catalog version axis 산출 태그 (grammar #3). 빌드 시점 stamp.
ARG SERVICE_VERSION=unknown

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ARG SERVICE_VERSION
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
# 컨테이너 자기 정체성 — runtime이 응답 헤더 / outbox payload / audit entry에 stamp.
ENV SIM_SERVICE_VERSION=${SERVICE_VERSION}
LABEL sim.role="approval-api"
LABEL sim.version="${SERVICE_VERSION}"
WORKDIR /app/${SERVICE_PATH}
EXPOSE 4600
CMD ["node", "dist/main.js"]
