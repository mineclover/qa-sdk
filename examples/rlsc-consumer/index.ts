/**
 * R.L.S.C.™ 소비자 예시 — 브라우저 앱에서 RLSC를 사용하는 최소 패턴.
 *
 * 사용법:
 *   1. import { collectLayout, measureLayout, classifyLayout, ... } from "rlsc";
 *   2. 대상 요소에 collectLayout 실행 → RLSCDocument 획득
 *   3. 필요한 분석 함수 호출 (metrics, pattern, conformance, context)
 *   4. 선택: Monitor로 실시간 변경 감지
 */

import {
  collectLayout,
  measureLayout,
  classifyLayout,
  checkConformance,
  generateDesignContext,
  renderToSVG,
  renderToCanvas,
  createLayoutMonitor,
} from "rlsc";
import type { LayoutPattern, RLSCDocument } from "rlsc";

// ── 1. 레이아웃 수집 ───────────────────────────────────────────────��

/**
 * 페이지의 특정 영역을 R.L.S.C. 문서로 수집한다.
 */
function captureLayout(rootElement: Element): RLSCDocument {
  return collectLayout(rootElement, {
    minSize: 4,       // 4px 미만 무시
    maxDepth: 15,     // DOM 깊이 제한
    maxTextLength: 80,
  });
}

// ── 2. 분석 ────────────────────────────────────────────────────────

/**
 * 레이아웃 분석 결과를 로깅한다.
 */
function analyzeLayout(doc: RLSCDocument): void {
  // 수치 측정
  const metrics = measureLayout(doc);
  console.log("[RLSC] 균형:", metrics.balance);
  console.log("[RLSC] 흐름:", metrics.dominantFlow);
  console.log("[RLSC] 컬럼:", metrics.columnSystem);
  console.log("[RLSC] 근접 그룹:", metrics.proximityGroups.length);

  // 패턴 분류
  const pattern = classifyLayout(metrics);
  console.log("[RLSC] 패턴:", pattern);
}

// ── 3. 적합성 검증 ─────────────────────────────────────────────────

/**
 * 디자인 인텐트와 실제 레이아웃의 일치도를 검증한다.
 */
function verifyDesignIntent(doc: RLSCDocument): void {
  const intent: LayoutPattern = {
    flowDirection: "top-to-bottom",
    gridSystem: { columns: 3, gutter: 16 },
    spacing: { scale: [8, 16, 24, 32], consistent: true },
  };

  const result = checkConformance(doc, intent);
  console.log(`[RLSC] 적합도: ${Math.round(result.score * 100)}%`);

  for (const v of result.violations) {
    console.warn(`[RLSC] ${v.severity}: ${v.rule} — ${v.description}`);
  }
}

// ── 4. LLM 컨텍스트 생성 ───────────────────────────────────────────

/**
 * Claude/GPT에 주입할 디자인 컨텍스트를 생성한다.
 */
function generatePrompt(doc: RLSCDocument): string {
  const ctx = generateDesignContext(doc, {
    purpose: "layout-analysis",
    sections: ["tree", "grid", "layers", "relations"],
    maxTokens: 4000,
  });

  // ctx.prompt를 LLM 프롬프트에 직접 삽입 가능
  return ctx.prompt;
}

// ── 5. 시각화 ──────────────────────────────────────────────────────

/**
 * SVG/Canvas 렌더링 예시.
 */
function visualize(doc: RLSCDocument): void {
  // SVG 문자열 (서버/테스트 호환)
  const svg = renderToSVG(doc, {
    colorBy: "role",
    showGrid: true,
    showBalance: true,
    opacity: 0.7,
  });
  document.getElementById("rlsc-svg")!.innerHTML = svg;

  // Canvas 2D (브라우저 전용)
  const canvas = document.getElementById("rlsc-canvas") as HTMLCanvasElement;
  const metrics = measureLayout(doc);
  renderToCanvas(doc, canvas, {
    colorBy: "depth",
    showGrid: true,
    showGroups: true,
    metrics,
  });
}

// ── 6. 실시간 모니터 ──────────────────────────────────────────────

/**
 * 레이아웃 변경을 실시간 감지한다.
 */
function setupMonitor(rootElement: Element): void {
  const monitor = createLayoutMonitor(rootElement, {
    debounceMs: 500,
    intent: {
      flowDirection: "top-to-bottom",
      gridSystem: { columns: 3, gutter: 16 },
    },
    onConformanceChange: (result) => {
      console.log(`[RLSC Monitor] 적합도 변경: ${Math.round(result.score * 100)}%`);
    },
  });

  monitor.start();

  // 주기적으로 변경 확인
  setInterval(() => {
    if (monitor.changes.length > 0) {
      console.log("[RLSC Monitor] 변경:", monitor.changes);
    }
  }, 1000);

  // 정리
  window.addEventListener("beforeunload", () => monitor.stop());
}

// ── 통합 초기화 ────────────────────────────────────────────────────

export function initRLSC(): void {
  const root = document.querySelector("main") ?? document.body;
  const doc = captureLayout(root);

  analyzeLayout(doc);
  verifyDesignIntent(doc);
  visualize(doc);

  const prompt = generatePrompt(doc);
  console.log("[RLSC] LLM 프롬프트 길이:", prompt.length, "chars");

  setupMonitor(root);
}
