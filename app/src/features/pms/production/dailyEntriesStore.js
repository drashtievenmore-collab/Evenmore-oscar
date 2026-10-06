// In-memory shared store for daily production entries (no localStorage / no mock DB).
const listeners = new Set();
let entries = [];

function emit() {
  listeners.forEach((fn) => fn());
}

export const dailyEntriesStore = {
  get() {
    return entries;
  },
  set(next) {
    entries = next;
    emit();
  },
  add(entry) {
    entries = [...entries, entry];
    emit();
  },
  update(id, patch) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    emit();
  },
  remove(id) {
    entries = entries.filter((e) => e.id !== id);
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
