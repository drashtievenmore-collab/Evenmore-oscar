/**
 * hrmsSync — the HRMS half of the API contract (api.md §11).
 *
 * HRMS is the widest module: people, leave, attendance, payroll, recruitment,
 * performance, training, policies and assets, spread over nine stores that each
 * used to seed themselves from `data/hrms/mocks/`. They all want the same four
 * verbs against different paths, so the registry below is the whole mapping and
 * `createSync` supplies the transport.
 *
 * Fields come off the wire in the shape the screens read, so most readers only
 * convert dates (`YYYY-MM-DD` on the wire, `DD/MM/YYYY` on screen) and add the
 * one or two aliases a table column expects.
 */
import { createSync, compact, asText, isBackendEnabled, isServerId, describeError } from './resourceSync';
import { api } from './api';
import { formatDateDDMMYYYY, toISODate } from '../utils/dateUtils';

export { isBackendEnabled, isServerId, describeError };

function isoOut(value) {
  if (!value) return undefined;
  return toISODate(value) || undefined;
}

function displayIn(value) {
  return value ? formatDateDDMMYYYY(value) : value;
}

/** Weekday name for a wire date (`2024-11-01` → `Friday`). Empty when unparseable. */
function weekdayName(value) {
  if (!value) return '';
  try {
    const iso = toISODate(value);
    const d = iso ? new Date(`${iso}T00:00:00`) : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return '';
  }
}

/** `60 Days` / `60` → `60` for integer day-count columns. */
function parseDayCount(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
}

/** `$95,000 / annum` → `95000` for CTC columns. Undefined when unparseable. */
function parseCtc(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const digits = String(value).replace(/[^0-9.]/g, '');
  const amount = Number(digits);
  return Number.isFinite(amount) && digits !== '' ? amount : undefined;
}

