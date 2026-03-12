import { eq, and, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { serviceEvents } from "../../db/schema.js";
import { now } from "../../lib/clock.js";

const versionOrder = sql`string_to_array(${serviceEvents.eventVersion}, '.')::int[]`;

export class EventRepository {
  constructor(private db: Db) {}

  async insert(data: typeof serviceEvents.$inferInsert) {
    const [row] = await this.db
      .insert(serviceEvents)
      .values(data)
      .returning();
    return row;
  }

  async findById(eventId: string) {
    return this.db.query.serviceEvents.findFirst({
      where: eq(serviceEvents.eventId, eventId),
    });
  }

  async findByVersion(serviceId: string, eventKey: string, eventVersion: string) {
    return this.db.query.serviceEvents.findFirst({
      where: and(
        eq(serviceEvents.serviceId, serviceId),
        eq(serviceEvents.eventKey, eventKey),
        eq(serviceEvents.eventVersion, eventVersion),
      ),
    });
  }

  async listVersions(serviceId: string, eventKey: string) {
    return this.db
      .select()
      .from(serviceEvents)
      .where(
        and(
          eq(serviceEvents.serviceId, serviceId),
          eq(serviceEvents.eventKey, eventKey),
        ),
      )
      .orderBy(versionOrder);
  }

  async getLatestVersion(serviceId: string, eventKey: string) {
    const [row] = await this.db
      .select({ eventVersion: serviceEvents.eventVersion })
      .from(serviceEvents)
      .where(
        and(
          eq(serviceEvents.serviceId, serviceId),
          eq(serviceEvents.eventKey, eventKey),
        ),
      )
      .orderBy(sql`${versionOrder} desc`)
      .limit(1);
    return row?.eventVersion ?? null;
  }

  async acquireAdvisoryLock(serviceId: string, eventKey: string) {
    await this.db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${serviceId} || ':' || ${eventKey}))`,
    );
  }

  async update(
    eventId: string,
    data: Partial<
      Pick<typeof serviceEvents.$inferInsert, "displayName" | "description" | "status">
    >,
  ) {
    const [row] = await this.db
      .update(serviceEvents)
      .set({ ...data, updatedAt: now() })
      .where(eq(serviceEvents.eventId, eventId))
      .returning();
    return row;
  }
}
