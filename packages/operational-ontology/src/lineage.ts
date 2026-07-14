export {
  type DataLineageLink,
  type LineageTransformKind,
  LINEAGE_TRANSFORM_KINDS,
  createDataLineageId,
} from './internal/lineage-core.js';

export {
  projectLineageToOperationalOntology,
  inferLineageLinksFromPipe,
  type LineageProjectionInput,
} from './internal/projector-core.js';

import {
  inferLineageLinksFromPipe,
  projectLineageToOperationalOntology,
} from './internal/projector-core.js';

export const operationalOntologyLineagePlane = {
  projectLineageToOperationalOntology,
  inferLineageLinksFromPipe,
};
