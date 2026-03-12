import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { services } from "../../db/schema.js";
import { now } from "../../lib/clock.js";

export class ServiceRepository {
  constructor(private db: Db) {}

  async insert(data: typeof services.$inferInsert) {
    const [row] = await this.db.insert(services).values(data).returning();
    return row;
  }

  async findById(serviceId: string) {
    return this.db.query.services.findFirst({
      where: eq(services.serviceId, serviceId),
    });
  }

  async findByName(serviceName: string) {
    return this.db.query.services.findFirst({
      where: eq(services.serviceName, serviceName),
    });
  }

  async update(
    serviceId: string,
    data: Partial<Pick<typeof services.$inferInsert, "displayName" | "description" | "status">>,
  ) {
    const [row] = await this.db
      .update(services)
      .set({ ...data, updatedAt: now() })
      .where(eq(services.serviceId, serviceId))
      .returning();
    return row;
  }
}
