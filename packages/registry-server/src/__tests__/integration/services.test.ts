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

let app: Awaited<ReturnType<typeof createTestApp>>;

const defaultServiceBody: Required<CreateServiceBody> = {
  service_name: "mobile_app",
  display_name: "Mobile App",
  description: "Client-facing mobile application service.",
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

describe("services integration", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("POST /services", () => {
    it("creates a service and returns the created record", async () => {
      const body = await createService();

      expect(body).toMatchObject({
        service_id: expect.stringMatching(/^svc_/),
        service_name: "mobile_app",
        display_name: "Mobile App",
        description: "Client-facing mobile application service.",
        status: "active",
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(Date.parse(body.created_at)).not.toBeNaN();
      expect(Date.parse(body.updated_at)).not.toBeNaN();
    });

    it("returns 409 when service_name already exists", async () => {
      await createService();

      const response = await postJson("/services", defaultServiceBody);

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "SERVICE_NAME_CONFLICT",
        },
      });
    });

    it.each(["Mobile_App", "my-app", "1mobile_app"])(
      "returns 400 for invalid service_name %p",
      async (service_name) => {
        const response = await postJson("/services", {
          ...defaultServiceBody,
          service_name,
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
          error: {
            code: "INVALID_INPUT",
          },
        });
      },
    );

    it.each([
      {
        name: "missing service_name",
        body: {
          display_name: "Mobile App",
          description: "Client-facing mobile application service.",
        },
      },
      {
        name: "missing display_name",
        body: {
          service_name: "mobile_app",
          description: "Client-facing mobile application service.",
        },
      },
    ])("returns 400 for $name", async ({ body }) => {
      const response = await postJson("/services", body);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "INVALID_INPUT",
        },
      });
    });
  });

  describe("GET /services/:serviceName", () => {
    it("returns the full service object for an existing service", async () => {
      const created = await createService();

      const response = await app.request(`/services/${created.service_name}`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(created);
    });

    it("returns 404 when the service does not exist", async () => {
      const response = await app.request("/services/missing_service");

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "SERVICE_NOT_FOUND",
        },
      });
    });
  });

  describe("PATCH /services/:serviceId", () => {
    it("updates display_name and returns a newer updated_at timestamp", async () => {
      const created = await createService();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await patchJson(`/services/${created.service_id}`, {
        display_name: "Mobile Platform",
      });

      expect(response.status).toBe(200);

      const body = (await response.json()) as ServiceResponse;

      expect(body).toMatchObject({
        service_id: created.service_id,
        service_name: created.service_name,
        display_name: "Mobile Platform",
        description: created.description,
        status: "active",
        created_at: created.created_at,
        updated_at: expect.any(String),
      });
      expect(Date.parse(body.updated_at)).toBeGreaterThan(
        Date.parse(created.updated_at),
      );
    });

    it("updates status to deprecated", async () => {
      const created = await createService();

      const response = await patchJson(`/services/${created.service_id}`, {
        status: "deprecated",
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        service_id: created.service_id,
        status: "deprecated",
      });
    });

    it("returns 404 when the service does not exist", async () => {
      const response = await patchJson("/services/svc_missing", {
        display_name: "Mobile Platform",
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "SERVICE_NOT_FOUND",
        },
      });
    });

    it("returns 400 for an empty patch body", async () => {
      const created = await createService();

      const response = await patchJson(`/services/${created.service_id}`, {});

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: "INVALID_INPUT",
        },
      });
    });
  });
});
