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
          <h3>Incident Escalation Intake</h3>
          <p class="summary-copy">
            같은 Vite+ 소비처 안에서 두 번째 feature를 붙여도 shared state/store/dom helper와
            qa-sdk logging facade를 그대로 재사용할 수 있는지 보여줍니다.
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
              label: '인시던트 제목',
              placeholder: '예: registry decode latency spike',
              value: viewModel.draft.incidentTitle,
              issue: viewModel.validationMessages.incidentTitle,
            })}
            ${renderInputField({
              field: 'serviceName',
              idPrefix: 'incident',
              label: '영향 서비스',
              placeholder: '예: registry-service',
              value: viewModel.draft.serviceName,
              issue: viewModel.validationMessages.serviceName,
            })}
            ${renderSelectField({
              field: 'severity',
              idPrefix: 'incident',
              label: 'Severity',
              value: viewModel.draft.severity,
              options: [
                { value: '', label: '선택하세요' },
                { value: 'sev2', label: 'sev2' },
                { value: 'sev1', label: 'sev1' },
                { value: 'sev0', label: 'sev0' },
              ],
              issue: viewModel.validationMessages.severity,
            })}
            ${renderTextareaField({
              field: 'customerImpact',
              idPrefix: 'incident',
              label: '고객 영향',
              placeholder: '고심각도면 실제 영향 범위를 구체적으로 적습니다.',
              value: viewModel.draft.customerImpact,
              issue: viewModel.validationMessages.customerImpact,
              rows: 4,
            })}
            ${renderTextareaField({
              field: 'mitigationPlan',
              idPrefix: 'incident',
              label: '완화 계획',
              placeholder: '실행 가능한 mitigation plan을 남깁니다.',
              value: viewModel.draft.mitigationPlan,
              issue: viewModel.validationMessages.mitigationPlan,
              rows: 4,
            })}
            ${renderTextareaField({
              field: 'stakeholderNote',
              idPrefix: 'incident',
              label: 'Stakeholder Note',
              placeholder: '추가 공지 또는 handoff 메모가 있으면 남깁니다.',
              value: viewModel.draft.stakeholderNote,
              rows: 3,
            })}

            <div class="action-row">
              <button class="primary" type="submit" ${
                viewModel.canSubmit ? '' : 'disabled'
              }>${escapeHtml(viewModel.submitLabel)}</button>
              <button id="incident-reset" class="ghost" type="button">초기화</button>
            </div>
          </form>
        </article>

        <aside class="stack">
          <article class="panel nested-panel">
            <p class="section-title">Escalation Route</p>
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
                  <p>incident business layer가 아직 route를 계산하지 않았습니다.</p>
                `
            }
          </article>

          <article class="panel nested-panel">
            <p class="section-title">Debug Session</p>
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
          <ul class="record-list">
            ${
              viewModel.latestRecords.length > 0
                ? viewModel.latestRecords
                    .map((record) => `<li>${escapeHtml(record)}</li>`)
                    .join('')
                : '<li>아직 flush된 레코드가 없습니다.</li>'
            }
          </ul>
        </article>

        <article class="panel nested-panel wide-panel">
          <p class="section-title">Latest Envelope</p>
          <pre>${escapeHtml(viewModel.latestEnvelope)}</pre>
        </article>
      </div>
    </section>
  `;

  const titleInput = root.querySelector<HTMLInputElement>('#incident-incidentTitle');
  const serviceNameInput = root.querySelector<HTMLInputElement>('#incident-serviceName');
  const severitySelect = root.querySelector<HTMLSelectElement>('#incident-severity');
  const customerImpactInput =
    root.querySelector<HTMLTextAreaElement>('#incident-customerImpact');
  const mitigationPlanInput =
    root.querySelector<HTMLTextAreaElement>('#incident-mitigationPlan');

  refs.incidentTitle = titleInput;
  refs.serviceName = serviceNameInput;
  refs.severity = severitySelect;
  refs.customerImpact = customerImpactInput;
  refs.mitigationPlan = mitigationPlanInput;

  titleInput?.addEventListener('input', (event) => {
    actions.updateTextField(
      'incidentTitle',
      (event.currentTarget as HTMLInputElement).value,
    );
  });
  serviceNameInput?.addEventListener('input', (event) => {
    actions.updateTextField(
      'serviceName',
      (event.currentTarget as HTMLInputElement).value,
    );
  });
  severitySelect?.addEventListener('change', (event) => {
    actions.updateSeverity((event.currentTarget as HTMLSelectElement).value as
      | ''
      | 'sev2'
      | 'sev1'
      | 'sev0');
  });
  customerImpactInput?.addEventListener('input', (event) => {
    actions.updateTextField(
      'customerImpact',
      (event.currentTarget as HTMLTextAreaElement).value,
    );
  });
  mitigationPlanInput?.addEventListener('input', (event) => {
    actions.updateTextField(
      'mitigationPlan',
      (event.currentTarget as HTMLTextAreaElement).value,
    );
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
  root.querySelector<HTMLButtonElement>('#incident-reset')?.addEventListener(
    'click',
    () => {
      void actions.reset();
    },
  );

  restoreActiveField(root, activeField);
}
