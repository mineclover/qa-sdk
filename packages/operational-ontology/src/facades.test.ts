import { describe, expect, it } from "vitest";

import { operationalOntologySchemaPlane } from "./schema.js";
import { operationalOntologyPackPlane } from "./pack.js";
import { operationalOntologyLineagePlane } from "./lineage.js";
import { operationalOntologyCorridorPlane } from "./corridor.js";
import { operationalOntologyJunctionPlane } from "./junction.js";
import { operationalOntologyCheckpointPlane } from "./checkpoint.js";
import { operationalOntologyTopologyPlane } from "./topology.js";
import { operationalOntologyProjectors } from "./projectors.js";
import { operationalOntologyImplementationGovernancePlane } from "./governance.js";
import { operationalOntologyPromptArtifactPlane } from "./prompt-artifacts.js";
import { operationalOntologyPersistencePlane } from "./persistence.js";
import { createNodeCoord } from "./runtime.js";
import { projectEventRecordToOperationalOntology as projectEventRecordProjectorOnly } from "./projectors-event.js";
import { projectPipeGraphToOperationalOntology as projectPipeGraphProjectorOnly } from "./projectors-pipe.js";
import { projectPathObservationToOperationalOntology as projectPathProjectorOnly } from "./projectors-path.js";
import { projectOperationalOntologySnapshot as projectSnapshotProjectorOnly } from "./projectors-snapshot.js";

describe("submodule facades", () => {
  it("exposes plane-specific public surfaces", () => {
    expect(typeof operationalOntologySchemaPlane.validateOperationalOntologySchema).toBe("function");
    expect(typeof operationalOntologyPackPlane.validateOperationalOntologyPack).toBe("function");
    expect(typeof operationalOntologyPackPlane.validateOperationalOntologyPacks).toBe("function");
    expect(typeof operationalOntologyLineagePlane.projectLineageToOperationalOntology).toBe("function");
    expect(typeof operationalOntologyCorridorPlane.validateCorridorAgainstTemplate).toBe("function");
    expect(typeof operationalOntologyJunctionPlane.defaultJunctionTemplateRegistry.get).toBe("function");
    expect(typeof operationalOntologyCheckpointPlane.defaultCheckpointTemplateRegistry.get).toBe("function");
    expect(typeof operationalOntologyTopologyPlane.validateObservationTopologyAgainstTemplate).toBe("function");
    expect(typeof operationalOntologyProjectors.projectOperationalOntologySnapshot).toBe("function");
    expect(typeof operationalOntologyImplementationGovernancePlane.evaluateImplementationGovernance).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.validateImplementationGovernanceTaxonomy).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.validateImplementationBlueprint).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceBlueprint).toBe(
      "function",
    );
    expect(typeof operationalOntologyImplementationGovernancePlane.persistImplementationGovernanceRun).toBe(
      "function",
    );
    expect(typeof operationalOntologyPromptArtifactPlane.generatePromptArtifact).toBe("function");
    expect(typeof operationalOntologyPromptArtifactPlane.generatePromptArtifacts).toBe("function");
    expect(typeof operationalOntologyPromptArtifactPlane.validatePromptArtifact).toBe("function");
    expect(typeof operationalOntologyPromptArtifactPlane.evaluatePromptArtifactQuality).toBe("function");
    expect(typeof operationalOntologyPersistencePlane.validateFacetKindsForObjectKind).toBe("function");
    expect(typeof projectEventRecordProjectorOnly).toBe("function");
    expect(typeof projectPipeGraphProjectorOnly).toBe("function");
    expect(typeof projectPathProjectorOnly).toBe("function");
    expect(typeof projectSnapshotProjectorOnly).toBe("function");

    expect(
      createNodeCoord({
        realm: "software",
        space: "delivery",
        anchor: "checkout",
        taxonomies: {},
      }),
    ).toEqual({
      realm: "software",
      space: "delivery",
      anchor: "checkout",
      taxonomies: {},
      canonicalKey: "node:software/delivery/checkout",
    });
  });
});
