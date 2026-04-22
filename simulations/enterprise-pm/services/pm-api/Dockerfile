# 시뮬 sim-pm-api — Plan 09c의 monorepo Dockerfile.service에 빌드 인자 전달
# 본 wrapper는 docker-compose.sim.yaml이 build context를 service-specific으로 지정할 때 사용한다.
ARG SERVICE_PATH=simulations/enterprise-pm/services/pm-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-pm-api

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 4500
CMD ["node", "dist/main.js"]
