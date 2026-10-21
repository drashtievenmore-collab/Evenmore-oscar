import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { writeThrough, pullTracked, pullFlexibility, pushFlexibility } from "../services/hrmsSync";
const useAttendanceStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("attendance"),
      pullTracked("attendanceRegularizations"),
      pullFlexibility(),
    ]);
    set((s) => ({
      records: rows[0] || s.records,
      requests: rows[1] || s.requests,
      flexibility: rows[2] || s.flexibility,
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ records: [], requests: [] }),

  records: [],
  requests: [],
  // Grace periods and the like are tenant settings the server owns.
  flexibility: {},
  role: "HR",

  saveDailyAttendance: (date, updatedRecords) => set((s) => {
    // Merge or replace records matching this date or employee ID
    const otherRecords = s.records.filter((r) => r.date !== date);
    const combined = [...updatedRecords, ...otherRecords];
    writeThrough("attendance", combined);
    return { records: combined };
  }),

  updateRecord: (id, patch) => set((s) => {
    const recs = s.records.map((r) => r.id === id ? { ...r, ...patch } : r);
    writeThrough("attendance", recs);
    return { records: recs };
  }),

  bulkUpdate: (ids, status) => set((s) => {
    const recs = s.records.map((r) => ids.includes(r.id) ? { ...r, status } : r);
    writeThrough("attendance", recs);
    return { records: recs };
  }),

  addRequest: (r) => set((s) => {
    const newReq = {
      id: r.id || `REQ-${Date.now().toString().slice(-4)}`,
      submitted: "Today",
      status: "Pending",
      ...r,
    };
    const reqs = [newReq, ...s.requests];
    writeThrough("attendanceRegularizations", reqs);
    return { requests: reqs };
  }),

  setRequestStatus: (id, status, extra = {}) => set((s) => {
    const targetReq = s.requests.find((r) => r.id === id);
    const reqs = s.requests.map((r) => r.id === id ? { ...r, status, ...extra } : r);

    let updatedRecords = s.records;
    // If approved and was a regularization or early clock-out, write directly to matching record
    if (status === "Approved" && targetReq) {
      updatedRecords = s.records.map((rec) => {
        const matches =
          (targetReq.employeeId && rec.id === targetReq.employeeId) ||
          (rec.name && targetReq.employee && String(rec.name ?? '').toLowerCase() === String(targetReq.employee ?? '').toLowerCase());

        if (matches) {
          return {
            ...rec,
            checkIn: targetReq.requestedIn || rec.checkIn,
            checkOut: targetReq.requestedOut || rec.checkOut,
            status: targetReq.type === "Regularization" ? "Present" : rec.status,
            workHours: "08:30",
          };
        }
        return rec;
      });
    }

    writeThrough("attendance", updatedRecords);
    return { requests: reqs, records: updatedRecords };
  }),

  saveFlexibility: (flexibility) => {
    set({ flexibility });
    pushFlexibility(flexibility).catch((err) => {
      console.warn("[HRMS] flexibility not saved:", err?.message || err);
    });
  },

  // Which view the screen shows (HR vs employee); a UI choice, not stored data.
  setRole: (role) => set({ role }),

  // =============================================================================
  // COMMENTED OUT PER OSCAR LETTER PAD SCOPE (Kept for reference, do not delete):
  // =============================================================================
  // punchIn: async (coords) => {
  //   const res = await recordPunch({ type: 'IN', latitude: coords?.lat, longitude: coords?.lng });
  //   set((s) => ({ punchState: 'IN', lastPunch: res }));
  // },
  // punchOut: async (coords) => {
  //   const res = await recordPunch({ type: 'OUT', latitude: coords?.lat, longitude: coords?.lng });
  //   set((s) => ({ punchState: 'OUT', lastPunch: res }));
  // },
  // tickPunch: () => set((s) => ({ punchDuration: s.punchDuration + 1 })),
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useAttendanceStore = lazyStore(useAttendanceStoreBase, "attendance");
