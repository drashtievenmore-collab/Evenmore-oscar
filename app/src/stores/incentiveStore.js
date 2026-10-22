import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import {
  writeThrough,
  pullTracked,
  calculateQuarterlyIncentive as apiCalculateQuarterly,
  holdIncentivePayout as apiHoldPayout,
  releaseIncentivePayout as apiReleasePayout,
  approveIncentivePayout as apiApprovePayout,
  markIncentivePaid as apiMarkPaid,
} from "../services/hrmsSync";

const useIncentiveStoreBase = create((set, get) => ({
  schemes: [],
  accruals: [],
  quarterlyReport: null,
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [accruals, schemes] = await Promise.all([
        pullTracked("incentives"),
        pullTracked("incentiveSchemes"),
      ]);
      set({
        accruals: accruals || [],
        schemes: schemes || [],
        loading: false,
      });
      return { accruals, schemes };
    } catch (err) {
      set({ error: err?.message || "Failed to load incentives", loading: false });
      return null;
    }
  },

  clear: () => set({ accruals: [], schemes: [], quarterlyReport: null, error: null }),

  fetchIncentives: async () => {
    return get().hydrate();
  },

  calculateQuarterlyIncentive: async (quarter, year, employeeId = null) => {
    set({ loading: true, error: null });
    try {
      const payload = { quarter, year };
      if (employeeId) payload.employee_id = employeeId;
      const res = await apiCalculateQuarterly(payload);
      const freshAccruals = await pullTracked("incentives");
      set({
        accruals: freshAccruals || get().accruals,
        quarterlyReport: res,
        loading: false,
      });
      return res;
    } catch (err) {
      set({ error: err?.message || "Calculation failed", loading: false });
      throw err;
    }
  },

  holdPayout: async (id, reason = "Management hold") => {
    try {
      const updated = await apiHoldPayout(id, reason);
      set((s) => ({
        accruals: s.accruals.map((a) => (a.id === id ? { ...a, status: "HELD", hold_reason: reason, holdReason: reason } : a)),
      }));
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to hold payout" });
      throw err;
    }
  },

  releasePayout: async (id) => {
    try {
      const updated = await apiReleasePayout(id);
      set((s) => ({
        accruals: s.accruals.map((a) => (a.id === id ? { ...a, status: "ACCRUED", hold_reason: "", holdReason: "" } : a)),
      }));
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to release payout" });
      throw err;
    }
  },

  approveIncentive: async (id) => {
    try {
      const updated = await apiApprovePayout(id);
      set((s) => ({
        accruals: s.accruals.map((a) => (a.id === id ? { ...a, status: "APPROVED" } : a)),
      }));
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to approve payout" });
      throw err;
    }
  },

  markPaid: async (id) => {
    try {
      const updated = await apiMarkPaid(id);
      set((s) => ({
        accruals: s.accruals.map((a) => (a.id === id ? { ...a, status: "PAID" } : a)),
      }));
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to mark paid" });
      throw err;
    }
  },

  saveScheme: async (scheme) => {
    const current = get().schemes;
    const exists = current.find((s) => s.id === scheme.id);
    const updatedList = exists
      ? current.map((s) => (s.id === scheme.id ? { ...s, ...scheme } : s))
      : [...current, { ...scheme, id: scheme.id || `SCHEME-${Date.now()}` }];
    set({ schemes: updatedList });
    writeThrough("incentiveSchemes", updatedList);
  },
}));

export const useIncentiveStore = lazyStore(useIncentiveStoreBase, "incentives");
export default useIncentiveStore;
