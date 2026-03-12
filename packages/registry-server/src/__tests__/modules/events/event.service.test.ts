import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../modules/events/event.repository.js", () => ({
  EventRepository: vi.fn(),
}));

import { EventService } from "../../../modules/events/event.service.js";
import { EventRepository } from "../../../modules/events/event.repository.js";
import type { EventRepository as EventRepositoryType } from "../../../modules/events/event.repository.js";
import type { ServiceRepository } from "../../../modules/services/service.repository.js";
import type { Db } from "../../../db/client.js";

type ServiceRow = {
  serviceId: string;
  serviceName: string;
  displayName: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  eventId: string;
  serviceId: string;
  eventKey: string;
  eventVersion: string;
  displayName: string;
  description: string | null;
  recordKind: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type EventInsert = {
  eventId: string;
  serviceId: string;
  eventKey: string;
  eventVersion: string;
  displayName: string;
  description: string | null;
  recordKind: string;
};

type EventRepoMock = {
  listVersions: ReturnType<typeof vi.fn>;
  findByVersion: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

type TxEventRepoMock = {
  acquireAdvisoryLock: ReturnType<typeof vi.fn>;
  getLatestVersion: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

type ServiceRepoMock = {
  findById: ReturnType<typeof vi.fn>;
  findByName: ReturnType<typeof vi.fn>;
};

type MockedEventRepositoryConstructor = {
  mockImplementation: (fn: (dbLike: object) => object) => void;
  mockClear: () => void;
  mock: { calls: unknown[][] };
};

const eventRepositoryCtor =
  EventRepository as unknown as MockedEventRepositoryConstructor;

function buildServiceRow(overrides: Partial<ServiceRow> = {}): ServiceRow {
  return {
    serviceId: "svc_01HXZY1234567890ABCDEFGHJK",
    serviceName: "mobile_app",
    displayName: "Mobile App",
    description: "Client-facing mobile application service.",
    status: "active",
    createdAt: new Date("2026-03-12T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  };
}

function buildEventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    eventId: "evt_01HXZY1234567890ABCDEFGHJK",
    serviceId: "svc_01HXZY1234567890ABCDEFGHJK",
    eventKey: "user_signed_in",
    eventVersion: "1.0.0",
    displayName: "User Signed In",
    description: "Emitted when a user signs in.",
    recordKind: "log",
    status: "active",
    createdAt: new Date("2026-03-12T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  };
}

function mockInsertedEvent(txRepo: TxEventRepoMock) {
  txRepo.insert.mockImplementation(async (data: EventInsert) =>
    buildEventRow({
      eventId: data.eventId,
      serviceId: data.serviceId,
      eventKey: data.eventKey,
      eventVersion: data.eventVersion,
      displayName: data.displayName,
      description: data.description,
      recordKind: data.recordKind,
    }),
  );
}

function createDeps() {
  const eventRepo: EventRepoMock = {
    listVersions: vi.fn(),
    findByVersion: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const txRepo: TxEventRepoMock = {
    acquireAdvisoryLock: vi.fn(),
    getLatestVersion: vi.fn(),
    insert: vi.fn(),
  };
  const serviceRepo: ServiceRepoMock = {
    findById: vi.fn(),
    findByName: vi.fn(),
  };
  const db = {
    transaction: vi.fn(
      async (callback: (tx: TxEventRepoMock) => Promise<unknown>) =>
        callback(txRepo),
    ),
  };

  const service = new EventService(
    eventRepo as unknown as EventRepositoryType,
    serviceRepo as unknown as ServiceRepository,
    db as unknown as Db,
  );

  return { service, eventRepo, txRepo, serviceRepo, db };
}

describe("EventService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventRepositoryCtor.mockImplementation((dbLike: object) => dbLike);
  });

  describe("create", () => {
    it("assigns event_version 1.0.0 for the first event on a key", async () => {
      const { service, serviceRepo, txRepo, db } = createDeps();

      serviceRepo.findById.mockResolvedValue(buildServiceRow());
      txRepo.getLatestVersion.mockResolvedValue(null);
      mockInsertedEvent(txRepo);

      const result = await service.create("svc_01HXZY1234567890ABCDEFGHJK", {
        event_key: "user_signed_in",
        display_name: "User Signed In",
        record_kind: "log",
        bump: "major",
      });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(txRepo.acquireAdvisoryLock).toHaveBeenCalledWith(
        "svc_01HXZY1234567890ABCDEFGHJK",
        "user_signed_in",
      );
      expect(txRepo.insert).toHaveBeenCalledWith({
        eventId: expect.stringMatching(/^evt_/),
        serviceId: "svc_01HXZY1234567890ABCDEFGHJK",
        eventKey: "user_signed_in",
        eventVersion: "1.0.0",
        displayName: "User Signed In",
        description: null,
        recordKind: "log",
      });
      expect(result.event_version).toBe("1.0.0");
    });

    it("bumps major version", async () => {
      const { service, serviceRepo, txRepo } = createDeps();

      serviceRepo.findById.mockResolvedValue(buildServiceRow());
      txRepo.getLatestVersion.mockResolvedValue("1.2.3");
      mockInsertedEvent(txRepo);

      const result = await service.create("svc_01HXZY1234567890ABCDEFGHJK", {
        event_key: "user_signed_in",
        display_name: "User Signed In",
        record_kind: "log",
        bump: "major",
      });

      expect(result.event_version).toBe("2.0.0");
    });

    it("bumps minor version", async () => {
      const { service, serviceRepo, txRepo } = createDeps();

      serviceRepo.findById.mockResolvedValue(buildServiceRow());
      txRepo.getLatestVersion.mockResolvedValue("1.0.0");
      mockInsertedEvent(txRepo);

      const result = await service.create("svc_01HXZY1234567890ABCDEFGHJK", {
        event_key: "user_signed_in",
        display_name: "User Signed In",
        record_kind: "log",
        bump: "minor",
      });

      expect(result.event_version).toBe("1.1.0");
    });

    it("bumps patch version", async () => {
      const { service, serviceRepo, txRepo } = createDeps();

      serviceRepo.findById.mockResolvedValue(buildServiceRow());
      txRepo.getLatestVersion.mockResolvedValue("2.1.0");
      mockInsertedEvent(txRepo);

      const result = await service.create("svc_01HXZY1234567890ABCDEFGHJK", {
        event_key: "user_signed_in",
        display_name: "User Signed In",
        record_kind: "log",
        bump: "patch",
      });

      expect(result.event_version).toBe("2.1.1");
    });

    it("throws SERVICE_NOT_FOUND when the service does not exist", async () => {
      const { service, serviceRepo, db } = createDeps();

      serviceRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.create("svc_missing", {
          event_key: "user_signed_in",
          display_name: "User Signed In",
          record_kind: "log",
          bump: "major",
        }),
      ).rejects.toMatchObject({
        code: "SERVICE_NOT_FOUND",
        statusCode: 404,
      });

      expect(db.transaction).not.toHaveBeenCalled();
    });

    it("acquires the advisory lock before reading the latest version", async () => {
      const { service, serviceRepo, txRepo } = createDeps();
      const callOrder: string[] = [];

      serviceRepo.findById.mockResolvedValue(buildServiceRow());
      txRepo.acquireAdvisoryLock.mockImplementation(async () => {
        callOrder.push("lock");
      });
      txRepo.getLatestVersion.mockImplementation(async () => {
        callOrder.push("read-version");
        return "1.0.0";
      });
      txRepo.insert.mockImplementation(async (data: EventInsert) => {
        callOrder.push("insert");
        return buildEventRow({
          eventId: data.eventId,
          serviceId: data.serviceId,
          eventKey: data.eventKey,
          eventVersion: data.eventVersion,
          displayName: data.displayName,
          description: data.description,
          recordKind: data.recordKind,
        });
      });

      await service.create("svc_01HXZY1234567890ABCDEFGHJK", {
        event_key: "user_signed_in",
        display_name: "User Signed In",
        record_kind: "log",
        bump: "major",
      });

      expect(callOrder).toEqual(["lock", "read-version", "insert"]);
    });
  });

  describe("getVersions", () => {
    it("returns all versions for an event key in sorted order", async () => {
      const { service, serviceRepo, eventRepo } = createDeps();
      const serviceRow = buildServiceRow();
      const v1 = buildEventRow({
        eventId: "evt_01",
        eventVersion: "1.0.0",
      });
      const v11 = buildEventRow({
        eventId: "evt_02",
        eventVersion: "1.1.0",
        recordKind: "span",
      });
      const v2 = buildEventRow({
        eventId: "evt_03",
        eventVersion: "2.0.0",
        status: "deprecated",
      });

      serviceRepo.findByName.mockResolvedValue(serviceRow);
      eventRepo.listVersions.mockResolvedValue([v1, v11, v2]);

      await expect(
        service.getVersions(serviceRow.serviceName, "user_signed_in"),
      ).resolves.toEqual({
        service_name: serviceRow.serviceName,
        event_key: "user_signed_in",
        versions: [
          {
            event_id: "evt_01",
            event_version: "1.0.0",
            display_name: v1.displayName,
            record_kind: v1.recordKind,
            status: v1.status,
          },
          {
            event_id: "evt_02",
            event_version: "1.1.0",
            display_name: v11.displayName,
            record_kind: v11.recordKind,
            status: v11.status,
          },
          {
            event_id: "evt_03",
            event_version: "2.0.0",
            display_name: v2.displayName,
            record_kind: v2.recordKind,
            status: v2.status,
          },
        ],
      });
    });

    it("throws SERVICE_NOT_FOUND when the service does not exist", async () => {
      const { service, serviceRepo, eventRepo } = createDeps();

      serviceRepo.findByName.mockResolvedValue(undefined);

      await expect(
        service.getVersions("missing_service", "user_signed_in"),
      ).rejects.toMatchObject({
        code: "SERVICE_NOT_FOUND",
        statusCode: 404,
      });

      expect(eventRepo.listVersions).not.toHaveBeenCalled();
    });

    it("throws EVENT_NOT_FOUND when no versions exist for the event key", async () => {
      const { service, serviceRepo, eventRepo } = createDeps();
      const serviceRow = buildServiceRow();

      serviceRepo.findByName.mockResolvedValue(serviceRow);
      eventRepo.listVersions.mockResolvedValue([]);

      await expect(
        service.getVersions(serviceRow.serviceName, "user_signed_in"),
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("getByVersion", () => {
    it("returns an EventWithServiceName when the version exists", async () => {
      const { service, serviceRepo, eventRepo } = createDeps();
      const serviceRow = buildServiceRow();
      const eventRow = buildEventRow({
        eventVersion: "2.1.0",
        recordKind: "both",
      });

      serviceRepo.findByName.mockResolvedValue(serviceRow);
      eventRepo.findByVersion.mockResolvedValue(eventRow);

      await expect(
        service.getByVersion(serviceRow.serviceName, "user_signed_in", "2.1.0"),
      ).resolves.toEqual({
        event_id: eventRow.eventId,
        service_id: eventRow.serviceId,
        service_name: serviceRow.serviceName,
        event_key: eventRow.eventKey,
        event_version: "2.1.0",
        display_name: eventRow.displayName,
        description: eventRow.description,
        record_kind: eventRow.recordKind,
        status: eventRow.status,
        created_at: eventRow.createdAt,
        updated_at: eventRow.updatedAt,
      });
    });

    it("throws EVENT_NOT_FOUND when the version does not exist", async () => {
      const { service, serviceRepo, eventRepo } = createDeps();
      const serviceRow = buildServiceRow();

      serviceRepo.findByName.mockResolvedValue(serviceRow);
      eventRepo.findByVersion.mockResolvedValue(undefined);

      await expect(
        service.getByVersion(serviceRow.serviceName, "user_signed_in", "99.0.0"),
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("update", () => {
    it("returns the updated event on the happy path", async () => {
      const { service, eventRepo } = createDeps();
      const existing = buildEventRow();
      const updated = buildEventRow({
        eventId: existing.eventId,
        displayName: "User Logged In",
        description: "Renamed display title.",
        status: "deprecated",
        updatedAt: new Date("2026-03-12T01:00:00.000Z"),
      });

      eventRepo.findById.mockResolvedValue(existing);
      eventRepo.update.mockResolvedValue(updated);

      const result = await service.update(existing.eventId, {
        display_name: "User Logged In",
        description: "Renamed display title.",
        status: "deprecated",
      });

      expect(result.event_version).toBe("1.0.0");
      expect(result.display_name).toBe("User Logged In");
      expect(result.status).toBe("deprecated");
    });

    it("throws EVENT_NOT_FOUND when the event does not exist", async () => {
      const { service, eventRepo } = createDeps();

      eventRepo.findById.mockResolvedValue(undefined);

      await expect(
        service.update("evt_missing", { display_name: "User Logged In" }),
      ).rejects.toMatchObject({
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      });

      expect(eventRepo.update).not.toHaveBeenCalled();
    });
  });
});
