// @def.boundary df-narrative-group
/**
 * 컨텍스트 제공자 (Context Provider)
 *
 * 사람에게는 쉬운 의사결정을, 시스템으로서는 일관된 컨텍스트를 제공한다.
 *
 * 핵심 원칙:
 * - 결정을 어렵게 만들지 않는다. 맥락을 표면화하여 쉽게 만든다.
 * - 강제하지 않는다. "이런 맥락이 있다"고 보여줄 뿐, 무시해도 된다.
 * - 일관된다. 같은 상황에서 같은 컨텍스트가 나온다.
 * - 축적된다. 결정할수록 다음 결정의 컨텍스트가 풍부해진다.
 *
 * 흐름:
 *   컨텍스트 축적 → 다음 결정 시 표면화 → 쉬운 결정 → 결과가 다시 축적
 */

import type { InstanceStore } from './instance-store.js';
import type { FlowInstance, FlowPolicy, FlowSchema } from './types.js';
import { detectPatterns } from './policy-learning.js';
import type { DetectedPattern } from './policy-learning.js';

// ─── 제공되는 컨텍스트 타입 ──────────────────────────────

/** 결정 시작 시 제공되는 컨텍스트 */
export interface DecisionContext {
  /** 이 스키마의 이전 결정 이력 요약 */
  readonly history: HistorySummary;
  /** 감지된 반복 패턴 — "보통 이렇게 결정한다" */
  readonly patterns: readonly PatternHint[];
  /** 적용 가능한 자동 정책 — "이건 이미 자동화되어 있다" */
  readonly activePolicies: readonly PolicyHint[];
  /** 현재 gate에 적용할 인지 모델 힌트 */
  readonly modelHints: readonly ModelHint[];
  /** 이전 결정에서 남긴 열린 질문 */
  readonly openQuestions: readonly string[];
}

/** 이력 요약 */
export interface HistorySummary {
  /** 이 스키마의 총 완료 건수 */
  readonly totalCompleted: number;
  /** 가장 최근 결정 시각 */
  readonly lastDecisionAt?: string;
  /** 가장 흔한 경로 (코어 gate 선택 기준) */
  readonly mostCommonPath?: readonly { gateId: string; branchId: string }[];
  /** 평균 confidence */
  readonly averageConfidence: number;
}

/** 반복 패턴 힌트 — 사람이 읽을 수 있는 형태 */
export interface PatternHint {
  /** "team=infra일 때, 보통 extend → integrated → integration 경로를 선택한다" */
  readonly description: string;
  /** 반복 횟수 */
  readonly frequency: number;
  /** 평균 confidence */
  readonly confidence: number;
  /** 이 패턴과 현재 컨텍스트가 일치하는가 */
  readonly matchesCurrent: boolean;
}

/** 자동 정책 힌트 */
export interface PolicyHint {
  /** 정책 이름 */
  readonly name: string;
  /** "이 조건이 충족되면 자동으로 {branchId}가 선택된다" */
  readonly description: string;
  /** 적용 대상 gate */
  readonly gateId: string;
  /** 자동 선택될 branch */
  readonly branchId: string;
  /** 이 정책이 현재 컨텍스트에서 적용되는가 */
  readonly willApply: boolean;
}

/** 인지 모델 힌트 */
export interface ModelHint {
  /** gate ID */
  readonly gateId: string;
  /** 모델 ID */
  readonly modelId: string;
  /** "이 결정은 되돌릴 수 있는가? 되돌리는 비용은?" */
  readonly question: string;
}

// ─── ContextProvider ─────────────────────────────────────

/**
 * 컨텍스트 제공자.
 *
 * 결정을 시작하기 전에 `provide()`를 호출하면
 * 이전 결정 이력, 패턴, 정책, 인지 모델 힌트를 한 번에 받는다.
 *
 * 강제하지 않는다. 컨텍스트를 무시하고 결정해도 된다.
 */
export class ContextProvider {
  private readonly store: InstanceStore;
  private readonly policies: ReadonlyMap<string, readonly FlowPolicy[]>;
  private readonly schemas: ReadonlyMap<string, FlowSchema>;
  private readonly mentalModels: ReadonlyMap<string, { question: string }>;

