// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-bitmap-pipeline

export { issueBitmap, verifyBitmap } from "./issuer.js";
export {
  type IssueArgs,
  type VerifyArgs,
  type VerifyFailureReason,
  type VerifyResult,
  type VersionedBitmap,
} from "./types.js";
