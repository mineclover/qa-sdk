/**
 * UI 데이터 흐름 시뮬레이션 — 프론트엔드 패턴을 PipeFlow로 표현
 *
 * 기존 PipeFlow 29종으로 UI 패턴을 표현할 수 있는지 검증.
 * 새 타입 없이 조합으로 표현.
 */
import { describe, it, expect } from "vitest";
import { simulate } from "./pipe-simulate.js";
import { countPipePaths } from "./pipe-path.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "./types/pipe-spec.js";

const step = (facet: string, eventKey?: string): PipeFlow =>
  ({ kind: "step", facet, eventKey });

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

describe("UI 데이터 흐름 패턴", () => {

  // ── 입력 + 검증 ────────────────────────────────────

  it("폼 입력 → 검증 → 상태 갱신 → 렌더링 (React 기본 사이클)", () => {
    const formPipe = makePipe("form-cycle", "user_input", {
      kind: "sequence",
      steps: [
        step("소비", "read_input"),           // 사용자 입력 수신
        step("관리", "validate_field"),        // 필드 검증
        { kind: "branch", condition: "isValid",
          paths: [
            step("저장", "update_state"),      // 유효 → 상태 갱신
            step("생산", "show_error"),         // 무효 → 에러 표시
          ],
        },
        step("생산", "trigger_rerender"),       // 리렌더링
      ],
    });

    // 유효 입력
    const valid = simulate({
      graph: { graphId: "g", version: "v1", pipes: [formPipe], connections: [], entryPipeId: "form-cycle" },
      initialEvent: { eventKey: "user_input" },
      branchResolver: () => 0,
    });
    expect(valid.steps.find(s => s.eventKey === "update_state")).toBeDefined();

    // 무효 입력
    const invalid = simulate({
      graph: { graphId: "g", version: "v1", pipes: [formPipe], connections: [], entryPipeId: "form-cycle" },
      initialEvent: { eventKey: "user_input" },
      branchResolver: () => 1,
    });
    expect(invalid.steps.find(s => s.eventKey === "show_error")).toBeDefined();
    expect(countPipePaths(formPipe.flow)).toBe(2);
  });

  it("검색 디바운스 → API 호출 → 결과 렌더링", () => {
    const searchPipe = makePipe("search", "keypress", {
      kind: "debounce",
      wait: 300,
      step: {
        kind: "sequence",
        steps: [
          step("소비", "get_query"),           // 쿼리 수집
          {
            kind: "fallback",
            try: step("소비", "api_search"),    // API 호출
            catch: step("생산", "show_offline_msg"), // 실패 시 오프라인 메시지
          },
          step("생산", "render_results"),       // 결과 렌더링
        ],
      },
    });

    // 정상 검색
    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [searchPipe], connections: [], entryPipeId: "search" },
      initialEvent: { eventKey: "keypress", timestamp: 0 },
      failureResolver: () => true,
    });
    expect(r.totalTime).toBeGreaterThanOrEqual(300); // debounce 대기
    expect(r.steps.find(s => s.eventKey === "api_search")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "render_results")).toBeDefined();
  });

  // ── Optimistic UI ──────────────────────────────────

  it("옵티미스틱 업데이트 → API 확인 → 실패 시 롤백", () => {
    const optimisticPipe = makePipe("optimistic", "user_action", {
      kind: "compensate",
      forward: {
        kind: "sequence",
        steps: [
          step("저장", "optimistic_update"),    // 즉시 UI 반영
          step("생산", "render_optimistic"),     // 낙관적 렌더
        ],
      },
      compensate: {
        kind: "sequence",
        steps: [
          step("저장", "rollback_state"),        // 상태 롤백
          step("생산", "render_rollback"),        // 원래 상태로 렌더
          step("생산", "show_error_toast"),       // 에러 토스트
        ],
      },
    });

    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [optimisticPipe], connections: [], entryPipeId: "optimistic" },
      initialEvent: { eventKey: "user_action" },
    });
    // 정상에서는 forward만 실행
    expect(r.steps.find(s => s.eventKey === "optimistic_update")).toBeDefined();
    // 경로: forward(2) + compensate(3) = 합
    expect(countPipePaths(optimisticPipe.flow)).toBe(2);
  });

  // ── 로딩 + 에러 ────────────────────────────────────

  it("로딩 상태: fetch 시작 → loading=true → 데이터 → loading=false", () => {
    const fetchPipe = makePipe("fetch-data", "page_load", {
      kind: "finally",
      body: {
        kind: "sequence",
        steps: [
          step("저장", "set_loading_true"),      // loading = true
          {
            kind: "timeout",
            body: step("소비", "fetch_api"),     // API 호출
            duration: 10000,
            onTimeout: step("생산", "show_timeout_error"),
          },
          step("저장", "set_data"),              // 데이터 저장
          step("생산", "render_data"),           // 데이터 렌더
        ],
      },
      cleanup: step("저장", "set_loading_false"), // 항상: loading = false
    });

    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [fetchPipe], connections: [], entryPipeId: "fetch-data" },
      initialEvent: { eventKey: "page_load" },
    });
    // loading true → fetch → data → render → loading false
    expect(r.steps.find(s => s.eventKey === "set_loading_true")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "set_loading_false")).toBeDefined();
  });

  it("에러 바운더리: 렌더 시도 → 실패 시 폴백 UI", () => {
    const errorBoundary = makePipe("error-boundary", "render_trigger", {
      kind: "fallback",
      try: {
        kind: "sequence",
        steps: [
          step("소비", "load_component"),
          step("생산", "render_component"),
        ],
      },
      catch: step("생산", "render_fallback_ui"),
    });

    // 렌더 성공
    const ok = simulate({
      graph: { graphId: "g", version: "v1", pipes: [errorBoundary], connections: [], entryPipeId: "error-boundary" },
      initialEvent: { eventKey: "render_trigger" },
      failureResolver: () => true,
    });
    expect(ok.steps.find(s => s.eventKey === "render_component")).toBeDefined();

    // 렌더 실패 → 폴백
    const fail = simulate({
      graph: { graphId: "g", version: "v1", pipes: [errorBoundary], connections: [], entryPipeId: "error-boundary" },
      initialEvent: { eventKey: "render_trigger" },
      failureResolver: () => false,
    });
    expect(fail.steps.find(s => s.eventKey === "render_fallback_ui")).toBeDefined();
  });

  // ── 모달 + 토스트 ──────────────────────────────────

  it("모달 확인: 액션 → 모달 표시 → 사용자 대기 → 확인/취소", () => {
    const modalPipe = makePipe("confirm-modal", "delete_clicked", {
      kind: "sequence",
      steps: [
        step("생산", "show_modal"),
        {
          kind: "await",
          condition: "user_response",
          timeout: 30000,
          then: {
            kind: "branch", condition: "confirmed",
            paths: [
              { kind: "sequence", steps: [
                step("관리", "perform_delete"),
                step("생산", "show_success_toast"),
              ]},
              step("생산", "close_modal"),
            ],
          },
        },
      ],
    });

    // 확인
    const confirmed = simulate({
      graph: { graphId: "g", version: "v1", pipes: [modalPipe], connections: [], entryPipeId: "confirm-modal" },
      initialEvent: { eventKey: "delete_clicked" },
      branchResolver: () => 0,
    });
    expect(confirmed.steps.find(s => s.eventKey === "show_modal")).toBeDefined();
    expect(confirmed.steps.find(s => s.eventKey === "perform_delete")).toBeDefined();

    // 취소
    const cancelled = simulate({
      graph: { graphId: "g", version: "v1", pipes: [modalPipe], connections: [], entryPipeId: "confirm-modal" },
      initialEvent: { eventKey: "delete_clicked" },
      branchResolver: () => 1,
    });
    expect(cancelled.steps.find(s => s.eventKey === "close_modal")).toBeDefined();
  });

  it("토스트 알림: 표시 → 타임아웃 → 자동 사라짐", () => {
    const toastPipe = makePipe("toast", "show_toast", {
      kind: "sequence",
      steps: [
        step("생산", "render_toast"),
        {
          kind: "timeout",
          body: {
            kind: "await",
            condition: "user_dismiss",
            timeout: 5000,
            then: step("생산", "dismiss_by_user"),
          },
          duration: 5000,
          onTimeout: step("생산", "auto_dismiss"),
        },
      ],
    });

    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [toastPipe], connections: [], entryPipeId: "toast" },
      initialEvent: { eventKey: "show_toast" },
    });
    expect(r.steps.find(s => s.eventKey === "render_toast")).toBeDefined();
  });

  // ── 무한 스크롤 + 페이지네이션 ─────────────────────

  it("무한 스크롤: 스크롤 이벤트 → buffer → fetch → append", () => {
    const scrollPipe = makePipe("infinite-scroll", "scroll_event", {
      kind: "buffer",
      duration: 200,  // 200ms 모아서
      body: {
        kind: "sequence",
        steps: [
          { kind: "filter",
            condition: "nearBottom",
            step: {
              kind: "dedup",
              keyField: "pageNumber",
              step: {
                kind: "sequence",
                steps: [
                  step("소비", "fetch_next_page"),
                  step("저장", "append_items"),
                  step("생산", "render_new_items"),
                ],
              },
            },
          },
        ],
      },
    });

    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [scrollPipe], connections: [], entryPipeId: "infinite-scroll" },
      initialEvent: { eventKey: "scroll_event", timestamp: 0 },
      filterResolver: () => true, // nearBottom + 비중복
    });
    expect(r.steps.find(s => s.eventKey === "fetch_next_page")).toBeDefined();
    expect(r.totalTime).toBeGreaterThanOrEqual(200);
  });

  // ── 파일 업로드 ────────────────────────────────────

  it("파일 업로드: 선택 → 검증 → 업로드(진행률) → 완료/실패", () => {
    const uploadPipe = makePipe("file-upload", "file_selected", {
      kind: "sequence",
      steps: [
        step("소비", "read_file"),
        step("관리", "validate_file_type"),
        {
          kind: "fallback",
          try: {
            kind: "feedback",
            body: {
              kind: "sequence",
              steps: [
                step("생산", "upload_chunk"),
                step("생산", "update_progress"),
              ],
            },
            feedbackEvent: "file_selected",
            until: "upload_complete",
            maxIterations: 100,
          },
          catch: {
            kind: "sequence",
            steps: [
              step("생산", "show_upload_error"),
              step("저장", "cleanup_partial"),
            ],
          },
        },
        step("생산", "show_upload_complete"),
      ],
    });

    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [uploadPipe], connections: [], entryPipeId: "file-upload" },
      initialEvent: { eventKey: "file_selected" },
      failureResolver: () => true,
      maxSteps: 20,
    });
    expect(r.steps.find(s => s.eventKey === "read_file")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "validate_file_type")).toBeDefined();
  });

  // ── 실시간 동기화 ──────────────────────────────────

  it("실시간 협업: 로컬 편집 → emit → 서버 → 브로드캐스트 → 다른 클라이언트 갱신", () => {
    const graph: PipeGraph = {
      graphId: "realtime-collab", version: "v1",
      pipes: [
        makePipe("local-editor", "user_edit", {
          kind: "sequence",
          steps: [
            step("소비", "capture_edit"),
            step("저장", "apply_local"),
            { kind: "emit", eventKey: "edit_broadcast" },
          ],
        }, ["edit_broadcast"]),

        makePipe("sync-server", "edit_broadcast", {
          kind: "sequence",
          steps: [
            step("소비", "receive_edit"),
            step("관리", "resolve_conflict"),
            step("저장", "persist_edit"),
            { kind: "emit", eventKey: "broadcast_to_peers" },
          ],
        }, ["broadcast_to_peers"]),

        makePipe("remote-client", "broadcast_to_peers", {
          kind: "sequence",
          steps: [
            step("소비", "receive_peer_edit"),
            step("저장", "merge_remote"),
            step("생산", "rerender"),
          ],
        }),
      ],
      connections: [],
      entryPipeId: "local-editor",
    };

    const r = simulate({ graph, initialEvent: { eventKey: "user_edit" } });
    expect(r.pipeTrace).toEqual(["local-editor", "sync-server", "remote-client"]);
    expect(r.steps.find(s => s.eventKey === "resolve_conflict")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "rerender")).toBeDefined();
  });

  // ── 멀티스텝 체크아웃 ──────────────────────────────

  it("체크아웃 위저드: 장바구니 → 배송 → 결제 → 확인 (조건부 진행)", () => {
    const checkoutPipe = makePipe("checkout", "start_checkout", {
      kind: "sequence",
      steps: [
        // Step 1: 장바구니 확인
        step("소비", "load_cart"),
        step("관리", "validate_cart"),

        // Step 2: 배송 정보
        {
          kind: "await",
          condition: "shipping_form_submitted",
          timeout: 600000,  // 10분
          then: {
            kind: "sequence",
            steps: [
              step("소비", "read_shipping"),
              step("관리", "validate_address"),
            ],
          },
        },

        // Step 3: 결제 정보
        {
          kind: "await",
          condition: "payment_form_submitted",
          timeout: 600000,
          then: {
            kind: "sequence",
            steps: [
              step("소비", "read_payment"),
              step("관리", "validate_payment"),
            ],
          },
        },

        // Step 4: 최종 확인 + 주문 생성
        {
          kind: "await",
          condition: "confirm_clicked",
          timeout: 300000,  // 5분
          then: {
            kind: "finally",
            body: {
              kind: "sequence",
              steps: [
                step("생산", "create_order"),
                step("저장", "save_order"),
                { kind: "emit", eventKey: "order_created" },
              ],
            },
            cleanup: step("저장", "clear_cart"),
          },
        },
      ],
    });

    const r = simulate({
      graph: { graphId: "g", version: "v1", pipes: [checkoutPipe], connections: [], entryPipeId: "checkout" },
      initialEvent: { eventKey: "start_checkout" },
    });

    // 전체 플로우 실행 확인
    expect(r.steps.find(s => s.eventKey === "load_cart")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "read_shipping")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "read_payment")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "create_order")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "clear_cart")).toBeDefined();
    expect(r.producedEvents.map(e => e.eventKey)).toContain("order_created");
  });

  // ── A/B 테스트 ─────────────────────────────────────

  it("A/B 테스트: 사용자 분류 → 변형 A or B → 노출 추적", () => {
    const abTestPipe = makePipe("ab-test", "page_view", {
      kind: "sequence",
      steps: [
        step("소비", "identify_user"),
        step("관리", "hash_user_id"),
        {
          kind: "branch", condition: "variant",
          paths: [
            { kind: "sequence", steps: [
              step("생산", "render_variant_a"),
              { kind: "tap",
                observe: { kind: "emit", eventKey: "impression_a" },
                step: step("저장", "track_exposure_a"),
              },
            ]},
            { kind: "sequence", steps: [
              step("생산", "render_variant_b"),
              { kind: "tap",
                observe: { kind: "emit", eventKey: "impression_b" },
                step: step("저장", "track_exposure_b"),
              },
            ]},
          ],
        },
      ],
    });

    // Variant A
    const a = simulate({
      graph: { graphId: "g", version: "v1", pipes: [abTestPipe], connections: [], entryPipeId: "ab-test" },
      initialEvent: { eventKey: "page_view" },
      branchResolver: () => 0,
    });
    expect(a.steps.find(s => s.eventKey === "render_variant_a")).toBeDefined();
    expect(a.producedEvents.map(e => e.eventKey)).toContain("impression_a");

    // Variant B
    const b = simulate({
      graph: { graphId: "g", version: "v1", pipes: [abTestPipe], connections: [], entryPipeId: "ab-test" },
      initialEvent: { eventKey: "page_view" },
      branchResolver: () => 1,
    });
    expect(b.steps.find(s => s.eventKey === "render_variant_b")).toBeDefined();
    expect(b.producedEvents.map(e => e.eventKey)).toContain("impression_b");

    // 2 경로
    expect(countPipePaths(abTestPipe.flow)).toBe(2);
  });
});
