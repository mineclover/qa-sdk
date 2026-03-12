import { Hono } from "hono";
import type { ServiceService } from "../modules/services/service.service.js";
import {
  createServiceSchema,
  updateServiceSchema,
} from "../modules/services/service.schema.js";

export function serviceRoutes(svc: ServiceService) {
  const app = new Hono();

  app.post("/services", async (c) => {
    const body = await c.req.json();
    const input = createServiceSchema.parse(body);
    const result = await svc.create(input);
    return c.json(result, 201);
  });

  app.get("/services/:serviceName", async (c) => {
    const serviceName = c.req.param("serviceName");
    const result = await svc.getByName(serviceName);
    return c.json(result);
  });

  app.patch("/services/:serviceId", async (c) => {
    const serviceId = c.req.param("serviceId");
    const body = await c.req.json();
    const input = updateServiceSchema.parse(body);
    const result = await svc.update(serviceId, input);
    return c.json(result);
  });

  return app;
}