/** HR screen offer statuses → API vocabulary (api.md §11.5). */
function offerStatusToServer(status) {
  if (!status) return undefined;
  if (String(status).toLowerCase() === 'pending') return 'Sent';
  return status;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Pass the row through, marking it as the server's. */
const plain = (path, extra = {}) => ({
  path,
  toApi: (row) => compact({ ...row, id: undefined, _synced: undefined, _pending: undefined }),
  fromApi: (row) => ({ ...row, _synced: true }),
  ...extra,
});

/** A row whose `date`-ish fields need reformatting for the tables. */
const dated = (path, fields, extra = {}) => ({
  path,
  toApi: (row) => {
    const payload = { ...row, id: undefined, _synced: undefined, _pending: undefined };
    fields.forEach((f) => { if (payload[f] !== undefined) payload[f] = isoOut(payload[f]); });
    return compact(payload);
  },
  fromApi: (row) => {
    const out = { ...row, _synced: true };
    fields.forEach((f) => { if (out[f]) out[f] = displayIn(out[f]); });
    return out;
  },
  ...extra,
});

export const HRMS_RESOURCES = {
  // ── people ────────────────────────────────────────────────────────────────
  employees: {
    path: '/hrms/employees/',
    toApi: (e) => compact({
      name: e.name,
      email: e.email || undefined,
      phone: e.phone || undefined,
      employeeCode: e.employeeCode || e.empId || undefined,
      departmentId: e.departmentId || e.department_id || undefined,
      department: e.department || e.dept || undefined,
      designationId: e.designationId || e.designation_id || undefined,
      designation: e.designation || e.role || undefined,
      reportingManagerId: e.reportingManagerId || undefined,
      locationId: e.locationId || e.location_id || undefined,
      location: typeof e.location === 'string' ? e.location : undefined,
      joiningDate: isoOut(e.joiningDate || e.joining || e.doj) || undefined,
      joining: isoOut(e.joiningDate || e.joining || e.doj) || undefined,
      dateOfBirth: isoOut(e.dateOfBirth || e.dob),
      gender: e.gender || undefined,
      employmentType: e.employmentType || undefined,
      status: e.status || undefined,
      avatar: e.avatar || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, [
        'name', 'email', 'phone', 'department', 'designation',
        'employmentType', 'gender', 'location', 'status',
      ]),
      // Tables read `empId` and `role`; the API calls them `employeeCode` and
      // `designation`. The wire sends `joining` (joining_date); accept the
      // `joiningDate` alias too.
      id: row.id,
      empId: row.employeeCode || row.empId || row.id || '',
      employeeCode: row.employeeCode || '',
      role: row.designation || row.role || '',
      doj: displayIn(row.joiningDate || row.joining),
      joiningDate: displayIn(row.joiningDate || row.joining),
      joining: displayIn(row.joiningDate || row.joining),
      _synced: true,
    }),
  },

  departments: plain('/hrms/departments/'),
  designations: plain('/hrms/designations/'),
  locations: plain('/hrms/locations/'),
  teams: plain('/hrms/teams/'),
  holidays: {
    ...dated('/hrms/holidays/', ['date']),
    toApi: (h) => compact({
      name: h.name,
      date: isoOut(h.date),
      holidayType: h.holidayType || h.type || undefined,
      appliesTo: h.appliesTo || undefined,
      status: h.status || undefined,
      locationId: h.locationId || undefined,
    }),
    // The table reads the local keys (`day`, `type`, `appliesTo`); the
    // weekday is derived from the date, the rest pass through.
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      day: weekdayName(row.date),
      type: row.holidayType || row.type || '',
      appliesTo: row.appliesTo || '',
      status: row.status || 'Upcoming',
      _synced: true,
    }),
  },

  // ── leave ─────────────────────────────────────────────────────────────────
  leaves: {
    path: '/hrms/leave/',
    toApi: (l) => compact({
      employeeId: l.employeeId || undefined,
      leaveTypeId: l.leaveTypeId || undefined,
      fromDate: isoOut(l.fromDate || l.from),
      toDate: isoOut(l.toDate || l.to),
      days: l.days !== undefined ? num(l.days) : undefined,
      reason: l.reason || undefined,
      status: l.status || undefined,
      delegateId: l.delegateId || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['reason', 'status', 'type', 'employeeName', 'delegate']),
      from: displayIn(row.fromDate),
      to: displayIn(row.toDate),
      fromDate: displayIn(row.fromDate),
      toDate: displayIn(row.toDate),
      employee: row.employeeName || row.employee || '',
      _synced: true,
    }),
  },
  leaveTypes: plain('/hrms/leave/types/'),
  leaveEncashments: dated('/hrms/leave/encashments/', ['requestDate']),
  compOffs: dated('/hrms/comp-offs/', ['workedDate', 'expiryDate']),

  // ── attendance ────────────────────────────────────────────────────────────
  attendance: {
    path: '/hrms/attendance/',
    toApi: (a) => compact({
      employeeId: a.employeeId || undefined,
      date: isoOut(a.date),
      checkIn: a.checkIn || undefined,
      checkOut: a.checkOut || undefined,
      status: a.status || undefined,
      workLocation: a.workLocation || undefined,
      notes: a.notes || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['status', 'workLocation', 'notes', 'checkIn', 'checkOut', 'employeeName']),
      date: displayIn(row.date),
      employee: row.employeeName || row.employee || '',
      _synced: true,
    }),
  },
  attendanceRegularizations: dated('/hrms/attendance/regularizations/', ['date']),

  // ── payroll ───────────────────────────────────────────────────────────────
  payroll: {
    path: '/hrms/payroll/',
    toApi: (p) => compact({
      employeeId: p.employeeId || undefined,
      month: p.month || undefined,
      year: p.year !== undefined ? num(p.year) : undefined,
      status: p.status || undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
    // Payslips are generated, not created by hand.
    omitOnUpdate: ['employeeId', 'month', 'year'],
  },
  salaryStructures: plain('/hrms/payroll/salary-structures/'),
  advances: dated('/hrms/payroll/advances/', ['requestDate', 'date']),

  // ── recruitment ───────────────────────────────────────────────────────────
  jobs: dated('/hrms/jobs/', ['postedDate', 'closingDate']),
  candidates: dated('/hrms/candidates/', ['appliedDate']),
  applications: dated('/hrms/applications/', ['appliedDate']),
  interviews: dated('/hrms/interviews/', ['scheduledDate', 'date']),
  offers: {
    ...dated('/hrms/offers/', ['offerDate', 'joiningDate', 'expiryDate']),
    // The letter form reads flat keys (`position`, `salary`, `dept` …);
    // the API keeps the same columns plus the application link.
    toApi: (o) => compact({
      applicationId: o.applicationId || undefined,
      offeredCtc: o.offeredCtc !== undefined ? num(o.offeredCtc) : parseCtc(o.salary),
      joiningDate: isoOut(o.joiningDate),
      expiryDate: isoOut(o.expiryDate),
      status: offerStatusToServer(o.status),
      position: o.position || undefined,
      department: o.department || o.dept || undefined,
      jobType: o.jobType || o.job_type || undefined,
      location: o.location || undefined,
      workMode: o.workMode || o.work_mode || undefined,
      reportingManager: o.reportingManager || o.reporting_manager || undefined,
      probationPeriod: o.probationPeriod || o.probation_period || undefined,
      notes: o.notes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      joiningDate: displayIn(row.joiningDate),
      expiryDate: displayIn(row.expiryDate),
      dept: row.department || row.dept || '',
      jobType: row.jobType || row.job_type || 'Full-time',
      workMode: row.workMode || row.work_mode || '',
      reportingManager: row.reportingManager || row.reporting_manager || '',
      probationPeriod: row.probationPeriod || row.probation_period || '',
      salary: row.salary || (row.offeredCtc != null ? `${Number(row.offeredCtc).toLocaleString('en-IN')} / annum` : ''),
      _synced: true,
    }),
  },
  onboarding: dated('/hrms/onboarding/', ['startDate']),
  recruitmentQuestions: plain('/hrms/recruitment/questions/'),

  // ── performance ───────────────────────────────────────────────────────────
  appraisals: dated('/hrms/performance/appraisals/', ['dueDate', 'completedDate']),
  cycles: dated('/hrms/performance/cycles/', ['startDate', 'endDate']),
  goals: dated('/hrms/performance/goals/', ['dueDate']),
  indicators: plain('/hrms/performance/indicators/'),
  kpis: plain('/hrms/performance/kpis/'),

  // ── training ──────────────────────────────────────────────────────────────
  trainings: dated('/hrms/trainings/', ['startDate', 'endDate']),
  trainers: plain('/hrms/trainers/'),

  // ── policies ──────────────────────────────────────────────────────────────
  policies: dated('/hrms/policies/', ['effectiveDate', 'publishedDate']),
  policyCategories: plain('/hrms/policy-categories/'),

  assets: {
    path: '/hrms/assets/',
    toApi: (a) => compact({
      name: a.name,
      categoryId: a.categoryId || undefined,
      employeeId: a.employeeId || undefined,
      serialNumber: a.serialNumber || undefined,
      condition: a.condition || undefined,
      status: a.status || undefined,
      location: a.location || undefined,
      notes: a.notes || undefined,
      purchaseDate: isoOut(a.purchaseDate),
      warrantyExpiry: isoOut(a.warrantyExpiry),
      purchaseCost: (a.purchaseCost != null && a.purchaseCost !== '—' && !isNaN(Number(String(a.purchaseCost).replace(/[^0-9.-]+/g, ''))))
        ? Number(String(a.purchaseCost).replace(/[^0-9.-]+/g, ''))
        : null,
    }),
    fromApi: (row) => ({
      ...row,
      purchaseDate: displayIn(row.purchaseDate),
      warrantyExpiry: displayIn(row.warrantyExpiry),
      _synced: true,
    }),
  },
  assetCategories: plain('/hrms/asset-categories/'),
  assetRequests: dated('/hrms/asset-requests/', ['requestDate']),

  // ── employee lifecycle ────────────────────────────────────────────────────
  resignations: {
    ...dated('/hrms/resignations/', ['lastWorkingDay']),
    toApi: (r) => compact({
      employeeId: r.employeeId || undefined,
      submittedOn: isoOut(r.submittedDate || r.submittedOn),
      noticePeriodDays: parseDayCount(r.noticePeriod ?? r.noticePeriodDays, 30),
      lastWorkingDay: isoOut(r.lastWorkingDay),
      handoverTo: r.handoverTo || undefined,
      reason: r.reason || undefined,
      status: r.status || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      employee: row.employeeName || row.employee || '',
      submittedDate: displayIn(row.submittedOn),
      noticePeriod: row.noticePeriodDays != null ? `${row.noticePeriodDays} Days` : (row.noticePeriod || ''),
      _synced: true,
    }),
  },
  terminations: dated('/hrms/terminations/', ['terminationDate']),
  complaints: dated('/hrms/complaints/', ['raisedDate']),
  documents: dated('/hrms/documents/', ['uploadedDate', 'expiryDate']),
  approvalChains: plain('/hrms/approval-chains/'),
  calendarEvents: dated('/hrms/calendar/events/', ['startDate', 'endDate', 'date']),
};

export const hrmsSync = createSync(HRMS_RESOURCES, { label: 'hrmsSync' });

/** What the HRMS shell loads on sign-in. The rest load per screen. */
export const HRMS_CORE_KEYS = [
  'employees', 'departments', 'designations', 'locations', 'teams', 'holidays',
  'leaves', 'leaveTypes', 'attendance', 'payroll',
];

/** The wider set, for screens that need their own collection. */
export const HRMS_EXTRA_KEYS = Object.keys(HRMS_RESOURCES)
  .filter((key) => !HRMS_CORE_KEYS.includes(key));

// ── singletons and aggregates ───────────────────────────────────────────────

async function read(path, query, label) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get(path, query ? { query } : undefined);
  } catch (err) {
    console.warn(`[hrmsSync] ${label} failed:`, err?.message || err);
    return null;
  }
}

