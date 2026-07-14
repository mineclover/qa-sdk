// @def.boundary viz-system-root
// @def.doc viz-system-root

export interface SessionListEntry {
  sessionId: string;
  startedAt: string;
  closedAt: string | null;
  recordCount: number;
}

export interface SessionList {
  addOrUpdate(entry: Omit<SessionListEntry, 'recordCount'>): void;
  incrementRecordCount(sessionId: string): void;
  setRecordCount(sessionId: string, count: number): void;
  setSelected(sessionId: string): void;
  onSelect(handler: (sessionId: string) => void): void;
  clear(): void;
}

export function createSessionList(container: HTMLElement): SessionList {
  let onSelectHandler: ((sessionId: string) => void) | null = null;
  let selectedSessionId: string | null = null;

  const wrapper = document.createElement('div');
  wrapper.className = 'session-list';

  const label = document.createElement('label');
  label.textContent = 'Sessions';
  label.className = 'panel-label';

  const list = document.createElement('ul');
  list.className = 'session-list-items';

  wrapper.appendChild(label);
  wrapper.appendChild(list);
  container.appendChild(wrapper);

  const entries = new Map<string, SessionListEntry>();
  const itemEls = new Map<string, HTMLLIElement>();

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function renderItem(entry: SessionListEntry): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'session-item';
    li.dataset['sessionId'] = entry.sessionId;

    if (entry.sessionId === selectedSessionId) {
      li.classList.add('selected');
    }

    const shortId = entry.sessionId.slice(-8);
    const statusDot = document.createElement('span');
    statusDot.className = `session-dot ${entry.closedAt ? 'closed' : 'active'}`;

    const idSpan = document.createElement('span');
    idSpan.className = 'session-item-id';
    idSpan.textContent = `…${shortId}`;
    idSpan.title = entry.sessionId;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'session-item-time';
    timeSpan.textContent = formatTime(entry.startedAt);

    const countSpan = document.createElement('span');
    countSpan.className = 'session-item-count';
    countSpan.textContent = `${entry.recordCount}`;

    li.appendChild(statusDot);
    li.appendChild(idSpan);
    li.appendChild(timeSpan);
    li.appendChild(countSpan);

    li.addEventListener('click', () => {
      onSelectHandler?.(entry.sessionId);
    });

    return li;
  }

  function refresh(entry: SessionListEntry): void {
    const existing = itemEls.get(entry.sessionId);
    const updated = renderItem(entry);

    if (existing && existing.parentElement) {
      existing.replaceWith(updated);
    } else {
      list.prepend(updated);
    }

    itemEls.set(entry.sessionId, updated);
  }

  return {
    addOrUpdate(entry) {
      const existing = entries.get(entry.sessionId);
      const merged: SessionListEntry = {
        ...entry,
        recordCount: existing?.recordCount ?? 0,
      };
      entries.set(entry.sessionId, merged);
      refresh(merged);
    },

    incrementRecordCount(sessionId) {
      const entry = entries.get(sessionId);
      if (!entry) return;
      entry.recordCount++;
      entries.set(sessionId, entry);
      const li = itemEls.get(sessionId);
      if (li) {
        const countSpan = li.querySelector<HTMLSpanElement>('.session-item-count');
        if (countSpan) countSpan.textContent = String(entry.recordCount);
      }
    },

    setRecordCount(sessionId, count) {
      const entry = entries.get(sessionId);
      if (!entry) return;
      entry.recordCount = count;
      entries.set(sessionId, entry);
      const li = itemEls.get(sessionId);
      if (li) {
        const countSpan = li.querySelector<HTMLSpanElement>('.session-item-count');
        if (countSpan) countSpan.textContent = String(count);
      }
    },

    setSelected(sessionId) {
      const prevEl = selectedSessionId ? itemEls.get(selectedSessionId) : null;
      if (prevEl) prevEl.classList.remove('selected');

      selectedSessionId = sessionId;

      const nextEl = itemEls.get(sessionId);
      if (nextEl) nextEl.classList.add('selected');
    },

    onSelect(handler) {
      onSelectHandler = handler;
    },

    clear() {
      entries.clear();
      itemEls.clear();
      selectedSessionId = null;
      list.innerHTML = '';
    },
  };
}
