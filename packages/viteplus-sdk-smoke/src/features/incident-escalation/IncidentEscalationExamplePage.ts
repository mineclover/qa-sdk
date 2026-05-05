export function renderIncidentEscalationExamplePage(): string {
  return `
    <section class="panel canonical-panel">
      <div class="example-heading">
        <div>
          <p class="eyebrow">Convention Feedback</p>
          <h2>코딩 컨벤션 피드백 분류</h2>
        </div>
        <p class="summary">
          리뷰 중 발견한 코드 구조 피드백을 입력하면 컨벤션 위반 강도와 수정 route를 계산합니다.
          목적은 “단순 nit인지, eng-review에서 구조 조정이 필요한지, office-hours급 설계 논의인지”를 빠르게 분류하는 것입니다.
        </p>
      </div>

      <div class="example-bullets">
        <span>판정: feedback level + convention impact</span>
        <span>출력: review route + convention risk score</span>
        <span>관측: submit, reopen, reset, score metric</span>
        <span>재사용: 같은 state/store/dom helper</span>
      </div>

      <div id="incident-escalation-root"></div>
    </section>
  `;
}
