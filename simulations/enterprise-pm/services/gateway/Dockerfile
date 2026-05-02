# 시뮬 sim-gateway — Hono 기반 edge router
ARG SERVICE_PATH=simulations/enterprise-pm/services/gateway
ARG SERVICE_PACKAGE=@qa-sdk/sim-gateway

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 8888
CMD ["node", "dist/server.js"]
