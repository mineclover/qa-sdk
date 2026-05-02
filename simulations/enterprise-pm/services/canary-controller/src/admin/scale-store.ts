// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 9~10 — Map<service, replicas> in-memory pin store.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.7
//
// 영속성 없음 — restart 시 손실. e2e 시나리오는 짧은 시간이라 무관.
// scale.controller (Task 1b.8) 와 ActionExecutor (Task 1b.10) 가 같은 인스턴스를 inject 받는다.

export class ScaleStore {
  private readonly pins = new Map<string, number>();

  has(service: string): boolean {
    return this.pins.has(service);
  }

  get(service: string): number | undefined {
    return this.pins.get(service);
  }

  set(service: string, replicas: number): void {
    this.pins.set(service, replicas);
  }

  delete(service: string): void {
    this.pins.delete(service);
  }

  entries(): IterableIterator<[string, number]> {
    return this.pins.entries();
  }
}
