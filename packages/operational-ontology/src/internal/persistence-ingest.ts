import {
  defaultOperationalOntologyRuntimePorts,
  projectOperationalOntologySnapshot,
  type OperationalOntologyProjectionInput,
  type OperationalOntologyRuntimePorts,
  type OperationalOntologySnapshot,
} from "./projector-core.js";
import type { OperationalOntologyStore } from "./persistence-memory.js";
import {
  persistOperationalOntologySnapshot,
  type PersistOperationalOntologySnapshotOptions,
  type PersistOperationalOntologySnapshotResult,
} from "./persistence-snapshot.js";

export interface IngestOperationalOntologyProjectionOptions
  extends PersistOperationalOntologySnapshotOptions {
  ports?: OperationalOntologyRuntimePorts;
}

export interface IngestOperationalOntologyProjectionResult {
  snapshot: OperationalOntologySnapshot;
  persisted: PersistOperationalOntologySnapshotResult;
}

export async function ingestOperationalOntologyProjection(
  store: OperationalOntologyStore,
  input: OperationalOntologyProjectionInput,
  options: IngestOperationalOntologyProjectionOptions = {},
): Promise<IngestOperationalOntologyProjectionResult> {
  const snapshot = projectOperationalOntologySnapshot(
    input,
    options.ports ?? defaultOperationalOntologyRuntimePorts,
  );
  const persisted = await persistOperationalOntologySnapshot(store, snapshot, options);

  return {
    snapshot,
    persisted,
  };
}
