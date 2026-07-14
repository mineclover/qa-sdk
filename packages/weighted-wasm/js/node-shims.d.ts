declare module 'node:fs' {
  export function existsSync(path: string | URL): boolean;
}

declare module 'node:fs/promises' {
  export function readFile(path: string | URL): Promise<Uint8Array>;
}
