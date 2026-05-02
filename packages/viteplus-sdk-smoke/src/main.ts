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

async function render(): Promise<void> {
  const snapshot = await runSdkSmoke(import.meta.env.MODE);
  const firstRecord = snapshot.firstEnvelope.records[0];

  appRoot.innerHTML = `
    <main class="shell page-stack">
      <section class="hero panel">
        <p class="eyebrow">Vite+ Create Smoke</p>
        <h1>qa-sdk 소비처가 브라우저 번들에서 바로 올라오는지 확인합니다.</h1>
        <p class="summary">
          Vite+로 만든 새 앱에서 <code>@qa-sdk/sdk</code>를 import하고,
          <code>NoopTransport</code>로 실제 엔벨로프를 한 번 생성해 화면에 표시합니다.
        </p>
        <p class="summary secondary-summary">
          아래 canonical example은 같은 Vite+ 소비처 안에서
          <code>implementation-convention</code> 책임 분리와 qa-sdk logging을 같이 보여줍니다.
        </p>
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
          <a href="https://viteplus.dev/guide/create" target="_blank" rel="noreferrer">Vite+ 생성 가이드</a>
        </div>
      </section>

      <section class="grid smoke-grid">
        <article class="panel">
          <p class="section-title">첫 로그 레코드</p>
          <h2>${firstRecord?.event_key ?? '없음'}</h2>
          <dl class="meta">
            <div><dt>Transport</dt><dd>${snapshot.transportMode}</dd></div>
            <div><dt>서비스</dt><dd>${snapshot.firstEnvelope.source.service_name}</dd></div>
            <div><dt>SDK</dt><dd>${snapshot.firstEnvelope.source.sdk_name}</dd></div>
            <div><dt>환경</dt><dd>${snapshot.firstEnvelope.build.env}</dd></div>
            <div><dt>전송 시각</dt><dd>${snapshot.firstEnvelope.sent_at}</dd></div>
          </dl>
        </article>

        <article class="panel">
          <p class="section-title">전송 payload</p>
          <pre>${formatPayload(firstRecord?.payload ?? null)}</pre>
        </article>

        <article class="panel wide">
          <p class="section-title">엔벨로프 스냅샷</p>
          <pre>${formatPayload(snapshot.firstEnvelope)}</pre>
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
