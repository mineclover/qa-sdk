/// <reference types="vite/client" />

export const INGEST_SERVER_URL =
  import.meta.env.VITE_INGEST_SERVER_URL ?? "http://localhost:3100";

export const ROLEPLAY_WEB_URL =
  import.meta.env.VITE_ROLEPLAY_WEB_URL ?? "http://localhost:5201";
