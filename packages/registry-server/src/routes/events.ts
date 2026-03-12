import { Hono } from "hono";
import type { EventService } from "../modules/events/event.service.js";
import {
  createEventSchema,
  updateEventSchema,
} from "../modules/events/event.schema.js";

export function eventRoutes(svc: EventService) {
  const app = new Hono();

  app.post("/services/:serviceId/events", async (c) => {
    const serviceId = c.req.param("serviceId");
    const body = await c.req.json();
    const input = createEventSchema.parse(body);
    const result = await svc.create(serviceId, input);
    return c.json(result, 201);
  });

  app.get("/services/:serviceName/events/:eventKey", async (c) => {
    const serviceName = c.req.param("serviceName");
    const eventKey = c.req.param("eventKey");
    const result = await svc.getVersions(serviceName, eventKey);
    return c.json(result);
  });

  app.get(
    "/services/:serviceName/events/:eventKey/versions/:eventVersion",
    async (c) => {
      const serviceName = c.req.param("serviceName");
      const eventKey = c.req.param("eventKey");
      const eventVersion = c.req.param("eventVersion");
      const result = await svc.getByVersion(serviceName, eventKey, eventVersion);
      return c.json(result);
    },
  );

  app.patch("/events/:eventId", async (c) => {
    const eventId = c.req.param("eventId");
    const body = await c.req.json();
    const input = updateEventSchema.parse(body);
    const result = await svc.update(eventId, input);
    return c.json(result);
  });

  return app;
}