export const pullHrmsSettings = () => read('/hrms/settings/', null, 'settings');
export const pullWorkingDays = () => read('/hrms/working-days/', null, 'working days');
export const pullFlexibility = () => read('/hrms/attendance/flexibility/', null, 'flexibility');
export const pullAttendanceSummary = (query) => read('/hrms/attendance/summary/', query, 'attendance summary');
export const pullAttendanceAudit = (query) => read('/hrms/attendance/audit/', query, 'attendance audit');
export const pullLeaveBalances = (query) => read('/hrms/leave/balances/', query, 'leave balances');
export const pullOrgChart = () => read('/hrms/org-chart/', null, 'org chart');
export const pullHrmsDashboard = (query) => read('/hrms/dashboard/', query, 'dashboard');
export const pullPayrollSummary = (query) => read('/hrms/payroll/summary/', query, 'payroll summary');
export const pullRecruitmentDashboard = () => read('/hrms/recruitment/dashboard/', null, 'recruitment dashboard');
export const pullRecruitmentFunnel = () => read('/hrms/recruitment/funnel/', null, 'recruitment funnel');
export const pullTrainingDashboard = () => read('/hrms/trainings/dashboard/', null, 'training dashboard');
export const pullTrainingFunnel = () => read('/hrms/trainings/funnel/', null, 'training funnel');
export const pullPerformanceDashboard = () => read('/hrms/performance/dashboard/', null, 'performance dashboard');
export const pullIndividualAttendance = (employeeId, query) =>
  read(`/hrms/attendance/individual/${employeeId}/`, query, 'individual attendance');

