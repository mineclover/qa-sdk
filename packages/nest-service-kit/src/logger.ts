// @def.boundary nest-service-bootstrap
// @def.doc nest-service-bootstrap

export interface ServiceLogger {
  info(metadata: Record<string, unknown>, message: string): void;
  warn(metadata: Record<string, unknown>, message: string): void;
  error(metadata: Record<string, unknown>, message: string): void;
}

export function createConsoleServiceLogger(serviceName: string): ServiceLogger {
  const prefix = `[${serviceName}]`;
  return {
    info(metadata, message) {
      console.log(prefix, message, metadata);
    },
    warn(metadata, message) {
      console.warn(prefix, message, metadata);
    },
    error(metadata, message) {
      console.error(prefix, message, metadata);
    },
  };
}
