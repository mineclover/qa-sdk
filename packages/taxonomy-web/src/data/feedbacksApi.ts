import type { Feedback, FeedbackStatus } from '../types/feedback';

export async function fetchFeedbacks(): Promise<Feedback[]> {
  const res = await fetch('/api/feedbacks');
  if (!res.ok) throw new Error(`feedbacks GET 실패: ${res.status}`);
  return res.json();
}

export async function postFeedback(feedback: Feedback): Promise<Feedback> {
  const res = await fetch('/api/feedbacks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!res.ok) throw new Error(`POST 실패: ${res.status}`);
  return res.json();
}

export async function patchFeedbackStatus(
  id: string,
  newStatus: FeedbackStatus,
  oldStatus: FeedbackStatus,
  note?: string,
): Promise<Feedback> {
  const historyEntry = {
    at: new Date().toISOString(),
    from: oldStatus,
    to: newStatus,
    note,
  };
  const res = await fetch('/api/feedbacks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status: newStatus, history: [historyEntry] }),
  });
  if (!res.ok) throw new Error(`PATCH 실패: ${res.status}`);
  return res.json();
}
