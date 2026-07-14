let counter = 0;
let lastDate = '';

export function newFeedbackId(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  if (date !== lastDate) {
    counter = 0;
    lastDate = date;
  }
  counter++;
  return `f-${date}-${String(counter).padStart(3, '0')}`;
}

// 테스트용 reset
export function _resetCounter(): void {
  counter = 0;
  lastDate = '';
}
