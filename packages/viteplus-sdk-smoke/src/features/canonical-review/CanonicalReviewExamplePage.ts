export function renderCanonicalReviewExamplePage(): string {
  return `
    <section class="panel canonical-panel">
      <div class="example-heading">
        <div>
          <p class="eyebrow">Canonical Example</p>
          <h2>qa-sdk logging + implementation-convention</h2>
        </div>
        <p class="summary">
          이 예제는 Vite+ 소비처 안에서 <code>business</code> 순수 함수,
          <code>handlers</code> orchestration, <code>actions</code> input adapter,
          <code>hooks</code> view-model 조립, <code>views</code> 렌더링을 한 번에 보여줍니다.
        </p>
      </div>

      <div class="example-bullets">
        <span>contexts = store, refs, bridge</span>
        <span>business = validation, result, state machine</span>
        <span>handlers = focus 이동, flush, logging</span>
        <span>validation = submit/focus/reset/reopen 테스트</span>
      </div>

      <div id="canonical-review-root"></div>
    </section>
  `;
}
