// Browser stub for Node's crypto module.
// taxonomy-engine bundles createHash but parseRef (used at runtime in the browser) never calls it.
// This stub prevents the build from failing due to the crypto import in taxonomy-engine's parser.
export function createHash(_algorithm: string) {
  return {
    update(_data: string) { return this; },
    digest(_encoding: string) { return ""; },
  };
}