  constructor(deps: ContextProviderDeps) {
    this.store = deps.store;
    this.policies = deps.policies;
    this.schemas = deps.schemas;
    this.mentalModels = deps.mentalModels ?? new Map();
  }

  /**
   * 결정 시작 시 컨텍스트를 제공한다.
   *
   * @param schemaId - 시작할 플로우 스키마 ID
   * @param context - 현재 결정의 컨텍스트 (team, feature 등)
   */
  provide(schemaId: string, context: Record<string, unknown> = {}): DecisionContext {
    const schema = this.schemas.get(schemaId);
    const instances = this.store.findBySchema(schemaId);
    const completed = instances.filter((i) => i.status === 'completed');

    return {
      history: this.buildHistory(completed),
      patterns: this.buildPatternHints(schemaId, context),
      activePolicies: this.buildPolicyHints(schemaId, context),
      modelHints: schema ? this.buildModelHints(schema) : [],
      openQuestions: this.extractOpenQuestions(completed),
    };
  }

  /**
   * 특정 gate에 도달했을 때 해당 gate의 컨텍스트를 제공한다.
   */
  provideForGate(
    schemaId: string,
    gateId: string,
    _context: Record<string, unknown> = {},
  ): GateContext {
    const schema = this.schemas.get(schemaId);
    const gate = schema?.gates.find((g) => g.id === gateId);
    const instances = this.store.findBySchema(schemaId);
    const completed = instances.filter((i) => i.status === 'completed');

    // 이 gate에서의 이전 선택 분포
    const distribution = new Map<string, number>();
    for (const inst of completed) {
      const sel = inst.selections.find((s) => s.gateId === gateId);
      if (sel) {
        distribution.set(sel.branchId, (distribution.get(sel.branchId) ?? 0) + 1);
      }
    }

    const total = [...distribution.values()].reduce((s, c) => s + c, 0);
    const branchDistribution = [...distribution.entries()]
      .map(([branchId, count]) => ({ branchId, count, ratio: total > 0 ? count / total : 0 }))
      .toSorted((a, b) => b.count - a.count);

    // 이 gate의 인지 모델 힌트
    const modelHints: ModelHint[] = [];
    if (gate?.mentalModels) {
      for (const modelId of gate.mentalModels) {
        const model = this.mentalModels.get(modelId);
        if (model) {
          modelHints.push({ gateId, modelId, question: model.question });
        }
      }
    }

    // 해당 gate에서 적용될 자동 정책
    const policies = this.policies.get(schemaId) ?? [];
    const applicablePolicy = policies.find((p) => p.action.gateId === gateId);

    return {
      gateId,
      gateName: gate?.name ?? gateId,
      isCore: gate?.weight === 'core',
      branchDistribution,
      modelHints,
      autoPolicy: applicablePolicy
        ? {
            name: applicablePolicy.name,
            branchId: applicablePolicy.action.branchId,
            rationale: applicablePolicy.rationale,
          }
        : undefined,
      previousChoiceCount: total,
    };
  }

  // ── 기존 기능 조회 ──────────────────────────────────

