import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  cleanupDb,
  closeTestDb,
  createTestApp,
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

type EventWithServiceNameResponse = EventResponse & {
  service_name: string;
};

type EventVersionListResponse = {
  service_name: string;
  event_key: string;
  versions: Array<{
    event_id: string;
    event_version: string;
    display_name: string;
    record_kind: string;
    status: string;
  }>;
};

let app: Awaited<ReturnType<typeof createTestApp>>;
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

async function patchJson(path: string, body: unknown) {
  return app.request(path, {
    method: "PATCH",
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

async function createEvent(
  body: CreateEventBody = defaultEventBody,
  serviceId: string = createdService.service_id,
): Promise<EventResponse> {
  const response = await postJson(`/services/${serviceId}/events`, body);

  expect(response.status).toBe(201);

  return (await response.json()) as EventResponse;
}

describe("events integration", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDb();
    createdService = await createService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("POST /services/:serviceId/events", () => {
    it("assigns version 1.0.0 to the first event for a key", async () => {
      const body = await createEvent();

      expect(body).toMatchObject({
        event_id: expect.stringMatching(/^evt_/),
        service_id: createdService.service_id,
        event_key: "user_signed_in",
        event_version: "1.0.0",
        display_name: "User Signed In",
        record_kind: "log",
        status: "active",
      });
    });

    it("bumps major version by default", async () => {
      const first = await createEvent();
      const second = await createEvent({
        ...defaultEventBody,
        display_name: "User Signed In v2",
      });

      expect(first.event_version).toBe("1.0.0");
      expect(second.event_version).toBe("2.0.0");
    });

    it("bumps minor version when requested", async () => {
      const first = await createEvent();
      const second = await createEvent({
        ...defaultEventBody,
        display_name: "User Signed In v1.1",
        bump: "minor",
      });

      expect(first.event_version).toBe("1.0.0");
      expect(second.event_version).toBe("1.1.0");
    });

    it("bumps patch version when requested", async () => {
      const first = await createEvent();
      const second = await createEvent({
        ...defaultEventBody,
        display_name: "User Signed In fix",
        bump: "patch",
      });

      expect(first.event_version).toBe("1.0.0");
      expect(second.event_version).toBe("1.0.1");
    });

    it("starts a different event_key at version 1.0.0 independently", async () => {
      await createEvent();

      const response = await createEvent({
        event_key: "user_signed_out",
        display_name: "User Signed Out",
        description: "Emitted when a user signs out.",
        record_kind: "span",
        bump: "major",
      });

      expect(response).toMatchObject({
        event_key: "user_signed_out",
        event_version: "1.0.0",
      });
    });

    it("returns 404 for a non-existent service", async () => {
      const response = await postJson("/services/svc_missing/events", defaultEventBody);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "SERVICE_NOT_FOUND" },
      });
    });

    it.each(["UserSignedIn", "user-signed-in", "1user_signed_in"])(
      "returns 400 for invalid event_key %p",
      async (event_key) => {
        const response = await postJson(
          `/services/${createdService.service_id}/events`,
          { ...defaultEventBody, event_key },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
          error: { code: "INVALID_INPUT" },
        });
      },
    );
  });

  describe("GET /services/:serviceName/events/:eventKey", () => {
    it("returns versions sorted ascending", async () => {
      const first = await createEvent();
      const second = await createEvent({
        ...defaultEventBody,
        display_name: "User Signed In v1.1",
        bump: "minor",
      });
      // different key — should not appear
      await createEvent({
        event_key: "user_signed_out",
        display_name: "User Signed Out",
        record_kind: "both",
        bump: "major",
      });

      const response = await app.request(
        `/services/${createdService.service_name}/events/user_signed_in`,
      );

      expect(response.status).toBe(200);

      const body = (await response.json()) as EventVersionListResponse;

      expect(body).toEqual({
        service_name: createdService.service_name,
        event_key: "user_signed_in",
        versions: [
          {
            event_id: first.event_id,
            event_version: "1.0.0",
            display_name: "User Signed In",
            record_kind: "log",
            status: "active",
          },
          {
            event_id: second.event_id,
            event_version: "1.1.0",
            display_name: "User Signed In v1.1",
            record_kind: "log",
            status: "active",
          },
        ],
      });
    });

    it("returns 404 when the event does not exist", async () => {
      const response = await app.request(
        `/services/${createdService.service_name}/events/missing_event`,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /services/:serviceName/events/:eventKey/versions/:eventVersion", () => {
    it("returns a specific version with service_name included", async () => {
      await createEvent();
      const v2 = await createEvent({
        ...defaultEventBody,
        display_name: "User Signed In v2",
        bump: "major",
      });

      const response = await app.request(
        `/services/${createdService.service_name}/events/user_signed_in/versions/2.0.0`,
      );

      expect(response.status).toBe(200);

      const body = (await response.json()) as EventWithServiceNameResponse;

      expect(body).toEqual({
        ...v2,
        service_name: createdService.service_name,
      });
    });

    it("returns 404 when the requested version does not exist", async () => {
      await createEvent();

      const response = await app.request(
        `/services/${createdService.service_name}/events/user_signed_in/versions/99.0.0`,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /events/:eventId", () => {
    it("updates display_name and description", async () => {
      const created = await createEvent();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await patchJson(`/events/${created.event_id}`, {
        display_name: "User Login",
        description: "Updated event description.",
      });

      expect(response.status).toBe(200);

      const body = (await response.json()) as EventResponse;

      expect(body).toMatchObject({
        event_id: created.event_id,
        event_version: "1.0.0",
        display_name: "User Login",
        description: "Updated event description.",
      });
      expect(Date.parse(body.updated_at)).toBeGreaterThan(
        Date.parse(created.updated_at),
      );
    });

    it("updates status to deprecated", async () => {
      const created = await createEvent();

      const response = await patchJson(`/events/${created.event_id}`, {
        status: "deprecated",
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        event_id: created.event_id,
        status: "deprecated",
      });
    });

    it("returns 404 when the event does not exist", async () => {
      const response = await patchJson("/events/evt_missing", {
        display_name: "User Login",
      });

      expect(response.status).toBe(404);
    });
  });
});
