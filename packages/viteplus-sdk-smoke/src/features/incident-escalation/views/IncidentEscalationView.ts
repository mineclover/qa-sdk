import type { IncidentEscalationActions } from '../actions/createIncidentEscalationActions.js';
import type { IncidentEscalationRefs } from '../contexts/IncidentEscalationContexts.js';
import type { IncidentEscalationViewModel } from '../hooks/getIncidentEscalationData.js';
import {
  captureActiveField,
  escapeHtml,
  renderInputField,
  renderSelectField,
  renderTextareaField,
  restoreActiveField,
} from '../../shared/views/playbookDom.js';

export function renderIncidentEscalationView(
  root: HTMLElement,
  viewModel: IncidentEscalationViewModel,
  actions: IncidentEscalationActions,
  refs: IncidentEscalationRefs,
): void {
  const activeField = captureActiveField(root);

  root.innerHTML = `
    <section class="canonical-shell">
      <div class="example-grid">
        <article class="panel nested-panel form-panel">
          <p class="section-title">Feature Form</p>
          <h3>Convention Feedback Intake</h3>
          <p class="summary-copy">
            코드 리뷰 피드백을 입력하면 convention risk score와 다음 검토 route를 계산하고,
            같은 qa-sdk bridge로 event와 metric을 남깁니다.
          </p>

          <div class="status-row">
            <span class="status-pill status-${viewModel.statusTone}">${escapeHtml(viewModel.statusLabel)}</span>
            <p class="status-copy">${escapeHtml(viewModel.statusSummary)}</p>
          </div>

          ${
            viewModel.submissionError
              ? `<div class="inline-error">${escapeHtml(viewModel.submissionError)}</div>`
              : ''
          }

          <form id="incident-escalation-form" class="form-stack">
            ${renderInputField({
              field: 'incidentTitle',
              idPrefix: 'incident',
              label: '피드백 제목',
              placeholder: '예: view boundary가 persistence write를 직접 수행',
              value: viewModel.draft.incidentTitle,
              issue: viewModel.validationMessages.incidentTitle,
            })}
            ${renderInputField({
              field: 'serviceName',
              idPrefix: 'incident',
              label: '대상 모듈/파일',
              placeholder: '예: features/review/views/ReviewView.ts',
              value: viewModel.draft.serviceName,
              issue: viewModel.validationMessages.serviceName,
            })}
            ${renderSelectField({
              field: 'severity',
              idPrefix: 'incident',
              label: '피드백 강도',
              value: viewModel.draft.severity,
              options: [
                { value: '', label: '선택하세요' },
                { value: 'sev2', label: 'nit: naming/style drift' },
                { value: 'sev1', label: 'structural: boundary responsibility drift' },
                { value: 'sev0', label: 'blocking: architecture contract violation' },
              ],
              issue: viewModel.validationMessages.severity,
            })}
            ${renderTextareaField({
              field: 'customerImpact',
              idPrefix: 'incident',
              label: '컨벤션 영향',
              placeholder: '어떤 책임 경계나 검증 계약이 흐려지는지 적습니다.',
              value: viewModel.draft.customerImpact,
              issue: viewModel.validationMessages.customerImpact,
              rows: 4,
            })}
            ${renderTextareaField({
              field: 'mitigationPlan',
              idPrefix: 'incident',
              label: '수정 제안',
              placeholder: '실행 가능한 리팩터링 또는 문서/테스트 보강안을 남깁니다.',
              value: viewModel.draft.mitigationPlan,
              issue: viewModel.validationMessages.mitigationPlan,
              rows: 4,
            })}
            ${renderTextareaField({
              field: 'stakeholderNote',
              idPrefix: 'incident',
              label: 'Reviewer Note',
              placeholder: '리뷰어가 handoff할 판단 근거를 남깁니다.',
              value: viewModel.draft.stakeholderNote,
              rows: 3,
            })}

            <div class="action-row">
              <button class="primary" type="submit" ${
                viewModel.canSubmit ? '' : 'disabled'
              }>${escapeHtml(viewModel.submitLabel)}</button>
              <button id="incident-sample" class="ghost" type="button">샘플 입력</button>
              <button id="incident-reset" class="ghost" type="button">초기화</button>
            </div>
          </form>
        </article>

        <aside class="stack">
          <article class="panel nested-panel">
            <p class="section-title">Escalation Route</p>
            <p class="explain-copy">
              convention risk score는 코드 구조 피드백의 강도입니다. 높을수록 단순 수정이 아니라
              architecture-revealing code convention 또는 context-action boundary 재검토가 필요합니다.
            </p>
            ${
              viewModel.result
                ? `
                  <h3>${escapeHtml(viewModel.result.routeLabel)}</h3>
                  <p class="metric-copy">${escapeHtml(viewModel.result.urgencyLabel)}</p>
                  <p>${escapeHtml(viewModel.result.summary)}</p>
                  <ul class="rationale-list">
                    ${viewModel.result.actions
                      .map((item) => `<li>${escapeHtml(item)}</li>`)
                      .join('')}
                  </ul>
                `
                : `
                  <h3>submit 전</h3>
                  <p>피드백을 제출하면 컨벤션 위반 강도와 검토 route를 계산합니다.</p>
                `
            }
          </article>

          <article class="panel nested-panel">
            <p class="section-title">Debug Session</p>
            <p class="explain-copy">
              session/trace는 이 컨벤션 피드백과 생성된 logging records를 묶는 관측 키입니다.
            </p>
            <dl class="mini-meta">
              <div><dt>Session</dt><dd>${escapeHtml(viewModel.sessionId)}</dd></div>
              <div><dt>Trace</dt><dd>${escapeHtml(viewModel.traceId)}</dd></div>
              <div><dt>Envelopes</dt><dd>${viewModel.envelopeCount}건</dd></div>
              <div><dt>Last Submit</dt><dd>${escapeHtml(viewModel.lastSubmittedAt ?? '없음')}</dd></div>
            </dl>
          </article>
        </aside>
      </div>

      <div class="detail-grid">
        <article class="panel nested-panel">
          <p class="section-title">Activity Log</p>
          <p class="explain-copy">
            사람이 먼저 읽는 feedback workflow 이력입니다. validation, route 계산, reopen 결과를 확인합니다.
          </p>
          <ul class="activity-list">
            ${viewModel.activity
              .map(
                (activity) => `
                  <li class="activity-${activity.tone}">
                    <strong>${escapeHtml(activity.title)}</strong>
                    <span>${escapeHtml(activity.detail)}</span>
                    <time>${escapeHtml(activity.occurredAt)}</time>
                  </li>
                `,
              )
              .join('')}
          </ul>
        </article>

        <article class="panel nested-panel">
          <p class="section-title">Recent Records</p>
          <p class="explain-copy">
            SDK가 기록한 event/metric 이름입니다. convention score metric이 보이면 피드백 분류가 관측까지 닫힌 상태입니다.
          </p>
          <ul class="record-list">
            ${
              viewModel.latestRecords.length > 0
                ? viewModel.latestRecords.map((record) => `<li>${escapeHtml(record)}</li>`).join('')
                : '<li>아직 flush된 레코드가 없습니다.</li>'
            }
          </ul>
        </article>

        <article class="panel nested-panel wide-panel">
          <p class="explain-copy">
            raw envelope는 전송 payload를 직접 확인해야 할 때만 펼칩니다.
          </p>
          <details class="raw-details">
            <summary>Latest envelope JSON 보기</summary>
            <pre>${escapeHtml(viewModel.latestEnvelope)}</pre>
          </details>
        </article>
      </div>
    </section>
  `;

  const titleInput = root.querySelector<HTMLInputElement>('#incident-incidentTitle');
  const serviceNameInput = root.querySelector<HTMLInputElement>('#incident-serviceName');
  const severitySelect = root.querySelector<HTMLSelectElement>('#incident-severity');
  const customerImpactInput = root.querySelector<HTMLTextAreaElement>('#incident-customerImpact');
  const mitigationPlanInput = root.querySelector<HTMLTextAreaElement>('#incident-mitigationPlan');

  refs.incidentTitle = titleInput;
  refs.serviceName = serviceNameInput;
  refs.severity = severitySelect;
  refs.customerImpact = customerImpactInput;
  refs.mitigationPlan = mitigationPlanInput;

  titleInput?.addEventListener('input', (event) => {
    actions.updateTextField('incidentTitle', (event.currentTarget as HTMLInputElement).value);
  });
  serviceNameInput?.addEventListener('input', (event) => {
    actions.updateTextField('serviceName', (event.currentTarget as HTMLInputElement).value);
  });
  severitySelect?.addEventListener('change', (event) => {
    actions.updateSeverity(
      (event.currentTarget as HTMLSelectElement).value as '' | 'sev2' | 'sev1' | 'sev0',
    );
  });
  customerImpactInput?.addEventListener('input', (event) => {
    actions.updateTextField('customerImpact', (event.currentTarget as HTMLTextAreaElement).value);
  });
  mitigationPlanInput?.addEventListener('input', (event) => {
    actions.updateTextField('mitigationPlan', (event.currentTarget as HTMLTextAreaElement).value);
  });
  root
    .querySelector<HTMLTextAreaElement>('#incident-stakeholderNote')
    ?.addEventListener('input', (event) => {
      actions.updateTextField(
        'stakeholderNote',
        (event.currentTarget as HTMLTextAreaElement).value,
      );
    });

  root
    .querySelector<HTMLFormElement>('#incident-escalation-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault();
      void actions.submit();
    });
  root.querySelector<HTMLButtonElement>('#incident-sample')?.addEventListener('click', () => {
    actions.updateTextField('incidentTitle', 'view boundary writes persistence directly');
    actions.updateTextField('serviceName', 'features/review/views/ReviewView.ts');
    actions.updateSeverity('sev0');
    actions.updateTextField(
      'customerImpact',
      '전체 context-action contract가 흐려집니다. view가 persistence write와 logging side effect를 직접 수행하면 handlers/actions boundary가 증명되지 않습니다.',
    );
    actions.updateTextField(
      'mitigationPlan',
      'Move persistence and logging into handlers, keep view as input/render only, and add context-action-contract test coverage for the boundary.',
    );
    actions.updateTextField(
      'stakeholderNote',
      'Blocking review feedback: this should not merge until the code boundary matches context-action-convention.',
    );
  });
  root.querySelector<HTMLButtonElement>('#incident-reset')?.addEventListener('click', () => {
    void actions.reset();
  });

  restoreActiveField(root, activeField);
}
