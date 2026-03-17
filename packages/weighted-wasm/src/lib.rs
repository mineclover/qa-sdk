use wasm_bindgen::prelude::*;

// ══════════════════════════════════════════════════════════════════════════════
//  Batch Encode / Decode
// ══════════════════════════════════════════════════════════════════════════════
//
// JS의 WeightedIndex.encode()는 단건 7ns로 충분히 빠르지만,
// 1K+ 건의 배치에서는 JS 루프 오버헤드 (GC, bounds check, JIT deopt)가 누적된다.
// Rust의 tight loop는 이 오버헤드를 제거한다.

/// strides와 flattened coords로 배치 인코딩.
///
/// coords는 [d0,d1,...,dN, d0,d1,...,dN, ...] 형태의 1D 배열.
/// 각 좌표는 1-based. 결과는 0-based 주소 배열.
///
/// # 예시 (JS)
/// ```js
/// const addrs = encodeBatch(
///   new Uint32Array([14, 2, 1]),     // strides for shape [10, 7, 2]
///   new Uint32Array([3, 5, 1, 7, 2, 2]), // 2건: [3,5,1], [7,2,2]
///   3,  // dims
///   2,  // batch_size
/// );
/// ```
#[wasm_bindgen(js_name = encodeBatch)]
pub fn encode_batch(
    strides: &[u32],
    coords: &[u32],
    dims: u32,
    batch_size: u32,
) -> Vec<u32> {
    let d = dims as usize;
    let n = batch_size as usize;
    let mut result = Vec::with_capacity(n);

    for i in 0..n {
        let base = i * d;
        let mut addr: u32 = 0;
        for j in 0..d {
            // coords는 1-based → (coord - 1) × stride
            addr += (coords[base + j] - 1) * strides[j];
        }
        result.push(addr);
    }

    result
}

/// strides와 shape로 배치 디코딩.
///
/// 결과는 flattened [d0,d1,...,dN, ...] 형태. 각 좌표는 1-based.
#[wasm_bindgen(js_name = decodeBatch)]
pub fn decode_batch(
    strides: &[u32],
    shape: &[u32],
    addrs: &[u32],
    dims: u32,
) -> Vec<u32> {
    let d = dims as usize;
    let n = addrs.len();
    let mut result = Vec::with_capacity(n * d);

    for &addr in addrs {
        let mut rem = addr;
        for j in 0..d {
            let coord = rem / strides[j];
            rem %= strides[j];
            result.push(coord % shape[j] + 1); // 1-based
        }
    }

    result
}

// ══════════════════════════════════════════════════════════════════════════════
//  Bitmask SIMD Operations
// ══════════════════════════════════════════════════════════════════════════════
//
// JS의 popcount는 바이트별 while 루프 (8비트 단위).
// Rust는 u64 단위 count_ones()로 8× 처리, LLVM이 SIMD로 추가 최적화.

/// Population count — 마스크에서 1인 비트 수를 센다.
///
/// JS 대비 8~16× 빠름 (u64 popcnt + LLVM auto-vectorize).
#[wasm_bindgen(js_name = popcountWasm)]
pub fn popcount_wasm(mask: &[u8]) -> u32 {
    let mut count: u32 = 0;

    // u64 단위로 처리 (8바이트 = 64비트씩)
    let chunks = mask.len() / 8;
    let remainder = mask.len() % 8;

    for i in 0..chunks {
        let offset = i * 8;
        let word = u64::from_le_bytes([
            mask[offset],
            mask[offset + 1],
            mask[offset + 2],
            mask[offset + 3],
            mask[offset + 4],
            mask[offset + 5],
            mask[offset + 6],
            mask[offset + 7],
        ]);
        count += word.count_ones();
    }

    // 나머지 바이트
    let tail_start = chunks * 8;
    for i in 0..remainder {
        count += mask[tail_start + i].count_ones();
    }

    count
}

