// Daily progress entries — backend-first (GET/POST /jobwork/pi-entries/),
// in-memory + localStorage fallback when offline.
const listeners = new Set();
let entries = [];
let loadedFor = null;

function emit() {
  listeners.forEach((fn) => fn());
}

function cacheKey() {
  return `jobwork_pi_entries_${loadedFor || 'all'}`;
}

function persistCache() {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(entries));
  } catch { /* ignore */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export const dailyEntriesStore = {
  get() {
    return entries;
  },
  set(next) {
    entries = next;
    persistCache();
    emit();
  },
  add(entry) {
    entries = [...entries, entry];
    persistCache();
    emit();
    // Push to backend; reconcile UUID when the server answers.
    import('../../../services/jobWorkSync').then(({ pushCreateVPIEntry, isJobWorkBackendEnabled }) => {
      if (!isJobWorkBackendEnabled()) return;
      pushCreateVPIEntry({
        instructionId: entry.instructionId || entry.piId || loadedFor,
        date: entry.date,
        produced: entry.produced ?? entry.producedQty ?? 0,
        by: entry.by,
        remarks: entry.remarks,
      }).then((saved) => {
        if (saved) {
          entries = entries.map((e) => (e.id === entry.id ? { ...e, ...saved, produced: saved.produced ?? e.produced } : e));
          persistCache();
          emit();
        }
      }).catch(() => {});
    });
  },
  update(id, patch) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    persistCache();
    emit();
  },
  remove(id) {
    entries = entries.filter((e) => e.id !== id);
    persistCache();
    emit();
    import('../../../services/jobWorkSync').then(({ pushDeleteVPIEntry }) => {
      pushDeleteVPIEntry(id).catch(() => {});
    });
  },
  async load(instructionId) {
    loadedFor = instructionId || null;
    const cached = loadCache();
    if (cached) {
      entries = cached;
      emit();
    }
    try {
      const { pullVPIEntries, isJobWorkBackendEnabled } = await import('../../../services/jobWorkSync');
      if (!isJobWorkBackendEnabled()) return entries;
      const rows = await pullVPIEntries(instructionId);
      if (Array.isArray(rows)) {
        entries = rows.map((r) => ({
          id: r.id,
          instructionId: r.instructionId,
          piId: r.instructionId,
          date: r.date,
          produced: r.produced ?? 0,
          by: r.by || '',
          remarks: r.remarks || '',
          _synced: true,
        }));
        persistCache();
        emit();
      }
    } catch { /* offline — keep cache */ }
    return entries;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
