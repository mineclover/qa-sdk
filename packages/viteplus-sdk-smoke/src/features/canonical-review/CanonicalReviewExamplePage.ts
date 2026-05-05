export function renderCanonicalReviewExamplePage(): string {
  return `
    <section class="panel canonical-panel">
      <div class="example-heading">
        <div>
          <p class="eyebrow">Canonical Example</p>
          <h2>변경 검토 라우팅</h2>
        </div>
        <p class="summary">
          변경 제목, 담당자, 리스크, 롤백 계획을 입력하면 검토 route와 점수를 계산합니다.
          목적은 “이 변경을 바로 ship할지, 엔지니어링 리뷰로 보낼지, office-hours로 올릴지”를 UI에서 관측 가능한 이벤트로 남기는 것입니다.
        </p>
      </div>

      <div class="example-bullets">
        <span>판정: risk + rollback readiness</span>
        <span>출력: route, score, rationale</span>
        <span>관측: validation, submit, reopen, reset event</span>
        <span>검증: context-action boundary contract</span>
      </div>

      <div id="canonical-review-root"></div>
    </section>
  `;
}
