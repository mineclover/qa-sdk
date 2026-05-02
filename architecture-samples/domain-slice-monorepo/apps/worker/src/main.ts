import { ASSIGNMENT_EVENTS } from "@sample/contracts";
import type { AssignmentCreatedPayload } from "@sample/contracts";
import { WORKER_SCALING_PROFILE } from "@sample/platform";

import { AssignmentReadModelProjector } from "./projectors/assignment-read-model.projector.js";

console.log(`worker subscribed to ${ASSIGNMENT_EVENTS.created}`);
console.log(`worker scaling mode: ${WORKER_SCALING_PROFILE.mode}`);

const projector = new AssignmentReadModelProjector();

export async function handleAssignmentCreated(event: AssignmentCreatedPayload): Promise<void> {
  await projector.applyCreated(event);
}

export { projector as ASSIGNMENT_READ_MODEL_PROJECTOR };
