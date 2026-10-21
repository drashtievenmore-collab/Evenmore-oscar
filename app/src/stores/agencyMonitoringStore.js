import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import {
  writeThrough,
  pullTracked,
  submitAgencyDailyEntry as apiSubmitEntry,
  pullTodayAgencyEntries,
  pullAgencySummary as apiPullSummary,
  pullAgencyAssignments as apiPullAssignments,
  createAgencyAssignment as apiCreateAssignment,
} from "../services/hrmsSync";

const useAgencyMonitoringStoreBase = create((set, get) => ({
  dailyEntries: [],
  assignedAgencies: [],
  todayEntries: [],
  agencySummaries: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [entries, assignments, summaries] = await Promise.all([
        pullTracked("agencyMonitoring"),
        apiPullAssignments(),
        apiPullSummary(),
      ]);
      set({
        dailyEntries: entries || [],
        assignedAgencies: assignments || [],
        agencySummaries: summaries || [],
        loading: false,
      });
      return { entries, assignments, summaries };
    } catch (err) {
      set({ error: err?.message || "Failed to load agency monitoring", loading: false });
      return null;
    }
  },

  clear: () => set({ dailyEntries: [], assignedAgencies: [], todayEntries: [], agencySummaries: [], error: null }),

  fetchTodayEntries: async (employeeId = null) => {
    try {
      const entries = await pullTodayAgencyEntries(employeeId);
      set({ todayEntries: entries || [] });
      return entries;
    } catch (err) {
      console.warn("Failed to fetch today entries", err);
      return [];
    }
  },

  submitEntry: async (payload) => {
    set({ loading: true, error: null });
    try {
      const newEntry = await apiSubmitEntry(payload);
      const updatedEntries = [newEntry, ...get().dailyEntries];
      set({ dailyEntries: updatedEntries, loading: false });
      // Refresh summary
      get().fetchAgencySummary();
      return newEntry;
    } catch (err) {
      set({ error: err?.message || "Failed to submit daily entry", loading: false });
      throw err;
    }
  },

  fetchAgencySummary: async () => {
    try {
      const summaries = await apiPullSummary();
      set({ agencySummaries: summaries || [] });
      return summaries;
    } catch (err) {
      console.warn("Failed to fetch agency summary", err);
      return [];
    }
  },

  saveAssignment: async (payload) => {
    try {
      const res = await apiCreateAssignment(payload);
      set((s) => ({ assignedAgencies: [res, ...s.assignedAgencies] }));
      return res;
    } catch (err) {
      set({ error: err?.message || "Failed to save agency assignment" });
      throw err;
    }
  },
}));

export const useAgencyMonitoringStore = lazyStore(useAgencyMonitoringStoreBase, "agencyMonitoring");
export default useAgencyMonitoringStore;
