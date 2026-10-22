import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { writeThrough, pullTracked, pullWorkingDays, pushWorkingDays, pullPayrollFor } from "../services/hrmsSync";

const STORAGE_KEY = "hrms_payroll_store_v4";

export const WORKFLOW_STAGES = [
  { id: "In Progress", label: "In Progress" },
  { id: "Ready for Review", label: "Ready for Review" },
  { id: "Approved", label: "Approved" },
  { id: "Paid", label: "Paid" },
];

export const DEFAULT_DEPARTMENT_WORKING_DAYS = {
  "Engineering": 24,
  "Operations": 24,
  "Design": 24,
  "Marketing": 24,
  "Finance": 22,
  "Human Resources": 24,
  "Sales & CRM": 26,
  "Warehouse & Inventory": 26,
  "Executive": 22,
};

export const DEFAULT_DEPARTMENT_WORKING_HOURS = {
  "Engineering": 8,
  "Operations": 9,
  "Design": 8,
  "Marketing": 8,
  "Finance": 8,
  "Human Resources": 8,
  "Sales & CRM": 9,
  "Warehouse & Inventory": 9,
  "Executive": 8,
};

export function getDepartmentDays(departmentWorkingDays, deptName) {
  if (!deptName) return 24;
  if (departmentWorkingDays && departmentWorkingDays[deptName]) {
    return departmentWorkingDays[deptName];
  }
  const lower = deptName.toLowerCase();
  const found = Object.keys(departmentWorkingDays || {}).find(
    (k) => k.toLowerCase() === lower || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  if (found && departmentWorkingDays[found]) {
    return departmentWorkingDays[found];
  }
  return 24;
}

export function getDepartmentHours(departmentWorkingHours, deptName) {
  if (!deptName) return 8;
  if (departmentWorkingHours && departmentWorkingHours[deptName]) {
    return Number(departmentWorkingHours[deptName]);
  }
  const lower = deptName.toLowerCase();
  const found = Object.keys(departmentWorkingHours || {}).find(
    (k) => k.toLowerCase() === lower || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  if (found && departmentWorkingHours[found]) {
    return Number(departmentWorkingHours[found]);
  }
  return 8;
}

function calcEmployeePayable(e) {
  const std = Math.max(0, Number(e.standardSalary) || 0);
  const totalD = Math.max(1, Number(e.totalDays) || 24);
  const attended = e.attendedDays !== undefined ? Math.max(0, Number(e.attendedDays)) : totalD;
  const absent = Math.max(0, totalD - attended);
  const perDay = totalD > 0 ? std / totalD : 0;
  const attDeduction = Math.round(perDay * absent);
  const earned = Math.max(0, std - attDeduction);
  const earnings = Math.max(0, Number(e.additionalEarnings) || 0);
  const deductions = Math.max(0, Number(e.deductions) || 0);
  const advance = Math.max(0, Number(e.advance) || 0);
  return Math.max(0, earned + earnings - deductions - advance);
}

/**
 * Payroll opens empty and fills from `/hrms/payroll/` — a payslip is generated
 * and approved server-side (api.md §11.6), so a locally invented run would be
 * a number nobody else could see.
 */
const usePayrollStoreBase = create((set, get) => ({
  employees: [],
  structures: [],
  workflowStep: "Draft",
  currentPeriod: new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }),
  defaultWorkingDays: 24,
  departmentWorkingDays: DEFAULT_DEPARTMENT_WORKING_DAYS,
  departmentWorkingHours: DEFAULT_DEPARTMENT_WORKING_HOURS,

  /** Load this period's payslips and the salary structures. */
  hydrate: async () => {
    const [employees, structures, settings] = await Promise.all([
      pullTracked("payroll"),
      pullTracked("salaryStructures"),
      pullWorkingDays(),
    ]);
    set((s) => ({
      employees: employees || s.employees,
      structures: structures || s.structures,
      defaultWorkingDays: settings?.defaultWorkingDays ?? s.defaultWorkingDays,
      departmentWorkingDays: settings?.departmentWorkingDays ?? s.departmentWorkingDays,
      departmentWorkingHours: settings?.departmentWorkingHours ?? s.departmentWorkingHours,
    }));
    return employees;
  },

  /**
   * The signed-in user's own payslips, for the "My Salary" tab. Filled by
   * `loadOwnHistory` once the session knows which employee they are.
   */
  ownHistory: [],

  loadOwnHistory: async (employeeId) => {
    if (!employeeId) return [];
    const rows = (await pullPayrollFor(employeeId)) || [];
    set({ ownHistory: rows });
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ employees: [], structures: [], ownHistory: [] }),

  setWorkflowStep: (step) => {
    set({ workflowStep: step });
    get().persist();
  },

  setCurrentPeriod: (period) => {
    set({ currentPeriod: period });
    get().persist();
  },

  setDepartmentWorkingDays: (deptName, days) => {
    const d = Math.max(1, Math.min(31, Number(days) || 24));
    const currentMap = get().departmentWorkingDays || DEFAULT_DEPARTMENT_WORKING_DAYS;
    const nextMap = { ...currentMap, [deptName]: d };

    // Recalculate all employees in this department
    const nextEmployees = get().employees.map((e) => {
      const isMatch =
        e.department?.toLowerCase() === deptName.toLowerCase() ||
        (deptName === "HR" && e.department?.toLowerCase().includes("human")) ||
        (deptName === "Human Resources" && e.department?.toLowerCase() === "hr") ||
        (deptName.includes("Sales") && e.department?.toLowerCase().includes("sales")) ||
        (deptName.includes("Warehouse") && e.department?.toLowerCase().includes("warehouse"));

      if (isMatch) {
        const std = Math.max(0, Number(e.standardSalary) || 0);
        const totalD = d;
        const h = e.dailyHours || getDepartmentHours(get().departmentWorkingHours, e.department);
        const totalH = totalD * h;
        const hourlyRate = totalH > 0 ? Math.round(std / totalH) : 0;
        const attended = Math.min(totalD, e.attendedDays !== undefined ? Math.max(0, Number(e.attendedDays)) : totalD);
        const absent = Math.max(0, totalD - attended);
        const perDay = totalD > 0 ? std / totalD : 0;
        const attDeduction = Math.round(perDay * absent);
        const earned = Math.max(0, std - attDeduction);
        return {
          ...e,
          totalDays: totalD,
          dailyHours: h,
          totalHours: totalH,
          hourlyRate: hourlyRate,
          attendedDays: attended,
          earnedSalary: earned,
        };
      }
      return e;
    });

    set({ departmentWorkingDays: nextMap, employees: nextEmployees });
    get().persist();
  },

  setDepartmentWorkingHours: (deptName, hours) => {
    const h = Math.max(1, Math.min(24, Number(hours) || 8));
    const currentMap = get().departmentWorkingHours || DEFAULT_DEPARTMENT_WORKING_HOURS;
    const nextMap = { ...currentMap, [deptName]: h };

    // Recalculate all employees in this department
    const nextEmployees = get().employees.map((e) => {
      const isMatch =
        e.department?.toLowerCase() === deptName.toLowerCase() ||
        (deptName === "HR" && e.department?.toLowerCase().includes("human")) ||
        (deptName === "Human Resources" && e.department?.toLowerCase() === "hr") ||
        (deptName.includes("Sales") && e.department?.toLowerCase().includes("sales")) ||
        (deptName.includes("Warehouse") && e.department?.toLowerCase().includes("warehouse"));

      if (isMatch) {
        const std = Math.max(0, Number(e.standardSalary) || 0);
        const totalD = Number(e.totalDays) || 24;
        const totalH = totalD * h;
        const hourlyRate = totalH > 0 ? Math.round(std / totalH) : 0;
        return {
          ...e,
          dailyHours: h,
          totalHours: totalH,
          hourlyRate: hourlyRate,
        };
      }
      return e;
    });

    set({ departmentWorkingHours: nextMap, employees: nextEmployees });
    get().persist();
  },

  resetDepartmentWorkingDays: () => {
    const nextDaysMap = { ...DEFAULT_DEPARTMENT_WORKING_DAYS };
    const nextHoursMap = { ...DEFAULT_DEPARTMENT_WORKING_HOURS };
    const nextEmployees = get().employees.map((e) => {
      const d = getDepartmentDays(nextDaysMap, e.department);
      const h = getDepartmentHours(nextHoursMap, e.department);
      const std = Math.max(0, Number(e.standardSalary) || 0);
      const totalH = d * h;
      const hourlyRate = totalH > 0 ? Math.round(std / totalH) : 0;
      const attended = Math.min(d, e.attendedDays !== undefined ? Math.max(0, Number(e.attendedDays)) : d);
      const absent = Math.max(0, d - attended);
      const perDay = d > 0 ? std / d : 0;
      const attDeduction = Math.round(perDay * absent);
      const earned = Math.max(0, std - attDeduction);
      return {
        ...e,
        totalDays: d,
        dailyHours: h,
        totalHours: totalH,
        hourlyRate: hourlyRate,
        attendedDays: attended,
        earnedSalary: earned,
      };
    });
    set({
      departmentWorkingDays: nextDaysMap,
      departmentWorkingHours: nextHoursMap,
      employees: nextEmployees,
    });
    get().persist();
  },

  setDefaultWorkingDays: (days) => {
    const d = Math.max(1, Number(days) || 24);
    const next = get().employees.map((e) => {
      const std = Math.max(0, Number(e.standardSalary) || 0);
      const attended = Math.min(d, e.attendedDays !== undefined ? Math.max(0, Number(e.attendedDays)) : d);
      const absent = Math.max(0, d - attended);
      const perDay = d > 0 ? std / d : 0;
      const attDeduction = Math.round(perDay * absent);
      const earned = Math.max(0, std - attDeduction);
      return {
        ...e,
        totalDays: d,
        attendedDays: attended,
        earnedSalary: earned,
      };
    });
    set({ defaultWorkingDays: d, employees: next });
    get().persist();
  },

  updateEmployeePayroll: (id, updates) => {
    const next = get().employees.map((e) => {
      if (e.id === id) {
        const merged = { ...e, ...updates };
        const std = Math.max(0, Number(merged.standardSalary) || 0);
        const totalD = Math.max(1, Number(merged.totalDays) || get().defaultWorkingDays || 24);
        const attended = merged.attendedDays !== undefined ? Math.max(0, Number(merged.attendedDays)) : totalD;
        const absent = Math.max(0, totalD - attended);
        const perDay = totalD > 0 ? std / totalD : 0;
        const attDeduction = Math.round(perDay * absent);
        const earned = Math.max(0, std - attDeduction);
        return {
          ...merged,
          totalDays: totalD,
          attendedDays: attended,
          earnedSalary: earned,
        };
      }
      return e;
    });
    set({ employees: next });
    get().persist();
  },

  markEmployeePaid: (id, remainingPayableAmount) => {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const next = get().employees.map((e) => {
      if (e.id === id) {
        const payable = remainingPayableAmount !== undefined
          ? remainingPayableAmount
          : calcEmployeePayable(e);
        return {
          ...e,
          status: "Paid",
          paidAmount: payable,
          paymentDate: today,
        };
      }
      return e;
    });
    set({ employees: next });
    get().persist();
  },

  disburseDepartment: (deptName) => {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const next = get().employees.map((e) => {
      if (String(e.department ?? '').toLowerCase() === deptName.toLowerCase()) {
        const payable = calcEmployeePayable(e);
        return {
          ...e,
          status: "Paid",
          paidAmount: payable,
          paymentDate: today,
        };
      }
      return e;
    });
    set({ employees: next });
    get().persist();
  },

  runPayrollForAll: () => {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const next = get().employees.map((e) => {
      const payable = calcEmployeePayable(e);
      return {
        ...e,
        status: "Paid",
        paidAmount: payable,
        paymentDate: today,
      };
    });
    set({ employees: next, workflowStep: "Paid" });
    get().persist();
  },

  addStructure: (newStruct) => {
    const next = [
      ...get().structures,
      {
        id: Date.now(),
        status: "Active",
        baseMin: "₹45,000",
        baseMax: "₹70,000",
        ...newStruct,
      },
    ];
    set({ structures: next });
    get().persist();
  },

  /**
   * Called after every action. Payslips and salary structures go to their own
   * endpoints; the working-day configuration is a tenant setting.
   */
  persist: () => {
    writeThrough("payroll", get().employees);
    writeThrough("salaryStructures", get().structures);
    pushWorkingDays({
      defaultWorkingDays: get().defaultWorkingDays,
      departmentWorkingDays: get().departmentWorkingDays,
      departmentWorkingHours: get().departmentWorkingHours,
    }).catch((err) => console.warn("[HRMS] working days not saved:", err?.message || err));
  },

  /** Discard anything local and re-read payroll from the server. */
  resetDefaults: () => usePayrollStore.getState().hydrate(),
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const usePayrollStore = lazyStore(usePayrollStoreBase, "payroll");
