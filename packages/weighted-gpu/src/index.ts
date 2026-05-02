// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * weighted-gpu — WebGPU compute shader 기반 배치 연산.
 *
 * 10K+ 건의 대량 병렬 encode/decode/aggregation을 GPU에 오프로드.
 * GPU 미지원 환경에서는 CPU fallback 제공.
 *
 * @example
 * ```ts
 * const gpu = await GPUEncoder.create([10, 7, 2]);
 * const addrs = await gpu.encodeBatch(coordsBatch);
 * gpu.destroy();
 * ```
 */

import encodeShaderCode from "./shaders/encode.wgsl?raw";
import decodeShaderCode from "./shaders/decode.wgsl?raw";
import reduceShaderCode from "./shaders/reduce.wgsl?raw";

export class GPUEncoder {
  private device: GPUDevice;
  private strides: Uint32Array;
  private shape: Uint32Array;
  private dims: number;

  private encodePipeline: GPUComputePipeline;
  private decodePipeline: GPUComputePipeline;
  private reducePipeline: GPUComputePipeline;

  private constructor(
    device: GPUDevice,
    shape: readonly number[],
    encodePipeline: GPUComputePipeline,
    decodePipeline: GPUComputePipeline,
    reducePipeline: GPUComputePipeline,
  ) {
    this.device = device;
    this.dims = shape.length;
    this.shape = new Uint32Array(shape);

    // strides 계산: strides[i] = Π shape[j] for j > i
    const strides = new Uint32Array(this.dims);
    strides[this.dims - 1] = 1;
    for (let i = this.dims - 2; i >= 0; i--) {
      strides[i] = strides[i + 1] * shape[i + 1];
    }
    this.strides = strides;

    this.encodePipeline = encodePipeline;
    this.decodePipeline = decodePipeline;
    this.reducePipeline = reducePipeline;
  }

  /**
   * GPU 디바이스를 획득하고 셰이더를 컴파일.
   * GPU 미지원 시 null 반환.
   */
  static async create(shape: readonly number[]): Promise<GPUEncoder | null> {
    if (typeof navigator === "undefined" || !navigator.gpu) return null;

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;

    const device = await adapter.requestDevice();

    const encodePipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: encodeShaderCode }),
        entryPoint: "main",
      },
    });

    const decodePipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: decodeShaderCode }),
        entryPoint: "main",
      },
    });

    const reducePipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: reduceShaderCode }),
        entryPoint: "main",
      },
    });

    return new GPUEncoder(device, shape, encodePipeline, decodePipeline, reducePipeline);
  }

  /** GPU 사용 가능 여부. */
  static async isAvailable(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  }

  /**
   * 배치 인코딩. N개 좌표를 GPU에서 동시 인코딩.
   *
   * @param coordsBatch — N × d 좌표 배열 (각 1-based)
   * @returns N개 주소 (0-based)
   */
  async encodeBatch(coordsBatch: readonly (readonly number[])[]): Promise<Uint32Array> {
    const n = coordsBatch.length;
    const d = this.dims;

    // flatten coords
    const flatCoords = new Uint32Array(n * d);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < d; j++) {
        flatCoords[i * d + j] = coordsBatch[i][j];
      }
    }

    // params uniform: [dims, batch_size]
    const params = new Uint32Array([d, n]);

    // GPU buffers
    const paramsBuffer = this.createBuffer(params, GPUBufferUsage.UNIFORM);
    const stridesBuffer = this.createBuffer(this.strides, GPUBufferUsage.STORAGE);
    const coordsBuffer = this.createBuffer(flatCoords, GPUBufferUsage.STORAGE);
    const addrsBuffer = this.device.createBuffer({
      size: n * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readBuffer = this.device.createBuffer({
      size: n * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.encodePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: stridesBuffer } },
        { binding: 2, resource: { buffer: coordsBuffer } },
        { binding: 3, resource: { buffer: addrsBuffer } },
      ],
    });

    // dispatch
    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.encodePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(n / 256));
    pass.end();

    commandEncoder.copyBufferToBuffer(addrsBuffer, 0, readBuffer, 0, n * 4);
    this.device.queue.submit([commandEncoder.finish()]);

    // read back
    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    // cleanup
    paramsBuffer.destroy();
    stridesBuffer.destroy();
    coordsBuffer.destroy();
    addrsBuffer.destroy();
    readBuffer.destroy();

    return result;
  }

  /**
   * 배치 디코딩. N개 주소를 GPU에서 동시 디코딩.
   */
  async decodeBatch(addrs: Uint32Array): Promise<number[][]> {
    const n = addrs.length;
    const d = this.dims;

    const params = new Uint32Array([d, n]);

    const paramsBuffer = this.createBuffer(params, GPUBufferUsage.UNIFORM);
    const stridesBuffer = this.createBuffer(this.strides, GPUBufferUsage.STORAGE);
    const shapeBuffer = this.createBuffer(this.shape, GPUBufferUsage.STORAGE);
    const addrsBuffer = this.createBuffer(addrs, GPUBufferUsage.STORAGE);
    const coordsBuffer = this.device.createBuffer({
      size: n * d * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readBuffer = this.device.createBuffer({
      size: n * d * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.decodePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: stridesBuffer } },
        { binding: 2, resource: { buffer: shapeBuffer } },
        { binding: 3, resource: { buffer: addrsBuffer } },
        { binding: 4, resource: { buffer: coordsBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.decodePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(n / 256));
    pass.end();

    commandEncoder.copyBufferToBuffer(coordsBuffer, 0, readBuffer, 0, n * d * 4);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const flat = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
      result.push(Array.from(flat.subarray(i * d, (i + 1) * d)));
    }

    paramsBuffer.destroy();
    stridesBuffer.destroy();
    shapeBuffer.destroy();
    addrsBuffer.destroy();
    coordsBuffer.destroy();
    readBuffer.destroy();

    return result;
  }

  /**
   * key 기반 카운트 집계.
   * maxKey = shape의 총 슬롯 수.
   */
  async reduceByKey(keys: Uint32Array, maxKey: number): Promise<Map<number, number>> {
    const n = keys.length;

    const batchSizeBuffer = this.createBuffer(new Uint32Array([n]), GPUBufferUsage.UNIFORM);
    const keysBuffer = this.createBuffer(keys, GPUBufferUsage.STORAGE);
    const countsBuffer = this.device.createBuffer({
      size: maxKey * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readBuffer = this.device.createBuffer({
      size: maxKey * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const bindGroup = this.device.createBindGroup({
      layout: this.reducePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: batchSizeBuffer } },
        { binding: 1, resource: { buffer: keysBuffer } },
        { binding: 2, resource: { buffer: countsBuffer } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.reducePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(n / 256));
    pass.end();

    commandEncoder.copyBufferToBuffer(countsBuffer, 0, readBuffer, 0, maxKey * 4);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const counts = new Uint32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    const result = new Map<number, number>();
    for (let i = 0; i < maxKey; i++) {
      if (counts[i] > 0) result.set(i, counts[i]);
    }

    batchSizeBuffer.destroy();
    keysBuffer.destroy();
    countsBuffer.destroy();
    readBuffer.destroy();

    return result;
  }

  /** GPU 리소스 해제. */
  destroy(): void {
    this.device.destroy();
  }

  private createBuffer(data: Uint32Array, usage: GPUBufferUsageFlags): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }
}
