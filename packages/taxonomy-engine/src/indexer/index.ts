import type { AxisIR, EntryIR, Coordinate } from '../schema/ir.js';

export type IndexedAxis = {
  axis: AxisIR;
  byId: (id: string) => EntryIR | undefined;
  byAddress: (address: number) => EntryIR | undefined;
};

export function indexAxis(axis: AxisIR): IndexedAxis {
  const byIdMap = new Map<string, EntryIR>();
  const byAddrMap = new Map<number, EntryIR>();
  for (const e of axis.entries) {
    byIdMap.set(e.id, e);
    byAddrMap.set(e.address, e);
  }
  return {
    axis,
    byId: (id) => byIdMap.get(id),
    byAddress: (a) => byAddrMap.get(a),
  };
}

export function packCoordinate(coord: Coordinate, axes: AxisIR[]): number {
  let packed = 0;
  let shift = 0;
  for (const axis of axes) {
    const entry = axis.entries.find((e) => e.id === coord[axis.name]);
    if (!entry) throw new Error(`unknown entry ${coord[axis.name]} in axis ${axis.name}`);
    const bits = Math.ceil(Math.log2(axis.capacity));
    packed |= entry.address << shift;
    shift += bits;
  }
  return packed;
}

export function unpackCoordinate(packed: number, axes: AxisIR[]): Coordinate {
  const coord: Coordinate = {};
  let shift = 0;
  for (const axis of axes) {
    const bits = Math.ceil(Math.log2(axis.capacity));
    const mask = (1 << bits) - 1;
    const address = (packed >> shift) & mask;
    const entry = axis.entries.find((e) => e.address === address);
    if (!entry) throw new Error(`unknown address ${address} in axis ${axis.name}`);
    coord[axis.name] = entry.id;
    shift += bits;
  }
  return coord;
}
