// decode.wgsl — 배치 디코딩 compute shader
//
// 각 스레드가 하나의 주소를 독립적으로 디코딩.
// coord[j] = floor(addr / strides[j]) % shape[j] + 1

struct Params {
  dims: u32,
  batch_size: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> strides: array<u32>;
@group(0) @binding(2) var<storage, read> shape: array<u32>;
@group(0) @binding(3) var<storage, read> addrs: array<u32>;
@group(0) @binding(4) var<storage, read_write> coords: array<u32>;  // flattened [N × d]

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= params.batch_size) {
    return;
  }

  let d = params.dims;
  let base = idx * d;
  var rem = addrs[idx];

  for (var j: u32 = 0u; j < d; j = j + 1u) {
    let c = rem / strides[j];
    rem = rem % strides[j];
    coords[base + j] = (c % shape[j]) + 1u;
  }
}
