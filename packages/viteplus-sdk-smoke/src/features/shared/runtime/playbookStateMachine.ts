export type PlaybookStatus =
  | 'idle'
  | 'editing'
  | 'invalid'
  | 'submitting'
  | 'success'
  | 'error';

export type PlaybookEvent =
  | 'DRAFT_CHANGED'
  | 'SUBMIT_INVALID'
  | 'SUBMIT_STARTED'
  | 'SUBMIT_SUCCEEDED'
  | 'SUBMIT_FAILED'
  | 'RESET';

export function transitionPlaybookStatus(
  current: PlaybookStatus,
  event: PlaybookEvent,
): PlaybookStatus {
  switch (event) {
    case 'DRAFT_CHANGED':
      return current === 'submitting' ? current : 'editing';
    case 'SUBMIT_INVALID':
      return 'invalid';
    case 'SUBMIT_STARTED':
      return current === 'submitting' ? current : 'submitting';
    case 'SUBMIT_SUCCEEDED':
      return 'success';
    case 'SUBMIT_FAILED':
      return 'error';
    case 'RESET':
      return 'idle';
  }
}
