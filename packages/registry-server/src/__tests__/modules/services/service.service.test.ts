import { describe, expect, it, vi } from "vitest";
import { ServiceService } from "../../../modules/services/service.service.js";
import type { ServiceRepository } from "../../../modules/services/service.repository.js";

type ServiceRow = {
  serviceId: string;
  serviceName: string;
  displayName: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function buildServiceRow(overrides: Partial<ServiceRow> = {}): ServiceRow {
  return {
    serviceId: "svc_01HXYZABCDEF1234567890",
    serviceName: "mobile_app",
    displayName: "Mobile App",
    description: "Client-facing mobile application service.",
    status: "active",
    createdAt: new Date("2026-03-12T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  };
}

function createRepoMock() {
  const repo = {
    findByName: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  const service = new ServiceService(repo as unknown as ServiceRepository);

  return { repo, service };
}

describe("ServiceService", () => {
  describe("create", () => {
    it("returns a Service with a generated svc_ ID on the happy path", async () => {
      const { repo, service } = createRepoMock();
      const createdAt = new Date("2026-03-12T01:00:00.000Z");
      const updatedAt = new Date("2026-03-12T01:00:00.000Z");

      repo.findByName.mockResolvedValue(undefined);
      repo.insert.mockImplementation(async (data) =>
        buildServiceRow({
          serviceId: data.serviceId,
          serviceName: data.serviceName,
          displayName: data.displayName,
          description: data.description,
          createdAt,
          updatedAt,
        }),
      );

      const result = await service.create({
        service_name: "mobile_app",
        display_name: "Mobile App",
      });

      expect(repo.findByName).toHaveBeenCalledWith("mobile_app");
      expect(repo.insert).toHaveBeenCalledWith({
        serviceId: expect.stringMatching(/^svc_/),
        serviceName: "mobile_app",
        displayName: "Mobile App",
        description: null,
      });
      expect(result).toEqual({
        service_id: expect.stringMatching(/^svc_/),
        service_name: "mobile_app",
        display_name: "Mobile App",
        description: null,
        status: "active",
        created_at: createdAt,
        updated_at: updatedAt,
      });
    });

    it("throws SERVICE_NAME_CONFLICT when service_name already exists", async () => {
      const { repo, service } = createRepoMock();

      repo.findByName.mockResolvedValue(buildServiceRow());

      await expect(
        service.create({
          service_name: "mobile_app",
          display_name: "Mobile App",
        }),
      ).rejects.toMatchObject({
        code: "SERVICE_NAME_CONFLICT",
        statusCode: 409,
      });

      expect(repo.findByName).toHaveBeenCalledWith("mobile_app");
      expect(repo.insert).not.toHaveBeenCalled();
    });
  });

  describe("getByName", () => {
    it("returns a Service when found", async () => {
      const { repo, service } = createRepoMock();
      const row = buildServiceRow();

      repo.findByName.mockResolvedValue(row);

      await expect(service.getByName("mobile_app")).resolves.toEqual({
        service_id: row.serviceId,
        service_name: row.serviceName,
        display_name: row.displayName,
        description: row.description,
        status: row.status,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      });
      expect(repo.findByName).toHaveBeenCalledWith("mobile_app");
    });

    it("throws SERVICE_NOT_FOUND when the service does not exist", async () => {
      const { repo, service } = createRepoMock();

      repo.findByName.mockResolvedValue(undefined);

      await expect(service.getByName("missing_service")).rejects.toMatchObject({
        code: "SERVICE_NOT_FOUND",
        statusCode: 404,
      });
      expect(repo.findByName).toHaveBeenCalledWith("missing_service");
    });
  });

  describe("getById", () => {
    it("returns a Service when found", async () => {
      const { repo, service } = createRepoMock();
      const row = buildServiceRow();

      repo.findById.mockResolvedValue(row);

      await expect(service.getById(row.serviceId)).resolves.toEqual({
        service_id: row.serviceId,
        service_name: row.serviceName,
        display_name: row.displayName,
        description: row.description,
        status: row.status,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      });
      expect(repo.findById).toHaveBeenCalledWith(row.serviceId);
    });

    it("throws SERVICE_NOT_FOUND when the service does not exist", async () => {
      const { repo, service } = createRepoMock();

      repo.findById.mockResolvedValue(undefined);

      await expect(service.getById("svc_missing")).rejects.toMatchObject({
        code: "SERVICE_NOT_FOUND",
        statusCode: 404,
      });
      expect(repo.findById).toHaveBeenCalledWith("svc_missing");
    });
  });

  describe("update", () => {
    it("returns the updated Service with a new updatedAt timestamp", async () => {
      const { repo, service } = createRepoMock();
      const existing = buildServiceRow({
        updatedAt: new Date("2026-03-12T01:00:00.000Z"),
      });
      const nextUpdatedAt = new Date("2026-03-12T02:00:00.000Z");

      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(
        buildServiceRow({
          serviceId: existing.serviceId,
          serviceName: existing.serviceName,
          displayName: "Mobile Platform",
          description: "Updated description",
          updatedAt: nextUpdatedAt,
        }),
      );

      const result = await service.update(existing.serviceId, {
        display_name: "Mobile Platform",
        description: "Updated description",
      });

      expect(repo.findById).toHaveBeenCalledWith(existing.serviceId);
      expect(repo.update).toHaveBeenCalledWith(existing.serviceId, {
        displayName: "Mobile Platform",
        description: "Updated description",
      });
      expect(result).toEqual({
        service_id: existing.serviceId,
        service_name: existing.serviceName,
        display_name: "Mobile Platform",
        description: "Updated description",
        status: existing.status,
        created_at: existing.createdAt,
        updated_at: nextUpdatedAt,
      });
      expect(result.updated_at.getTime()).toBeGreaterThan(existing.updatedAt.getTime());
    });

    it("throws SERVICE_NOT_FOUND when serviceId does not exist", async () => {
      const { repo, service } = createRepoMock();

      repo.findById.mockResolvedValue(undefined);

      await expect(
        service.update("svc_missing", { display_name: "Mobile Platform" }),
      ).rejects.toMatchObject({
        code: "SERVICE_NOT_FOUND",
        statusCode: 404,
      });

      expect(repo.findById).toHaveBeenCalledWith("svc_missing");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: "display_name only",
        input: { display_name: "Mobile Platform" },
        expectedPatch: { displayName: "Mobile Platform" },
        updatedOverrides: { displayName: "Mobile Platform" },
      },
      {
        name: "description only",
        input: { description: null },
        expectedPatch: { description: null },
        updatedOverrides: { description: null },
      },
      {
        name: "status only",
        input: { status: "deprecated" as const },
        expectedPatch: { status: "deprecated" as const },
        updatedOverrides: { status: "deprecated" },
      },
    ])("supports partial updates for $name", async ({ input, expectedPatch, updatedOverrides }) => {
      const { repo, service } = createRepoMock();
      const existing = buildServiceRow();

      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(
        buildServiceRow({
          ...existing,
          ...updatedOverrides,
          updatedAt: new Date("2026-03-12T03:00:00.000Z"),
        }),
      );

      const result = await service.update(existing.serviceId, input);

      expect(repo.update).toHaveBeenCalledWith(existing.serviceId, expectedPatch);
      expect(result).toMatchObject({
        service_id: existing.serviceId,
        service_name: existing.serviceName,
      });
    });
  });
});
