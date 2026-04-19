// @def.boundary persistence-system-root
// @def.doc persistence-system-root

export {
  BitIndex,
  BitIndexBig,
  createBitIndex,
  type BitSlot,
} from "./bit-index.js";
export {
  IndexBridge,
  IndexBridgeBig,
} from "./bridge.js";
export {
  BitMaskSet,
  uint8ToBase64,
  base64ToUint8,
} from "./bit-mask-set.js";
// weighted-index bitmask 프리미티브 re-export (편의)
export {
  createMask,
  setBit,
  clearBit,
  hasBit,
  buildMask,
  hasAnyBit,
  hasAllBits,
  popcount,
  maskAnd,
  maskOr,
  masksOverlap,
} from "weighted-index";
