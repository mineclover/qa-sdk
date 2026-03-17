// encode.wgsl — 배치 인코딩 compute shader
//
// 각 스레드가 하나의 좌표 세트를 독립적으로 인코딩.
// address = Σ (coord[j] - 1) × strides[j]

struct Params {
  dims: u32,
  batch_size: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> strides: array<u32>;
@group(0) @binding(2) var<storage, read> coords: array<u32>;    // flattened [N × d]
@group(0) @binding(3) var<storage, read_write> addrs: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= params.batch_size) {
    return;
  }

  let d = params.dims;
  let base = idx * d;
  var addr: u32 = 0u;

  for (var j: u32 = 0u; j < d; j = j + 1u) {
    addr = addr + (coords[base + j] - 1u) * strides[j];
  }

  addrs[idx] = addr;
}
