export type FeedbackTag = 'bug' | 'improvement' | 'question' | 'approval' | 'concern';
export type FeedbackStatus = 'open' | 'resolved' | 'rejected';

export type StatusChange = {
  at: string;
  from: FeedbackStatus;
  to: FeedbackStatus;
  note?: string;
};

export type Feedback = {
  id: string;
  ref: string;
  tag: FeedbackTag;
  status: FeedbackStatus;
  text: string;
  createdAt: string;
  updatedAt: string;
  history: StatusChange[];
};

export const FEEDBACK_TAGS: FeedbackTag[] = [
  'bug',
  'improvement',
  'question',
  'approval',
  'concern',
];
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'resolved', 'rejected'];
