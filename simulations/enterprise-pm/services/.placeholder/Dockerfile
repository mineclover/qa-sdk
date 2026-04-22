# Plan 10 전 build smoke 검증용 placeholder.
# Plan 10에서 ../<service-name>/Dockerfile 또는 공통 Dockerfile.service로 교체.
FROM node:22-alpine
WORKDIR /app
RUN echo 'console.log("placeholder service alive — Plan 10에서 NestJS로 교체"); setInterval(() => {}, 1000);' > main.js
HEALTHCHECK --interval=10s --timeout=3s CMD true
CMD ["node", "main.js"]
