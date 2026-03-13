import type { StoredRecord } from "@qa-sdk/core";

export interface EventLog {
  addEvent(record: StoredRecord): void;
  clear(): void;
}

function formatTimestamp(ts: Date | string): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  return date.toISOString().slice(11, 23);
}

function truncatePayload(payload: unknown, maxLen: number = 120): string {
  try {
    const str = JSON.stringify(payload);
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + "...";
  } catch {
    return String(payload);
  }
}

export function createEventLog(container: HTMLElement): EventLog {
  const wrapper = document.createElement("div");
  wrapper.className = "event-log";

  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("span");
  title.className = "panel-label";
  title.textContent = "Event Log";

  const clearBtn = document.createElement("button");
  clearBtn.className = "btn-clear";
  clearBtn.textContent = "Clear";

  header.appendChild(title);
  header.appendChild(clearBtn);

  const list = document.createElement("div");
  list.className = "event-log-list";

  wrapper.appendChild(header);
  wrapper.appendChild(list);
  container.appendChild(wrapper);

  function clear(): void {
    list.innerHTML = "";
  }

  clearBtn.addEventListener("click", clear);

  return {
    addEvent(record: StoredRecord) {
      const entry = document.createElement("div");
      entry.className = "event-log-entry";

      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = formatTimestamp(record.timestamp);

      const key = document.createElement("span");
      key.className = "event-key";
      key.textContent = record.eventKey;

      const payload = document.createElement("span");
      payload.className = "event-payload";
      payload.textContent = truncatePayload(record.payload);

      entry.appendChild(time);
      entry.appendChild(key);
      entry.appendChild(payload);
      list.appendChild(entry);

      list.scrollTop = list.scrollHeight;
    },

    clear,
  };
}
