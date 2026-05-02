ARG SERVICE_PATH=simulations/enterprise-pm/services/metrics-collector
ARG SERVICE_PACKAGE=@qa-sdk/sim-metrics-collector

FROM qa-sdk/sim-base:latest AS final
ARG SERVICE_PATH
ARG SERVICE_PACKAGE
ENV SIM_SERVICE_PATH=${SERVICE_PATH}
ENV SIM_SERVICE_PACKAGE=${SERVICE_PACKAGE}
WORKDIR /app/${SERVICE_PATH}
EXPOSE 5200
CMD ["node", "dist/server.js"]
