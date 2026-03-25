/* address-index — 좌표 주소 기반 역색인 */

export {
  type ParsedAddress,
  type AddressEntry,
  type AddressQuery,
  type CrossPrefixQuery,
  type AddressHit,
  type AddressStats,
  parseAddressValue,
  parseAddressContext,
} from "./types.js";

export { type AddressIndex } from "./port.js";

export { InMemoryAddressIndex } from "./memory-store.js";
