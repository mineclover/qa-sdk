export {
  PROGRAMMING_ARTIFACT_KINDS,
  PROGRAMMING_ARTIFACT_RELATION_KINDS,
  programmingArtifactOntologyPack,
  type ProgrammingArtifactKind,
  type ProgrammingArtifactRelationKind,
  type ProgrammingArtifactRelation,
  type ProgrammingArtifactRegistryRecord,
  type CreateProgrammingArtifactRegistryRecordInput,
  type ProgrammingArtifactRegistryStore,
  type ArtifactRegistryPromptArtifactContextProviderOptions,
  InMemoryProgrammingArtifactRegistryStore,
  ArtifactRegistryPromptArtifactContextProvider,
  createProgrammingArtifactRegistryRecord,
  buildProgrammingArtifactRelations,
  extractPromptArtifactSourcesFromProgrammingArtifactRecord,
  validateProgrammingArtifactOntologyPack,
} from "./internal/programming-artifact-core.js";

import {
  ArtifactRegistryPromptArtifactContextProvider,
  InMemoryProgrammingArtifactRegistryStore,
  PROGRAMMING_ARTIFACT_KINDS,
  PROGRAMMING_ARTIFACT_RELATION_KINDS,
  buildProgrammingArtifactRelations,
  createProgrammingArtifactRegistryRecord,
  extractPromptArtifactSourcesFromProgrammingArtifactRecord,
  programmingArtifactOntologyPack,
  validateProgrammingArtifactOntologyPack,
} from "./internal/programming-artifact-core.js";

export const operationalOntologyProgrammingArtifactPlane = {
  PROGRAMMING_ARTIFACT_KINDS,
  PROGRAMMING_ARTIFACT_RELATION_KINDS,
  programmingArtifactOntologyPack,
  validateProgrammingArtifactOntologyPack,
  InMemoryProgrammingArtifactRegistryStore,
  ArtifactRegistryPromptArtifactContextProvider,
  createProgrammingArtifactRegistryRecord,
  buildProgrammingArtifactRelations,
  extractPromptArtifactSourcesFromProgrammingArtifactRecord,
};
