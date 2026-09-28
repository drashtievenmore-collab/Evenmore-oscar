/**
 * crmStore — every CRM screen's single source of truth, filled from the API.
 *
 * Before this existed each page imported a seed array and kept its own copy in
 * `useState`, so two screens could disagree and nothing ever reached the
 * server. Now `hydrate()` runs once per session and every mutation is a request
 * whose answer replaces the optimistic row (the server owns ids, lead numbers
 * and stage transitions — api.md §9).
 *
 * Writes are optimistic so the table does not flicker, and a rejection rolls
 * the row back rather than leaving a record that only exists in this tab.
 */
import { create } from 'zustand';
import { lazyStore } from '../services/lazyModules';
import {
  crmSync,
  CRM_PULL_ORDER,
  pullTeamRoster,
  pullLeadStats,
  convertLead as convertLeadRequest,
  setLeadPinned,
  completeTask as completeTaskRequest,
  bulkDeleteLeads,
  describeError,
  isBackendEnabled,
} from '../services/crmSync';

const EMPTY = {
  leads: [],
  deals: [],
  tasks: [],
  stages: [],
  dealStages: [],
  sources: [],
  industries: [],
  lostReasons: [],
  masterTasks: [],
  stageTasks: [],
  taskAllocations: [],
  userAllocations: [],
  forms: [],
  projects: [],
  contracts: [],
};