export async function pushHrmsSettings(settings) {
  if (!isBackendEnabled()) return null;
  return api.put('/hrms/settings/', settings);
}

export async function pushWorkingDays(config) {
  if (!isBackendEnabled()) return null;
  return api.put('/hrms/working-days/', config);
}

export async function pushFlexibility(config) {
  if (!isBackendEnabled()) return null;
  return api.put('/hrms/attendance/flexibility/', config);
}

export async function bulkAttendance(rows) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/bulk/', { records: rows });
}

// ── record actions ──────────────────────────────────────────────────────────

export const approvePayroll = (id) => hrmsSync.act('payroll', id, 'approve', {});
export const markPayrollPaid = (id, payload = {}) => hrmsSync.act('payroll', id, 'mark-paid', payload);
export const cancelLeave = (id, payload = {}) => hrmsSync.act('leaves', id, 'cancel', payload);
export const publishJob = (id) => hrmsSync.act('jobs', id, 'publish', {});
export const assignAsset = (id, payload) => hrmsSync.act('assets', id, 'assign', payload);
export const returnAsset = (id, payload = {}) => hrmsSync.act('assets', id, 'return', payload);
export const acknowledgePolicy = (id, payload = {}) => hrmsSync.act('policies', id, 'acknowledge', payload);
export const approvePolicy = (id, payload = {}) => hrmsSync.act('policies', id, 'approve', payload);
export const archivePolicy = (id, payload = {}) => hrmsSync.act('policies', id, 'archive', payload);
export const submitPolicyForApproval = (id, payload = {}) =>
  hrmsSync.act('policies', id, 'submit-for-approval', payload);
