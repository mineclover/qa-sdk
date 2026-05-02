# 시뮬 sim-audit-browser-api — Plan 09c의 monorepo Dockerfile.service에 빌드 인자 전달
ARG SERVICE_PATH=simulations/enterprise-pm/services/audit-browser-api
ARG SERVICE_PACKAGE=@qa-sdk/sim-audit-browser-api

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 5100
CMD ["node", "dist/main.js"]