/** Local placeholder id for an optimistic row, replaced by the server's. */
function tempId(prefix) {
  return `${prefix}-local-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

/** Group a collection into `{label, count}` rows for the filter panel. */
function countBy(rows, pick) {
  const counts = new Map();
  rows.forEach((row) => {
    const label = pick(row);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

const useCrmStoreBase = create((set, get) => ({
  ...EMPTY,

  roster: {},
  teamMembers: [],
  leadStats: null,

  /** Whether the "Create Lead" toggle is ON — controls modal + sidebar item visibility. */
  createLeadMode: false,
  setCreateLeadMode: (value) => set({ createLeadMode: value }),

  status: { loading: false, loaded: false, error: null, lastSyncAt: null },

  /**
   * Load everything the CRM shell reads. Collections whose request failed keep
   * whatever is already in the store instead of blanking the screen.
   */
  hydrate: async ({ force = false } = {}) => {
    if (!isBackendEnabled()) {
      set({ ...EMPTY, status: { loading: false, loaded: false, error: null, lastSyncAt: null } });
      return null;
    }
    if (get().status.loading) return null;
    if (get().status.loaded && !force) return null;

    set((s) => ({ status: { ...s.status, loading: true, error: null } }));
    try {
      const [collections, roster, stats] = await Promise.all([
        crmSync.pullMany(CRM_PULL_ORDER),
        pullTeamRoster(),
        pullLeadStats(),
      ]);
      set({
        ...collections,
        roster: roster?.roster || {},
        teamMembers: roster?.members || [],
        leadStats: stats || null,
        status: {
          loading: false,
          loaded: true,
          error: null,
          lastSyncAt: new Date().toISOString(),
        },
      });
      return collections;
    } catch (err) {
      set((s) => ({ status: { ...s.status, loading: false, error: describeError(err) } }));
      return null;
    }
  },

  /** Re-read one collection — after a convert, an import, a bulk action. */
  refresh: async (key) => {
    const rows = await crmSync.pull(key);
    if (rows) set({ [key]: rows });
    return rows;
  },

  /**
   * Generic create/update/delete. Every entity in `CRM_RESOURCES` gets the same
   * three verbs, so the pages below call `createRecord('leads', …)` rather than
   * each growing its own copy of this dance.
   */
  createRecord: async (key, record) => {
    const optimistic = { ...record, id: record.id || tempId(key), _pending: true };
    set((s) => ({ [key]: [optimistic, ...(s[key] || [])] }));
    try {
      const saved = await crmSync.create(key, record);
      if (!saved) {
        set((s) => ({ [key]: (s[key] || []).filter((r) => r.id !== optimistic.id) }));
        return null;
      }
      set((s) => ({
        [key]: (s[key] || []).map((r) => (r.id === optimistic.id ? saved : r)),
      }));
      return saved;
    } catch (err) {
      set((s) => ({ [key]: (s[key] || []).filter((r) => r.id !== optimistic.id) }));
      throw err;
    }
  },

  updateRecord: async (key, id, updates) => {
    const previous = (get()[key] || []).find((r) => r.id === id);
    set((s) => ({
      [key]: (s[key] || []).map((r) => (r.id === id ? { ...r, ...updates, _pending: true } : r)),
    }));
    try {
      const saved = await crmSync.update(key, id, updates);
      set((s) => ({
        [key]: (s[key] || []).map((r) => {
          if (r.id !== id) return r;
          return saved || { ...r, ...updates, _pending: false };
        }),
      }));
      return saved;
    } catch (err) {
      if (previous) {
        set((s) => ({ [key]: (s[key] || []).map((r) => (r.id === id ? previous : r)) }));
      }
      throw err;
    }
  },

  deleteRecord: async (key, id) => {
    const previous = get()[key] || [];
    set({ [key]: previous.filter((r) => r.id !== id) });
    try {
      await crmSync.remove(key, id);
      return true;
    } catch (err) {
      set({ [key]: previous });
      throw err;
    }
  },

  // ── leads ─────────────────────────────────────────────────────────────────

  createLead: (lead) => get().createRecord('leads', lead),
  updateLead: (id, updates) => get().updateRecord('leads', id, updates),
  deleteLead: (id) => get().deleteRecord('leads', id),

  deleteLeads: async (ids) => {
    const previous = get().leads;
    set({ leads: previous.filter((l) => !ids.includes(l.id)) });
    try {
      await bulkDeleteLeads(ids);
      return true;
    } catch (err) {
      set({ leads: previous });
      throw err;
    }
  },

  toggleLeadPin: async (id) => {
    const lead = get().leads.find((l) => l.id === id);
    if (!lead) return null;
    const pinned = !lead.isPinned;
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, isPinned: pinned } : l)) }));
    try {
      await setLeadPinned(id, pinned);
      return pinned;
    } catch (err) {
      set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, isPinned: !pinned } : l)) }));
      throw err;
    }
  },

  /** The server creates the party and/or deal, so both collections re-read. */
  convertLead: async (id, payload) => {
    const result = await convertLeadRequest(id, payload);
    await Promise.all([get().refresh('leads'), get().refresh('deals')]);
    return result;
  },

  // ── tasks ─────────────────────────────────────────────────────────────────

  createTask: (task) => get().createRecord('tasks', task),
  updateTask: (id, updates) => get().updateRecord('tasks', id, updates),
  deleteTask: (id) => get().deleteRecord('tasks', id),

  completeTask: async (id, payload = {}) => {
    const saved = await completeTaskRequest(id, payload);
    if (saved?.id) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? saved : t)) }));
    } else {
      await get().refresh('tasks');
    }
    return saved;
  },

  // ── deals ─────────────────────────────────────────────────────────────────

  createDeal: (deal) => get().createRecord('deals', deal),
  updateDeal: (id, updates) => get().updateRecord('deals', id, updates),
  deleteDeal: (id) => get().deleteRecord('deals', id),

  /** Reset on sign-out so the next user never sees the previous one's rows. */
  clear: () => set({
    ...EMPTY,
    roster: {},
    teamMembers: [],
    leadStats: null,
    status: { loading: false, loaded: false, error: null, lastSyncAt: null },
  }),
}));

// ── derived views the pages used to import as fixed arrays ──────────────────
//
// These are plain functions over a snapshot, called inside `useMemo`. As store
// selectors they would allocate a new array on every render and React would
// never see the state settle.

/** Tabs above the lead list: every active stage, with its live count. */
export function leadTabsFrom(leads = [], stages = []) {
  const active = stages.filter((stage) => stage.isActive !== false);
  return [
    { key: 'All Leads', label: 'All Leads', count: leads.length },
    ...active.map((stage) => ({
      key: stage.name,
      label: stage.name,
      count: leads.filter((l) => l.stageId === stage.id || l.status === stage.name).length,
    })),
  ];
}

export function statusFacetsFrom(leads = []) {
  return countBy(leads, (l) => l.status);
}

export function sourceFacetsFrom(leads = [], sources = []) {
  const byId = new Map(sources.map((s) => [s.id, s.name]));
  return countBy(leads, (l) => l.source || byId.get(l.sourceId));
}

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useCrmStore = lazyStore(useCrmStoreBase, "crm");
export default useCrmStore;
