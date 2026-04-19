// @def.boundary viz-system-root
// @def.doc viz-system-root

/// <reference types="vite/client" />

export const INGEST_SERVER_URL =
  import.meta.env.VITE_INGEST_SERVER_URL ?? "http://localhost:3200";

export const ROLEPLAY_WEB_URL =
  import.meta.env.VITE_ROLEPLAY_WEB_URL ?? "http://localhost:5201";
