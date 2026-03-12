import { and, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { serviceEvents } from "../../db/schema.js";
import {
  cleanupDb,
  closeTestDb,
  createTestApp,
  createTestDb,
} from "../helpers/setup.js";

type CreateServiceBody = {
  service_name?: string;
  display_name?: string;
  description?: string;
};

type ServiceResponse = {
  service_id: string;
  service_name: string;
  display_name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type CreateEventBody = {
  event_key?: string;
  display_name?: string;
  description?: string;
  record_kind?: "log" | "span" | "both";
  bump?: "major" | "minor" | "patch";
};

type EventResponse = {
  event_id: string;
  service_id: string;
  event_key: string;
  event_version: string;
  display_name: string;
  description: string | null;
  record_kind: string;
  status: string;
  created_at: string;
  updated_at: string;
};

let app: Awaited<ReturnType<typeof createTestApp>>;
let db: Awaited<ReturnType<typeof createTestDb>>;
let createdService: ServiceResponse;

const defaultServiceBody: Required<CreateServiceBody> = {
  service_name: "mobile_app",
  display_name: "Mobile App",
  description: "Client-facing mobile application service.",
};

const defaultEventBody: Required<CreateEventBody> = {
  event_key: "user_signed_in",
  display_name: "User Signed In",
  description: "Emitted when a user signs in.",
  record_kind: "log",
  bump: "major",
};

async function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function createService(
  body: CreateServiceBody = defaultServiceBody,
): Promise<ServiceResponse> {
  const response = await postJson("/services", body);

  expect(response.status).toBe(201);

  return (await response.json()) as ServiceResponse;
}

async function createEventRequest(
  body: CreateEventBody,
  serviceId: string = createdService.service_id,
) {
  const response = await postJson(`/services/${serviceId}/events`, body);

  return {
    status: response.status,
    body: (await response.json()) as EventResponse,
  };
}

async function listPersistedVersions(eventKey: string) {
  const rows = await db
    .select({ eventVersion: serviceEvents.eventVersion })
    .from(serviceEvents)
    .where(
      and(
        eq(serviceEvents.serviceId, createdService.service_id),
        eq(serviceEvents.eventKey, eventKey),
      ),
    )
    .orderBy(serviceEvents.eventVersion);

  return rows.map((row) => row.eventVersion);
}

describe("event concurrency integration", () => {
  beforeAll(async () => {
    db = await createTestDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDb();
    createdService = await createService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("assigns unique sequential major versions for 5 concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createEventRequest({
          ...defaultEventBody,
          display_name: `User Signed In ${index + 1}`,
          bump: "major",
        }),
      ),
    );

    expect(results.map(({ status }) => status)).toEqual([201, 201, 201, 201, 201]);

    const returnedVersions = results
      .map(({ body }) => body.event_version)
      .sort();

    expect(returnedVersions).toEqual(["1.0.0", "2.0.0", "3.0.0", "4.0.0", "5.0.0"]);
    expect(new Set(returnedVersions).size).toBe(5);

    for (const { body } of results) {
      expect(body.event_id).toMatch(/^evt_/);
      expect(body.service_id).toBe(createdService.service_id);
      expect(body.event_key).toBe(defaultEventBody.event_key);
    }
  });

  it("keeps event version sequences independent across concurrent keys", async () => {
    const eventKeyA = "event_key_a";
    const eventKeyB = "event_key_b";

    const results = await Promise.all([
      ...Array.from({ length: 3 }, (_, index) =>
        createEventRequest({
          ...defaultEventBody,
          event_key: eventKeyA,
          display_name: `Event Key A ${index + 1}`,
          bump: "major",
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        createEventRequest({
          ...defaultEventBody,
          event_key: eventKeyB,
          display_name: `Event Key B ${index + 1}`,
          record_kind: "span",
          bump: "major",
        }),
      ),
    ]);

    expect(results.map(({ status }) => status)).toEqual([
      201, 201, 201, 201, 201, 201,
    ]);

    const returnedVersionsByKey = new Map<string, string[]>();

    for (const { body } of results) {
      const versions = returnedVersionsByKey.get(body.event_key) ?? [];
      versions.push(body.event_version);
      returnedVersionsByKey.set(body.event_key, versions);
      expect(body.service_id).toBe(createdService.service_id);
      expect(body.event_id).toMatch(/^evt_/);
    }

    const expectedThree = ["1.0.0", "2.0.0", "3.0.0"];
    expect(returnedVersionsByKey.get(eventKeyA)?.sort()).toEqual(expectedThree);
    expect(returnedVersionsByKey.get(eventKeyB)?.sort()).toEqual(expectedThree);
  });
});
