// @def.boundary nest-service-event-envelope
// @def.doc nest-service-event-envelope

import { describe, expect, it } from "vitest";
import { createEventEnvelope } from "./event-envelope.js";
import { NoopEventPublisher } from "./ports.js";

describe("createEventEnvelope", () => {
  it("fills event identity and requester-aware fields", () => {
    const envelope = createEventEnvelope({
      eventKey: "project.manager.assigned",
      eventVersion: "v1",
      producerService: "sample-service",
      requesterType: "user",
      requesterId: "user-1",
      behaviorUnit: "project.manager.assign.requested",
      requestRoute: "POST /projects/:id/manager",
      subjectType: "project",
      subjectId: "project-1",
      effectKind: "updated",
      outcome: "success",
      payload: { managerId: "manager-1" },
    });

    expect(envelope.eventId).toBeTruthy();
    expect(envelope.producerService).toBe("sample-service");
    expect(envelope.requesterType).toBe("user");
    expect(envelope.behaviorUnit).toBe("project.manager.assign.requested");
    expect(envelope.payload.managerId).toBe("manager-1");
  });

  it("noop publisher records published envelopes", async () => {
    const publisher = new NoopEventPublisher();
    const envelope = createEventEnvelope({
      eventKey: "example.created",
      eventVersion: "v1",
      producerService: "sample-service",
      payload: { id: "example-1" },
    });

    await publisher.publish(envelope);
    expect(publisher.published).toEqual([envelope]);
  });
});
