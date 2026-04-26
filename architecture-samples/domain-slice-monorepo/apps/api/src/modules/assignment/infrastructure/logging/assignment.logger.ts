import { AssignmentLoggerPort } from "../../application/ports/assignment-logger.port.js";
import type { AssignmentLogEvent } from "../../application/ports/assignment-logger.port.js";

export class ConsoleAssignmentLogger extends AssignmentLoggerPort {
  readonly events: AssignmentLogEvent[] = [];

  async record(event: AssignmentLogEvent): Promise<void> {
    this.events.push(event);
    console.log(JSON.stringify({ type: "assignment.log", event }));
  }
}

