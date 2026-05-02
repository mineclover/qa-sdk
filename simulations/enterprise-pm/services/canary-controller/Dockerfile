# 시뮬 sim-canary-controller — sim-base 멀티스테이지 wrapper.
# 본 wrapper는 docker-compose.sim.yaml이 build context를 service-specific으로 지정할 때 사용한다.
ARG SERVICE_PATH=simulations/enterprise-pm/services/canary-controller
ARG SERVICE_PACKAGE=@qa-sdk/sim-canary-controller

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 5300
CMD ["node", "dist/main.js"]