  /**
   * "이 기능에 대해 시스템이 무엇을 알고 있는가?"
   *
   * 키워드로 관련 FlowInstance, 정책, 패턴을 종합 조회한다.
   * context의 feature, project, module 등에서 매칭.
   */
  lookup(query: string): FeatureLookup {
    // 모든 스키마에서 관련 인스턴스 검색
    const relatedInstances: FeatureInstance[] = [];
    const allPolicies: FlowPolicy[] = [];
    const allPatterns: PatternHint[] = [];
    const openQuestions: string[] = [];
    const queryLower = query.toLowerCase();

    for (const [schemaId] of this.schemas) {
      // context에서 query와 매칭되는 인스턴스 검색
      const instances = this.store.findBySchema(schemaId);
      for (const inst of instances) {
        if (this.instanceMatchesQuery(inst, queryLower)) {
          const schema = this.schemas.get(schemaId);
          const coreSelections: Record<string, string> = {};
          for (const sel of inst.selections) {
            const gate = schema?.gates.find((g) => g.id === sel.gateId);
            if (gate?.weight === 'core') {
              coreSelections[sel.gateId] = sel.branchId;
            }
          }
          const summaryParts = Object.entries(coreSelections)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          relatedInstances.push({
            instanceId: inst.id,
            schemaId: inst.schemaId,
            status: inst.status,
            completedAt: inst.completedAt,
            coreSelections,
            summary:
              summaryParts || inst.selections.map((s) => `${s.gateId}=${s.branchId}`).join(', '),
          });

          // openQuestions 수집
          const oq = inst.context.openQuestions;
          if (Array.isArray(oq)) {
            for (const q of oq) {
              if (typeof q === 'string' && !openQuestions.includes(q)) {
                openQuestions.push(q);
              }
            }
          }
        }
      }

      // 관련 정책
      const policies = this.policies.get(schemaId) ?? [];
      for (const p of policies) {
        if (
          p.name.toLowerCase().includes(queryLower) ||
          p.rationale.toLowerCase().includes(queryLower)
        ) {
          allPolicies.push(p);
        }
      }

      // 관련 패턴
      try {
        const patterns = detectPatterns(this.store, schemaId, { minFrequency: 3 });
        for (const p of patterns) {
          if (String(p.contextValue).toLowerCase().includes(queryLower)) {
            const pathDesc = p.gatePath.map((g) => `${g.gateId}=${g.branchId}`).join(' → ');
            allPatterns.push({
              description: `${p.contextKey}=${String(p.contextValue)}: ${pathDesc}`,
              frequency: p.frequency,
              confidence: p.averageConfidence,
              matchesCurrent: true,
            });
          }
        }
      } catch {
        // 패턴 감지 실패 무시
      }
    }

    // 최신순 정렬
    relatedInstances.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

    return {
      query,
      relatedInstances,
      relatedPolicies: allPolicies,
      relatedPatterns: allPatterns,
      lastDecision: relatedInstances[0],
      openQuestions,
    };
  }

  private instanceMatchesQuery(inst: FlowInstance, queryLower: string): boolean {
    // context 값에서 키워드 검색
    for (const value of Object.values(inst.context)) {
      if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
        return true;
      }
    }
    // schemaId에서 검색
    if (inst.schemaId.toLowerCase().includes(queryLower)) return true;
    return false;
  }

  // ── 내부 빌더 ────────────────────────────────────────

  private buildHistory(completed: readonly FlowInstance[]): HistorySummary {
    if (completed.length === 0) {
      return { totalCompleted: 0, averageConfidence: 0 };
    }

    // 가장 흔한 코어 경로
    const pathCounts = new Map<
      string,
      { count: number; path: { gateId: string; branchId: string }[] }
    >();
    let totalConf = 0;
    let selCount = 0;

    for (const inst of completed) {
      const corePath = inst.selections
        .filter((_s) => {
          // 간이 코어 판정: selections 순서의 첫 번째가 보통 코어
          return true; // 모든 gate 포함 (스키마 없이도 동작)
        })
        .map((s) => ({ gateId: s.gateId, branchId: s.branchId }));

      const key = corePath.map((s) => `${s.gateId}:${s.branchId}`).join('|');
      const existing = pathCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        pathCounts.set(key, { count: 1, path: corePath });
      }

      for (const s of inst.selections) {
        totalConf += s.confidence;
        selCount++;
      }
    }

    const mostCommon = [...pathCounts.values()].toSorted((a, b) => b.count - a.count)[0];

    const sorted = [...completed].toSorted((a, b) =>
      (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
    );

    return {
      totalCompleted: completed.length,
      lastDecisionAt: sorted[0]?.completedAt,
      mostCommonPath: mostCommon?.path,
      averageConfidence: selCount > 0 ? totalConf / selCount : 0,
    };
  }

  private buildPatternHints(schemaId: string, context: Record<string, unknown>): PatternHint[] {
    let patterns: DetectedPattern[];
    try {
      patterns = detectPatterns(this.store, schemaId, { minFrequency: 3 });
    } catch {
      return [];
    }

    return patterns.slice(0, 5).map((p) => {
      const pathDesc = p.gatePath.map((g) => `${g.gateId}=${g.branchId}`).join(' → ');
      const matchesCurrent = p.contextKey in context && context[p.contextKey] === p.contextValue;

      return {
        description: `${p.contextKey}=${String(p.contextValue)}일 때, ${pathDesc} 경로를 ${p.frequency}회 선택`,
        frequency: p.frequency,
        confidence: p.averageConfidence,
        matchesCurrent,
      };
    });
  }

  private buildPolicyHints(schemaId: string, _context: Record<string, unknown>): PolicyHint[] {
    const policies = this.policies.get(schemaId) ?? [];

    return policies.map((p) => ({
      name: p.name,
      description: `${p.rationale} → ${p.action.gateId}에서 "${p.action.branchId}" 자동 선택`,
      gateId: p.action.gateId,
      branchId: p.action.branchId,
      willApply: false, // 정확한 조건 평가는 엔진이 수행
    }));
  }

  private buildModelHints(schema: FlowSchema): ModelHint[] {
    const hints: ModelHint[] = [];
    for (const gate of schema.gates) {
      if (!gate.mentalModels) continue;
      for (const modelId of gate.mentalModels) {
        const model = this.mentalModels.get(modelId);
        if (model) {
          hints.push({
            gateId: gate.id,
            modelId,
            question: model.question,
          });
        }
      }
    }
    return hints;
  }

  private extractOpenQuestions(completed: readonly FlowInstance[]): string[] {
    // 최근 5건의 context에서 openQuestions 추출
    const questions: string[] = [];
    const recent = [...completed]
      .toSorted((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 5);

    for (const inst of recent) {
      const oq = inst.context.openQuestions;
      if (Array.isArray(oq)) {
        for (const q of oq) {
          if (typeof q === 'string' && !questions.includes(q)) {
            questions.push(q);
          }
        }
      }
    }
    return questions;
  }
}

