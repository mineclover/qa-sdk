// reduce.wgsl — key 기반 카운트 집계 compute shader
//
// 단순 atomic 카운트: 각 스레드가 자기 key의 카운터를 atomic_add.
// 실제 group-by는 정렬 기반이 더 효율적이지만, PoC로 atomic 방식 사용.

@group(0) @binding(0) var<uniform> batch_size: u32;
@group(0) @binding(1) var<storage, read> keys: array<u32>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= batch_size) {
    return;
  }

  let key = keys[idx];
  atomicAdd(&counts[key], 1u);
}
