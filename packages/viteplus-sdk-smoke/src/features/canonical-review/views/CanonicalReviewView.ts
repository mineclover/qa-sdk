import type { CanonicalReviewActions } from '../actions/createCanonicalReviewActions.js';
import type { CanonicalReviewRefs } from '../contexts/CanonicalReviewContexts.js';
import type { CanonicalReviewViewModel } from '../hooks/getCanonicalReviewData.js';
import {
  captureActiveField,
  escapeHtml,
  renderInputField,
  renderSelectField,
  renderTextareaField,
  restoreActiveField,
} from '../../shared/views/playbookDom.js';

export function renderCanonicalReviewView(
  root: HTMLElement,
  viewModel: CanonicalReviewViewModel,
  actions: CanonicalReviewActions,
  refs: CanonicalReviewRefs,
): void {
  const activeField = captureActiveField(root);

  root.innerHTML = `
    <section class="canonical-shell">
      <div class="example-grid">
        <article class="panel nested-panel form-panel">
          <p class="section-title">Feature Form</p>
          <h3>Canonical Review Intake</h3>
          <p class="summary-copy">
            변경 요청을 입력하면 business layer가 review route를 계산하고,
            handlers가 validation/focus/logging side effect를 한 번에 처리합니다.
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

          <form id="canonical-review-form" class="form-stack">
            ${renderInputField({
              field: 'changeTitle',
              idPrefix: 'review',
              label: '변경 제목',
              placeholder: '예: registry 좌표 drift 수정',
              value: viewModel.draft.changeTitle,
              issue: viewModel.validationMessages.changeTitle,
            })}
            ${renderInputField({
              field: 'owner',
              idPrefix: 'review',
              label: '담당자',
              placeholder: '예: frontend-platform',
              value: viewModel.draft.owner,
              issue: viewModel.validationMessages.owner,
            })}
            ${renderSelectField({
              field: 'riskLevel',
              idPrefix: 'review',
              label: '리스크 레벨',
              value: viewModel.draft.riskLevel,
              options: [
                { value: '', label: '선택하세요' },
                { value: 'low', label: 'low' },
                { value: 'medium', label: 'medium' },
                { value: 'high', label: 'high' },
              ],
              issue: viewModel.validationMessages.riskLevel,
            })}
            ${renderTextareaField({
              field: 'rollbackPlan',
              idPrefix: 'review',
              label: '롤백 계획',
              placeholder: '고위험 변경이면 구체적인 롤백 문장을 남기세요.',
              value: viewModel.draft.rollbackPlan,
              issue: viewModel.validationMessages.rollbackPlan,
              rows: 4,
            })}
            ${renderTextareaField({
              field: 'summary',
              idPrefix: 'review',
              label: '변경 메모',
              placeholder: '추가 handoff 메모를 남기면 result rationale에 반영됩니다.',
              value: viewModel.draft.summary,
              rows: 3,
            })}

            <div class="action-row">
              <button class="primary" type="submit" ${
                viewModel.canSubmit ? '' : 'disabled'
              }>${escapeHtml(viewModel.submitLabel)}</button>
              <button id="canonical-sample" class="ghost" type="button">샘플 입력</button>
              <button id="canonical-reset" class="ghost" type="button">초기화</button>
            </div>
          </form>
        </article>

        <aside class="stack">
          <article class="panel nested-panel">
            <p class="section-title">Calculated Route</p>
            <p class="explain-copy">
              score는 변경 위험도입니다. 높을수록 바로 ship하기 어렵고,
              eng-review나 office-hours 같은 상위 검토 레인으로 이동합니다.
            </p>
            ${
              viewModel.result
                ? `
                  <h3>${escapeHtml(viewModel.result.routeLabel)}</h3>
                  <p class="metric-copy">${escapeHtml(viewModel.result.scoreLabel)}</p>
                  <p>${escapeHtml(viewModel.result.summary)}</p>
                  <ul class="rationale-list">
                    ${viewModel.result.rationale
                      .map((item) => `<li>${escapeHtml(item)}</li>`)
                      .join('')}
                  </ul>
                `
                : `
                  <h3>submit 전</h3>
                  <p>business layer가 아직 route를 계산하지 않았습니다.</p>
                `
            }
          </article>

          <article class="panel nested-panel">
            <p class="section-title">Debug Session</p>
            <p class="explain-copy">
              같은 session/trace 아래에서 form interaction과 SDK records가 연결됩니다.
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
            사람이 읽는 상태 이력입니다. validation 실패, route 계산, reset 같은 UI 사건을 먼저 봅니다.
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
            SDK가 남긴 최근 event/metric 이름입니다. activity와 record가 함께 증가하면 UI와 관측이 연결된 것입니다.
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

  const titleInput = root.querySelector<HTMLInputElement>('#review-changeTitle');
  const ownerInput = root.querySelector<HTMLInputElement>('#review-owner');
  const riskLevelSelect = root.querySelector<HTMLSelectElement>('#review-riskLevel');
  const rollbackPlanInput = root.querySelector<HTMLTextAreaElement>('#review-rollbackPlan');

  refs.changeTitle = titleInput;
  refs.owner = ownerInput;
  refs.riskLevel = riskLevelSelect;
  refs.rollbackPlan = rollbackPlanInput;

  titleInput?.addEventListener('input', (event) => {
    actions.updateTextField('changeTitle', (event.currentTarget as HTMLInputElement).value);
  });
  ownerInput?.addEventListener('input', (event) => {
    actions.updateTextField('owner', (event.currentTarget as HTMLInputElement).value);
  });
  riskLevelSelect?.addEventListener('change', (event) => {
    actions.updateRiskLevel(
      (event.currentTarget as HTMLSelectElement).value as '' | 'low' | 'medium' | 'high',
    );
  });
  rollbackPlanInput?.addEventListener('input', (event) => {
    actions.updateTextField('rollbackPlan', (event.currentTarget as HTMLTextAreaElement).value);
  });
  root.querySelector<HTMLTextAreaElement>('#review-summary')?.addEventListener('input', (event) => {
    actions.updateTextField('summary', (event.currentTarget as HTMLTextAreaElement).value);
  });

  root
    .querySelector<HTMLFormElement>('#canonical-review-form')
    ?.addEventListener('submit', (event) => {
      event.preventDefault();
      void actions.submit();
    });
  root.querySelector<HTMLButtonElement>('#canonical-sample')?.addEventListener('click', () => {
    actions.updateTextField('changeTitle', 'definition graph drift cleanup');
    actions.updateTextField('owner', 'platform-docs');
    actions.updateRiskLevel('high');
    actions.updateTextField(
      'rollbackPlan',
      'Revert the latest definition sync batch, restore the previous graph snapshot, and rerun def validate before reopening writes.',
    );
    actions.updateTextField('summary', '');
  });
  root.querySelector<HTMLButtonElement>('#canonical-reset')?.addEventListener('click', () => {
    void actions.reset();
  });

  restoreActiveField(root, activeField);
}
