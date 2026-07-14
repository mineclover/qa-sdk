// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

export {
  documentOutboxEvents as sqliteDocumentOutboxEvents,
  SIM_DOC_OUTBOX_SQLITE_DDL,
} from './sqlite.schema.js';
export {
  documentOutboxEvents as pgDocumentOutboxEvents,
  SIM_DOC_OUTBOX_PG_DDL,
} from './pg.schema.js';
