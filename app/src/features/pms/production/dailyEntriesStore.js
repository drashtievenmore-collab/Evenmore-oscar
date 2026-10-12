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

/** Upload a proof photo first; returns the server file id (or undefined). */
async function uploadProofPhoto(photoFile) {
  if (!photoFile || typeof photoFile === 'string') return undefined;
  try {
    const { uploadFileToBackend } = await import('../../../services/fileUploadService');
    const name = photoFile.name || `proof-${Date.now()}.jpg`;
    return await uploadFileToBackend(photoFile, name, 'jobwork_proof');
  } catch {
    return undefined;
  }
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
  async add(entry) {
    const photoFileId = await uploadProofPhoto(entry.photoFile);
    const row = {
      ...entry,
      photoFileId: photoFileId || entry.photoFileId || undefined,
      // Until the server answers, keep the local file name so the row renders.
      photo: typeof entry.photoFile?.name === 'string' ? entry.photoFile.name : (entry.photo || ''),
    };
    delete row.photoFile;
    entries = [...entries, row];
    persistCache();
    emit();
    // Push to backend; reconcile UUID when the server answers.
    try {
      const { pushCreateVPIEntry, isJobWorkBackendEnabled } = await import('../../../services/jobWorkSync');
      if (!isJobWorkBackendEnabled()) return row;
      const saved = await pushCreateVPIEntry({
        instructionId: row.instructionId || row.piId || loadedFor,
        date: row.date,
        produced: row.produced ?? row.producedQty ?? 0,
        by: row.by,
        remarks: row.remarks,
        photoFileId: row.photoFileId,
      });
      if (saved) {
        entries = entries.map((e) => (e.id === row.id ? { ...e, ...saved, produced: saved.produced ?? e.produced } : e));
        persistCache();
        emit();
        return { ...row, ...saved };
      }
    } catch { /* offline — the cached row retries on next load */ }
    return row;
  },
  async update(id, patch) {
    const photoFileId = await uploadProofPhoto(patch.photoFile);
    const clean = { ...patch };
    delete clean.photoFile;
    if (photoFileId) {
      clean.photoFileId = photoFileId;
      clean.photo = patch.photoFile?.name || clean.photo;
    }
    entries = entries.map((e) => (e.id === id ? { ...e, ...clean } : e));
    persistCache();
    emit();
    try {
      const { pushUpdateVPIEntry, isJobWorkBackendEnabled } = await import('../../../services/jobWorkSync');
      if (!isJobWorkBackendEnabled()) return;
      const current = entries.find((e) => e.id === id) || clean;
      const saved = await pushUpdateVPIEntry(id, current);
      if (saved) {
        entries = entries.map((e) => (e.id === id ? { ...e, ...saved } : e));
        persistCache();
        emit();
      }
    } catch { /* offline — the cached edit stays until the next load */ }
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
      const { pullVPIEntries, pushCreateVPIEntry, isJobWorkBackendEnabled } = await import('../../../services/jobWorkSync');
      if (!isJobWorkBackendEnabled()) return entries;
      const rows = await pullVPIEntries(instructionId);
      if (Array.isArray(rows)) {
        const serverIds = new Set(rows.map((r) => String(r.id)));
        // Rows the server has never seen (created offline) are pushed now
        // instead of being dropped by the refresh.
        const unsynced = (cached || []).filter((e) => e && !e._synced && !serverIds.has(String(e.id)));
        const justPushed = [];
        const stillPending = [];
        for (const local of unsynced) {
          try {
            const saved = await pushCreateVPIEntry({
              instructionId: local.instructionId || local.piId || loadedFor,
              date: local.date,
              produced: local.produced ?? local.producedQty ?? 0,
              by: local.by,
              remarks: local.remarks,
              photoFileId: local.photoFileId,
            });
            if (saved) justPushed.push({ ...local, ...saved });
            else stillPending.push(local);
          } catch {
            stillPending.push(local);
          }
        }
        entries = [
          ...rows.map((r) => ({
            id: r.id,
            instructionId: r.instructionId,
            piId: r.instructionId,
            date: r.date,
            produced: r.produced ?? 0,
            by: r.by || '',
            remarks: r.remarks || '',
            photoFileId: r.photoFileId,
            photo: r.photo || '',
            photoUrl: r.photoUrl || '',
            _synced: true,
          })),
          ...justPushed,
          ...stillPending,
        ];
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
