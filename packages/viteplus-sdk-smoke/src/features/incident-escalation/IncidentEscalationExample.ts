import { NoopTransport } from '@qa-sdk/sdk';
import { createQaBridge } from '../../qa-bridge.js';
import { createIncidentEscalationActions } from './actions/createIncidentEscalationActions.js';
import { createIncidentEscalationInitialState } from './business/incidentEscalationBusiness.js';
import { renderIncidentEscalationExamplePage } from './IncidentEscalationExamplePage.js';
import { createIncidentEscalationContext } from './contexts/IncidentEscalationContexts.js';
import { createIncidentEscalationHandlers } from './handlers/IncidentEscalationHandlers.js';
import { flushIncidentEscalationBridge } from './handlers/incidentEscalationHandlerSupport.js';
import { getIncidentEscalationData } from './hooks/getIncidentEscalationData.js';
import { renderIncidentEscalationView } from './views/IncidentEscalationView.js';

export async function mountIncidentEscalationExample(
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

  const { sessionId, traceId } = bridge.startSession('incident_escalation_intake');
  const context = createIncidentEscalationContext({
    bridge,
    initialState: createIncidentEscalationInitialState(sessionId, traceId),
  });
  const handlers = createIncidentEscalationHandlers(context);
  const actions = createIncidentEscalationActions(handlers);

  root.innerHTML = renderIncidentEscalationExamplePage();
  const viewRoot = root.querySelector<HTMLElement>('#incident-escalation-root');
  if (!viewRoot) {
    throw new Error('incident escalation view root를 찾지 못했습니다.');
  }

  const render = (): void => {
    renderIncidentEscalationView(
      viewRoot,
      getIncidentEscalationData(context),
      actions,
      context.refs,
    );
  };

  context.store.subscribe(render);
  render();

  bridge.emitEvent('incident_escalation_loaded', {
    transport: bridge.transportMode,
    session_id: sessionId,
    trace_id: traceId,
  });
  await flushIncidentEscalationBridge(context);
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
