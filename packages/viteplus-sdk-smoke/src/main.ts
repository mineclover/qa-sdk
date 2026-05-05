import './style.css';
import { mountCanonicalReviewExample } from './features/canonical-review/CanonicalReviewExample.js';
import { mountIncidentEscalationExample } from './features/incident-escalation/IncidentEscalationExample.js';
import { runSdkSmoke } from './smoke.js';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('앱 루트를 찾지 못했습니다.');
}

const appRoot = root;

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function formatPayload(value: unknown): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function formatRecordSummary(record: { event_key?: string; metric_name?: string; payload?: unknown }): string {
  const key = record.event_key ?? record.metric_name ?? 'unknown';
  const payload =
    record.payload && typeof record.payload === 'object'
      ? Object.keys(record.payload).slice(0, 4).join(', ')
      : '';
  return payload ? `${key} · ${payload}` : key;
}

async function render(): Promise<void> {
  const snapshot = await runSdkSmoke(import.meta.env.MODE);
  const firstRecord = snapshot.firstEnvelope.records[0];
  const eventCount = snapshot.firstEnvelope.records.filter((record) => 'event_key' in record).length;
  const metricCount = snapshot.firstEnvelope.records.filter((record) => 'metric_name' in record).length;
  const recordSummaries = snapshot.firstEnvelope.records
    .map(
      (record, index) => `
        <li>
          <span class="record-index">${index + 1}</span>
          <span>${escapeHtml(formatRecordSummary(record))}</span>
        </li>
      `,
    )
    .join('');

  appRoot.innerHTML = `
    <main class="shell page-stack">
      <section class="hero panel">
        <div>
          <p class="eyebrow">Vite+ qa-sdk Smoke</p>
          <h1>브라우저 소비처 검증</h1>
          <p class="summary">
            이 화면은 qa-sdk를 실제 프론트엔드에 붙였을 때 생기는 관측 단위를 보여줍니다.
            위쪽은 SDK가 만든 envelope, 아래쪽은 사용자 입력이 route/score/logging으로 바뀌는 feature 예제입니다.
          </p>
        </div>
        <div class="stats" aria-label="스모크 결과 요약">
          <article>
            <span class="label">브리지</span>
            <strong>${snapshot.transportMode}</strong>
          </article>
          <article>
            <span class="label">세션 ID</span>
            <strong>${snapshot.sessionId}</strong>
          </article>
          <article>
            <span class="label">트레이스 ID</span>
            <strong>${snapshot.traceId}</strong>
          </article>
          <article>
            <span class="label">엔벨로프</span>
            <strong>${snapshot.flushedEnvelopeCount}건</strong>
          </article>
        </div>
        <div class="actions">
          <button id="rerun" type="button">새 세션으로 다시 실행</button>
        </div>
      </section>

      <section class="grid smoke-grid">
        <article class="panel">
          <p class="section-title">Envelope Summary</p>
          <h2>${firstRecord?.event_key ?? 'No record'}</h2>
          <p class="explain-copy">
            envelope는 브라우저에서 발생한 이벤트와 메트릭을 전송 단위로 묶은 결과입니다.
            여기서는 네트워크 대신 NoopTransport에 쌓아 구조만 검증합니다.
          </p>
          <dl class="meta">
            <div><dt>Records</dt><dd>${snapshot.firstEnvelope.records.length}건</dd></div>
            <div><dt>Events</dt><dd>${eventCount}건</dd></div>
            <div><dt>Metrics</dt><dd>${metricCount}건</dd></div>
            <div><dt>서비스</dt><dd>${snapshot.firstEnvelope.source.service_name}</dd></div>
            <div><dt>SDK</dt><dd>${snapshot.firstEnvelope.source.sdk_name}</dd></div>
            <div><dt>환경</dt><dd>${snapshot.firstEnvelope.build.env}</dd></div>
          </dl>
        </article>

        <article class="panel">
          <p class="section-title">Record Timeline</p>
          <p class="explain-copy">
            record timeline은 사용자가 보통 확인해야 하는 해석된 로그입니다. raw JSON은 문제가 있을 때만 펼쳐 보면 됩니다.
          </p>
          <ul class="record-list compact-record-list">${recordSummaries}</ul>
        </article>

        <article class="panel wide">
          <p class="explain-copy">
            raw envelope는 SDK 통합 디버깅용 증거입니다. 일반 흐름에서는 위 요약과 feature별 recent records만 보면 충분합니다.
          </p>
          <details class="raw-details">
            <summary>Raw envelope JSON 보기</summary>
            <pre>${formatPayload(snapshot.firstEnvelope)}</pre>
          </details>
        </article>
      </section>

      <section id="canonical-review-example"></section>
      <section id="incident-escalation-example"></section>
    </main>
  `;

  appRoot.querySelector<HTMLButtonElement>('#rerun')?.addEventListener('click', () => {
    window.location.reload();
  });

  const exampleRoot =
    appRoot.querySelector<HTMLElement>('#canonical-review-example');
  if (!exampleRoot) {
    throw new Error('canonical example mount root를 찾지 못했습니다.');
  }
  await mountCanonicalReviewExample(exampleRoot, import.meta.env.MODE);

  const incidentRoot =
    appRoot.querySelector<HTMLElement>('#incident-escalation-example');
  if (!incidentRoot) {
    throw new Error('incident escalation mount root를 찾지 못했습니다.');
  }
  await mountIncidentEscalationExample(incidentRoot, import.meta.env.MODE);
}

render().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  appRoot.innerHTML = `
    <main class="shell">
      <section class="panel error">
        <p class="eyebrow">Smoke Failed</p>
        <h1>qa-sdk 소비처 초기화에 실패했습니다.</h1>
        <pre>${escapeHtml(message)}</pre>
      </section>
    </main>
  `;
});
