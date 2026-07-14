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

function formatRecordSummary(record: {
  event_key?: string;
  metric_name?: string;
  payload?: unknown;
}): string {
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
  const eventCount = snapshot.firstEnvelope.records.filter(
    (record) => 'event_key' in record,
  ).length;
  const metricCount = snapshot.firstEnvelope.records.filter(
    (record) => 'metric_name' in record,
  ).length;
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

      <section class="panel interpretation-panel">
        <div class="example-heading">
          <div>
            <p class="eyebrow">Tracked Value Interpretation</p>
            <h2>추적된 값을 이렇게 읽습니다</h2>
          </div>
          <p class="summary">
            qa-sdk가 남기는 값은 단순 로그가 아니라 “누가, 어떤 흐름에서, 어떤 판단을 만들었는가”를
            재구성하기 위한 관측 좌표입니다. 아래 규칙으로 raw JSON을 열지 않고도 의미를 읽을 수 있습니다.
          </p>
        </div>

        <div class="interpretation-grid">
          <article>
            <p class="section-title">Identity</p>
            <h3>session / trace</h3>
            <p>
              session은 사용자가 연속해서 만든 작업 묶음이고, trace는 한 feature 흐름을 따라가는 관측 키입니다.
              같은 session/trace 아래 record가 늘어나면 UI 행동과 logging이 연결된 것입니다.
            </p>
            <dl class="mini-meta">
              <div><dt>Current session</dt><dd>${snapshot.sessionId}</dd></div>
              <div><dt>Current trace</dt><dd>${snapshot.traceId}</dd></div>
            </dl>
          </article>

          <article>
            <p class="section-title">Evidence</p>
            <h3>envelope / records</h3>
            <p>
              envelope는 전송 단위, record는 그 안의 사건 단위입니다. event는 “무엇이 일어났는가”,
              metric은 “그 판단이 어떤 수치였는가”를 나타냅니다.
            </p>
            <dl class="mini-meta">
              <div><dt>Envelope</dt><dd>${snapshot.flushedEnvelopeCount}건</dd></div>
              <div><dt>Records</dt><dd>${snapshot.firstEnvelope.records.length}건</dd></div>
            </dl>
          </article>

          <article>
            <p class="section-title">Decision</p>
            <h3>route / score</h3>
            <p>
              route는 다음 행동 레인입니다. score는 그 route를 고른 강도입니다.
              변경 검토에서는 위험도, 컨벤션 피드백에서는 boundary 위반 강도로 읽습니다.
            </p>
            <ul class="meaning-list">
              <li><strong>ship</strong><span>실행 레인에서 바로 처리</span></li>
              <li><strong>eng-review</strong><span>구조나 완화 계획을 먼저 확인</span></li>
              <li><strong>office-hours</strong><span>상위 설계 판단이 필요한 상태</span></li>
            </ul>
          </article>

          <article>
            <p class="section-title">Convention Signal</p>
            <h3>activity / recent records</h3>
            <p>
              Activity Log는 사람이 읽는 상태 이력이고, Recent Records는 SDK가 남긴 관측 이름입니다.
              둘이 같은 submit/reset/reopen 흐름을 가리키면 구현과 관측이 같은 의미를 말하고 있는 상태입니다.
            </p>
            <ul class="meaning-list">
              <li><strong>validation_failed</strong><span>handler가 입력을 차단하고 focus를 이동</span></li>
              <li><strong>score metric</strong><span>business 판단이 수치 evidence로 남음</span></li>
              <li><strong>reopened</strong><span>success 이후 수정으로 stale result 제거</span></li>
            </ul>
          </article>
        </div>
      </section>

      <section id="canonical-review-example"></section>
      <section id="incident-escalation-example"></section>
    </main>
  `;

  appRoot.querySelector<HTMLButtonElement>('#rerun')?.addEventListener('click', () => {
    window.location.reload();
  });

  const exampleRoot = appRoot.querySelector<HTMLElement>('#canonical-review-example');
  if (!exampleRoot) {
    throw new Error('canonical example mount root를 찾지 못했습니다.');
  }
  await mountCanonicalReviewExample(exampleRoot, import.meta.env.MODE);

  const incidentRoot = appRoot.querySelector<HTMLElement>('#incident-escalation-example');
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
