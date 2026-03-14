/// <reference types="vite/client" />

export const INGEST_SERVER_URL =
  import.meta.env.VITE_INGEST_SERVER_URL ?? "http://localhost:3100";

export const VIZ_WEB_ORIGIN =
  import.meta.env.VITE_VIZ_WEB_ORIGIN ?? "http://localhost:5200";
