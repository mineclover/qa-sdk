// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 + §7 — SimServiceCatalogPort 기본 구현 + DI provider.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.11
//
// 본 모듈은 controller 가 sim-service-catalog 을 wrap 한 async port 의 DI provider 를
// 제공한다. 카탈로그 SSOT 는 시뮬 환경에서 mutable 메모리 상태 (서비스 이름 ↔
// stable/candidate 정의) — 실제 운영에서는 catalog HTTP endpoint 에서 fetch 하지만
// 본 sub-project 범위는 시뮬 내부 관측이므로 in-memory wrapper 만 노출한다.
//
// mutable 이유: spec 02 catalog 전이 (candidate→stable, 옛 stable→retired) 를
// 시뮬에서 자연 흐름으로 시현하려면 controller 가 weight=100 도달 시 카탈로그
// 상태를 갱신해야 한다. seedCandidate / promoteCandidate 두 mutation 진입점만
// 노출 (외부 admin endpoint 미노출 — 시뮬 부팅 env + cycle scheduler 내부 호출).

import {
  getCurrentTopology,
  transitionState,
  type CatalogPrefixDefinition,
  type VersionEntry,
} from 'sim-service-catalog';
import { type Provider } from '@nestjs/common';
import { type SimServiceCatalogPort } from '../action/action-executor.service.js';
import { SIM_SERVICE_CATALOG_TOKEN } from './tokens.js';
import { SIM_SERVICE_CATALOG_TOKEN as ALERTS_TOKEN } from '../decision/alerts-audit-catalog.controller.js';

/**
 * 시뮬 카탈로그 시드 — 서비스 별 stable/candidate refEntries 초기 상태.
 * 운영에서는 catalog HTTP endpoint, 시뮬에서는 컴파일 타임 상수.
 * approval 외 prefix 는 stable v1 만 노출 (시나리오 9~17 가 approval 만 사용).
 *
 * 초기 상태는 시나리오 9/10 setup 가정 (v3=stable, v4=undeployed) 으로 고정.
 * candidate 시드는 controller 가 첫 promote 시점에 SIM_CONTROLLER_CANDIDATE_VERSION
 * 기반으로 동적으로 호출 (CycleSchedulerService) — 외부 admin 또는 운영 API 가 candidate
 * 를 등록하는 자연 흐름을 시뮬한다.
 */
function buildInitialFixtures(): Record<string, CatalogPrefixDefinition> {
  const approvalEntries: VersionEntry[] = [
    { version: 'v1', state: 'retired' },
    { version: 'v2', state: 'retired' },
    { version: 'v3', state: 'stable' },
  ];
  return {
    'sim.svc.approval': {
      prefix: 'sim.svc.approval',
      versionAxis: { kind: 'version', capacity: 16 },
      refEntries: approvalEntries,
    },
  };
}

/**
 * controller 가 사용하는 SimServiceCatalogPort 구현체.
 * - prefix 가 fixtures 에 없으면 throw — 미정의 prefix 호출은 wiring 버그.
 * - getCurrentTopology 는 sync 지만 port 는 async 이므로 await 가능한 Promise 반환.
 * - seedCandidate / promoteCandidate 는 시뮬 mutation 진입점 (controller 내부 호출).
 */
export class InMemorySimServiceCatalog implements SimServiceCatalogPort {
  private fixtures: Record<string, CatalogPrefixDefinition>;
  private revision = 0;

  constructor(initial?: Record<string, CatalogPrefixDefinition>) {
    this.fixtures = initial ?? buildInitialFixtures();
  }

  async getCurrentTopology(
    prefix: string,
  ): ReturnType<SimServiceCatalogPort['getCurrentTopology']> {
    const def = this.fixtures[prefix];
    if (!def) {
      throw new Error(
        `unknown catalog prefix: ${prefix} (allowed: ${Object.keys(this.fixtures).join(', ')})`,
      );
    }
    const topo = getCurrentTopology(def, { revision: this.revision });
    return {
      stable: { value: topo.stable.value },
      candidate: topo.candidate === null ? null : { value: topo.candidate.value },
      retired: topo.retired.map((t) => ({ value: t.value })),
    };
  }

  /**
   * candidate 시드 — 운영에서는 catalog admin 이 등록, 시뮬에서는 controller startup
   * 또는 시나리오 setup 단계 호출. 이미 candidate 가 있으면 throw (sim-service-catalog
   * 의 invariant: candidate ≤ 1).
   */
  seedCandidate(prefix: string, version: number): void {
    const def = this.fixtures[prefix];
    if (!def) {
      throw new Error(
        `seedCandidate: unknown prefix ${prefix} (allowed: ${Object.keys(this.fixtures).join(', ')})`,
      );
    }
    const existing = def.refEntries.find((e) => e.state === 'candidate');
    if (existing) {
      throw new Error(`seedCandidate: prefix=${prefix} already has candidate ${existing.version}`);
    }
    this.fixtures[prefix] = {
      ...def,
      refEntries: [...def.refEntries, { version: `v${version}`, state: 'candidate' }],
    };
  }

  /**
   * candidate → stable 전이 — controller 가 weight=100 도달 시 호출.
   * 옛 stable 은 자동 retired (sim-service-catalog transitionState 의 candidate→stable
   * 분기). 호출 후 fixtures 와 revision 갱신.
   */
  promoteCandidate(prefix: string): void {
    const def = this.fixtures[prefix];
    if (!def) {
      throw new Error(
        `promoteCandidate: unknown prefix ${prefix} (allowed: ${Object.keys(this.fixtures).join(', ')})`,
      );
    }
    const candidate = def.refEntries.find((e) => e.state === 'candidate');
    if (!candidate) {
      throw new Error(
        `promoteCandidate: prefix=${prefix} has no candidate (idempotent caller 책임)`,
      );
    }
    this.revision += 1;
    const result = transitionState(def, {
      from: candidate,
      to: { version: candidate.version, state: 'stable' },
      revision: this.revision,
    });
    this.fixtures[prefix] = result.catalog;
  }

  /** 시뮬 reset 용 — 테스트나 controller 라이프사이클 종료 시 호출. */
  hasCandidate(prefix: string): boolean {
    const def = this.fixtures[prefix];
    if (!def) return false;
    return def.refEntries.some((e) => e.state === 'candidate');
  }
}

/** AppModule 이 inject 하는 provider — ActionExecutor 와 AlertsAuditCatalogController 가 동일 인스턴스 공유. */
export const simServiceCatalogProviders: Provider[] = [
  {
    provide: SIM_SERVICE_CATALOG_TOKEN,
    useFactory: () => new InMemorySimServiceCatalog(),
  },
  {
    // 같은 인스턴스를 다른 token 으로도 노출 (AlertsAuditCatalogController 가 사용).
    provide: ALERTS_TOKEN,
    useExisting: SIM_SERVICE_CATALOG_TOKEN,
  },
];
