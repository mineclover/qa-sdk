import { Hono } from "hono";
import type { Db } from "./db/client.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./routes/health.js";
import { serviceRoutes } from "./routes/services.js";
import { eventRoutes } from "./routes/events.js";
import { ServiceRepository } from "./modules/services/service.repository.js";
import { ServiceService } from "./modules/services/service.service.js";
import { EventRepository } from "./modules/events/event.repository.js";
import { EventService } from "./modules/events/event.service.js";

export function createApp(db: Db) {
  const app = new Hono();

  // middleware
  app.use("*", requestId);
  app.use("*", requestLogger);

  // dependencies
  const serviceRepo = new ServiceRepository(db);
  const eventRepo = new EventRepository(db);
  const serviceSvc = new ServiceService(serviceRepo);
  const eventSvc = new EventService(eventRepo, serviceRepo, db);

  // routes
  app.route("/", healthRoutes(db));
  app.route("/", serviceRoutes(serviceSvc));
  app.route("/", eventRoutes(eventSvc));

  // error handler
  app.onError(errorHandler);

  return app;
}
