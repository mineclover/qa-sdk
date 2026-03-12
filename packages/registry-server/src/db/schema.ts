import {
  pgTable,
  text,
  timestamp,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const services = pgTable(
  "services",
  {
    serviceId: text("service_id").primaryKey(),
    serviceName: text("service_name").notNull().unique(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "services_service_name_format",
      sql`${table.serviceName} ~ '^[a-z][a-z0-9_]*$'`,
    ),
    check(
      "services_status_check",
      sql`${table.status} in ('active', 'deprecated', 'retired')`,
    ),
  ],
);

export const serviceEvents = pgTable(
  "service_events",
  {
    eventId: text("event_id").primaryKey(),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.serviceId, { onDelete: "restrict" }),
    eventKey: text("event_key").notNull(),
    eventVersion: text("event_version").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    recordKind: text("record_kind").notNull().default("log"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_service_event_version").on(
      table.serviceId,
      table.eventKey,
      table.eventVersion,
    ),
    index("idx_service_events_service_id").on(table.serviceId),
    index("idx_service_events_lookup").on(
      table.serviceId,
      table.eventKey,
      table.eventVersion,
    ),
    check(
      "service_events_event_key_format",
      sql`${table.eventKey} ~ '^[a-z][a-z0-9_]*$'`,
    ),
    check(
      "service_events_event_version_format",
      sql`${table.eventVersion} ~ '^\\d+\\.\\d+\\.\\d+$'`,
    ),
    check(
      "service_events_record_kind_check",
      sql`${table.recordKind} in ('log', 'span', 'both')`,
    ),
    check(
      "service_events_status_check",
      sql`${table.status} in ('active', 'deprecated', 'retired')`,
    ),
  ],
);