/// Bitwise AND — 두 마스크의 교집합.
#[wasm_bindgen(js_name = maskAndWasm)]
pub fn mask_and_wasm(a: &[u8], b: &[u8]) -> Vec<u8> {
    let len = a.len().min(b.len());
    let mut out = Vec::with_capacity(len);

    // u64 단위 처리
    let chunks = len / 8;
    let remainder = len % 8;

    for i in 0..chunks {
        let off = i * 8;
        let wa = u64::from_le_bytes(a[off..off + 8].try_into().unwrap());
        let wb = u64::from_le_bytes(b[off..off + 8].try_into().unwrap());
        out.extend_from_slice(&(wa & wb).to_le_bytes());
    }

    let tail = chunks * 8;
    for i in 0..remainder {
        out.push(a[tail + i] & b[tail + i]);
    }

    out
}

/// Bitwise OR — 두 마스크의 합집합.
#[wasm_bindgen(js_name = maskOrWasm)]
pub fn mask_or_wasm(a: &[u8], b: &[u8]) -> Vec<u8> {
    let len = a.len().min(b.len());
    let mut out = Vec::with_capacity(len);

    let chunks = len / 8;
    let remainder = len % 8;

    for i in 0..chunks {
        let off = i * 8;
        let wa = u64::from_le_bytes(a[off..off + 8].try_into().unwrap());
        let wb = u64::from_le_bytes(b[off..off + 8].try_into().unwrap());
        out.extend_from_slice(&(wa | wb).to_le_bytes());
    }

    let tail = chunks * 8;
    for i in 0..remainder {
        out.push(a[tail + i] | b[tail + i]);
    }

    out
}

/// Overlap check — 두 마스크가 공통 비트를 가지는지.
/// 전체 AND를 수행하지 않고 첫 번째 일치에서 즉시 반환.
#[wasm_bindgen(js_name = masksOverlapWasm)]
pub fn masks_overlap_wasm(a: &[u8], b: &[u8]) -> bool {
    let len = a.len().min(b.len());
    let chunks = len / 8;

    for i in 0..chunks {
        let off = i * 8;
        let wa = u64::from_le_bytes(a[off..off + 8].try_into().unwrap());
        let wb = u64::from_le_bytes(b[off..off + 8].try_into().unwrap());
        if wa & wb != 0 {
            return true;
        }
    }

    let tail = chunks * 8;
    for i in tail..len {
        if a[i] & b[i] != 0 {
            return true;
        }
    }

    false
}

// ══════════════════════════════════════════════════════════════════════════════
//  Tests
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_batch() {
        // shape [10, 7, 2] → strides [14, 2, 1]
        let strides = [14, 2, 1];
        // 2건: [3,5,1], [7,2,2] → (2)*14+(4)*2+(0)*1=36, (6)*14+(1)*2+(1)*1=87
        let coords = [3, 5, 1, 7, 2, 2];
        let result = encode_batch(&strides, &coords, 3, 2);
        assert_eq!(result, vec![36, 87]);
    }

    #[test]
    fn test_decode_batch() {
        let strides = [14, 2, 1];
        let shape = [10, 7, 2];
        let addrs = [36, 87];
        let result = decode_batch(&strides, &shape, &addrs, 3);
        // [3,5,1, 7,2,2] (1-based)
        assert_eq!(result, vec![3, 5, 1, 7, 2, 2]);
    }

    #[test]
    fn test_popcount() {
        let mask = vec![0xFF, 0x0F, 0x00]; // 8 + 4 + 0 = 12
        assert_eq!(popcount_wasm(&mask), 12);
    }

    #[test]
    fn test_popcount_large() {
        // 1KB mask, all set
        let mask = vec![0xFF; 1024];
        assert_eq!(popcount_wasm(&mask), 1024 * 8);
    }

    #[test]
    fn test_mask_and() {
        let a = vec![0xFF, 0x0F];
        let b = vec![0x0F, 0xFF];
        assert_eq!(mask_and_wasm(&a, &b), vec![0x0F, 0x0F]);
    }

    #[test]
    fn test_mask_or() {
        let a = vec![0xF0, 0x0F];
        let b = vec![0x0F, 0xF0];
        assert_eq!(mask_or_wasm(&a, &b), vec![0xFF, 0xFF]);
    }

    #[test]
    fn test_overlap() {
        assert!(masks_overlap_wasm(&[0xF0], &[0x10]));
        assert!(!masks_overlap_wasm(&[0xF0], &[0x0F]));
    }
}
