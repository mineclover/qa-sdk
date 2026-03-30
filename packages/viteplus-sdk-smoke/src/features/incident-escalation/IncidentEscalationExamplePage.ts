export function renderIncidentEscalationExamplePage(): string {
  return `
    <section class="panel canonical-panel">
      <div class="example-heading">
        <div>
          <p class="eyebrow">Second Feature</p>
          <h2>Incident Escalation Playbook</h2>
        </div>
        <p class="summary">
          첫 feature와 다른 도메인 입력을 쓰지만, shared state machine/store/dom helper와
          qa-sdk bridge orchestration은 그대로 재사용합니다.
        </p>
      </div>

      <div class="example-bullets">
        <span>shared runtime = store, refs, default persist</span>
        <span>shared state = idle/editing/invalid/submitting/success/error</span>
        <span>shared dom = input/select/textarea + active field restore</span>
        <span>feature docs = func_def + validation, template docs = func_def + process_flow</span>
      </div>

      <div id="incident-escalation-root"></div>
    </section>
  `;
}
