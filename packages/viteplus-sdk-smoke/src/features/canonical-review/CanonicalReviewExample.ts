import { NoopTransport } from '@qa-sdk/sdk';
import { createQaBridge } from '../../qa-bridge.js';
import { createCanonicalReviewActions } from './actions/createCanonicalReviewActions.js';
import { createCanonicalReviewInitialState } from './business/canonicalReviewBusiness.js';
import { renderCanonicalReviewExamplePage } from './CanonicalReviewExamplePage.js';
import { createCanonicalReviewContext } from './contexts/CanonicalReviewContexts.js';
import { createCanonicalReviewHandlers } from './handlers/CanonicalReviewHandlers.js';
import { flushCanonicalReviewBridge } from './handlers/canonicalReviewHandlerSupport.js';
import { getCanonicalReviewData } from './hooks/getCanonicalReviewData.js';
import { renderCanonicalReviewView } from './views/CanonicalReviewView.js';

export async function mountCanonicalReviewExample(
  root: HTMLElement,
  mode: string,
): Promise<void> {
  const bridge = createQaBridge({
    serviceName: 'viteplus-sdk-smoke',
    owner: { owner_type: 'workspace', owner_id: 'qa-sdk' },
    buildEnv: mode,
    flushIntervalMs: 0,
    transport: new NoopTransport(),
    serviceConfig: {
      namespace: 'shop',
      name: 'viteplus-sdk-smoke',
      env: resolveServiceEnv(mode),
      region: 'asia',
    },
  });

  const { sessionId, traceId } = bridge.startSession('canonical_review_intake');
  const context = createCanonicalReviewContext({
    bridge,
    initialState: createCanonicalReviewInitialState(sessionId, traceId),
  });
  const handlers = createCanonicalReviewHandlers(context);
  const actions = createCanonicalReviewActions(handlers);

  root.innerHTML = renderCanonicalReviewExamplePage();
  const viewRoot = root.querySelector<HTMLElement>('#canonical-review-root');
  if (!viewRoot) {
    throw new Error('canonical review view root를 찾지 못했습니다.');
  }

  const render = (): void => {
    renderCanonicalReviewView(
      viewRoot,
      getCanonicalReviewData(context),
      actions,
      context.refs,
    );
  };

  context.store.subscribe(render);
  render();

  bridge.emitEvent('canonical_review_loaded', {
    transport: bridge.transportMode,
    session_id: sessionId,
    trace_id: traceId,
  });
  await flushCanonicalReviewBridge(context);
}

function resolveServiceEnv(mode: string): 'local' | 'dev' | 'stage' | 'prod' | 'test' {
  switch (mode) {
    case 'production':
      return 'prod';
    case 'test':
      return 'test';
    case 'stage':
      return 'stage';
    case 'dev':
      return 'dev';
    default:
      return 'local';
  }
}