export const terminateEmployee = (id, payload) => hrmsSync.act('employees', id, 'terminate', payload);
export const assignTrainer = (id, payload) => hrmsSync.act('trainings', id, 'assign-trainer', payload);
export const evaluateTraining = (id, payload) => hrmsSync.act('trainings', id, 'evaluate', payload);
export const addTrainingParticipants = (id, payload) => hrmsSync.act('trainings', id, 'participants', payload);

/**
 * The last rows the server gave us, per collection.
 *
 * `writeThrough` diffs against this rather than asking its caller for the
 * previous array, which is what lets the stores keep their existing actions:
 * they hand over the collection as they now want it and this works out which
 * rows are new, changed or gone.
 */
const snapshots = new Map();

/** Load a collection and remember it as the baseline for later writes. */
export async function pullTracked(key, query) {
  const rows = await hrmsSync.pull(key, query);
  if (rows) snapshots.set(key, rows);
  return rows;
}

/**
 * Write a whole collection back after a store mutated it locally.
 *
 * The HRMS stores each kept their rows in `localStorage` and saved the array
 * wholesale. Rather than rewrite every one of their actions, they now hand the
 * new array here: rows the server has not seen are created, rows that changed
 * are patched, rows that disappeared are deleted, and the fresh collection
 * becomes the next baseline.
 */
export function writeThrough(key, next = []) {
  if (!isBackendEnabled()) return Promise.resolve(next);

  const previous = snapshots.get(key) || [];
  const before = new Map(previous.map((row) => [String(row?.id), row]));
  const after = new Set(next.map((row) => String(row?.id)));
  const work = [];

  next.forEach((row) => {
    if (!row) return;
    const existing = before.get(String(row.id));
    if (!existing) {
      work.push(hrmsSync.create(key, row));
    } else if (isServerId(row.id) && JSON.stringify(existing) !== JSON.stringify(row)) {
      work.push(hrmsSync.update(key, row.id, row));
    }
  });

  previous.forEach((row) => {
    if (row && !after.has(String(row.id)) && isServerId(row.id)) {
      work.push(hrmsSync.remove(key, row.id));
    }
  });

  if (work.length === 0) {
    snapshots.set(key, next);
    return Promise.resolve(next);
  }

  return Promise.all(work)
    .then(() => pullTracked(key))
    .then((rows) => rows || next)
    .catch((err) => {
      console.warn(`[hrmsSync] ${key} not saved:`, describeError(err));
      return next;
    });
}

/** One employee's payslip history, for the "My Salary" tab. */
export async function pullPayrollFor(employeeId) {
  if (!employeeId) return null;
  return hrmsSync.pull('payroll', { employeeId });
}

export async function processPayroll(payload) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/payroll/process/', payload);
}

export default hrmsSync;