/** gate별 컨텍스트 */
export interface GateContext {
  readonly gateId: string;
  readonly gateName: string;
  readonly isCore: boolean;
  /** 이전 선택 분포 — "이 gate에서 보통 어떤 걸 선택했는가" */
  readonly branchDistribution: readonly { branchId: string; count: number; ratio: number }[];
  /** 인지 모델 힌트 — "이 gate에서 이 질문을 생각해보라" */
  readonly modelHints: readonly ModelHint[];
  /** 자동 정책이 있으면 — "이 조건이면 자동으로 이걸 선택한다" */
  readonly autoPolicy?: { name: string; branchId: string; rationale: string };
  /** 이전 선택 총 건수 */
  readonly previousChoiceCount: number;
}

// ─── 기존 기능 조회 (Feature Lookup) ─────────────────────

/**
 * 기존 기능 조회 결과.
 *
 * "이 기능에 대해 시스템이 무엇을 알고 있는가?"
 * 의사결정이 아니라 조회. 새 결정을 시작하기 전에 확인하는 용도.
 */
export interface FeatureLookup {
  /** 검색 키워드 */
  readonly query: string;
  /** 관련 FlowInstance 이력 */
  readonly relatedInstances: readonly FeatureInstance[];
  /** 관련 정책 */
  readonly relatedPolicies: readonly FlowPolicy[];
  /** 관련 패턴 */
  readonly relatedPatterns: readonly PatternHint[];
  /** 이 기능에 대한 마지막 결정 */
  readonly lastDecision?: FeatureInstance;
  /** 열린 질문 */
  readonly openQuestions: readonly string[];
}

/** 조회된 FlowInstance 요약 */
export interface FeatureInstance {
  readonly instanceId: string;
  readonly schemaId: string;
  readonly status: string;
  readonly completedAt?: string;
  /** 코어 gate 선택 요약 */
  readonly coreSelections: Record<string, string>;
  /** 결정의 한 줄 요약 */
  readonly summary: string;
}

/** ContextProvider 의존성 */
export interface ContextProviderDeps {
  readonly store: InstanceStore;
  /** schemaId → policies 매핑 */
  readonly policies: ReadonlyMap<string, readonly FlowPolicy[]>;
  /** schemaId → FlowSchema 매핑 */
  readonly schemas: ReadonlyMap<string, FlowSchema>;
  /** modelId → { question } 매핑 (선택적) */
  readonly mentalModels?: ReadonlyMap<string, { question: string }>;
}
