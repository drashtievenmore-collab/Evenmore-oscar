import { apiClient, buildQuery } from './api';

// ── 1. Sales & CRM (§2.1) ──────────────────────────────────────────────────
export async function importEstimatesExcel(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient('/sales/estimates/import-excel/', {
    method: 'POST',
    data: formData,
    headers: {}, // let browser set boundary
  });
}

export async function convertEstimateToChallan(estimateId) {
  return apiClient(`/sales/estimates/${estimateId}/convert-to-challan/`, {
    method: 'POST',
  });
}

export async function convertEstimateToOrder(estimateId) {
  return apiClient(`/sales/estimates/${estimateId}/convert-to-order/`, {
    method: 'POST',
  });
}

export async function captureContractSignature(contractId, { role, signatory_type, signature, signatoryName, signatoryEmail }) {
  const finalRole = (signatory_type || role || 'client').toLowerCase();
  return apiClient(`/crm/contracts/${contractId}/capture-signature/`, {
    method: 'POST',
    data: {
      role: finalRole,
      signatory_type: finalRole,
      signature,
      signature_data: signature,
      signatoryName,
      signatory_name: signatoryName,
      signed_by: signatoryName,
      signatoryEmail,
    },
  });
}

export async function updateContractWorkflowStatus(contractId, { status, rejectionReason }) {
  return apiClient(`/crm/contracts/${contractId}/workflow-status/`, {
    method: 'POST',
    data: { status, rejectionReason },
  });
}

export async function generateContractPdf(contractId) {
  return apiClient(`/crm/contracts/${contractId}/generate-pdf/`, {
    method: 'POST',
  });
}

export async function sendContractEmail(contractId, email) {
  return apiClient(`/crm/contracts/${contractId}/send-email/`, {
    method: 'POST',
    data: { email },
  });
}

export async function fetchWonRevenueAttribution(year) {
  const query = year ? { year } : {};
  return apiClient('/crm/deals/won-revenue-attribution/', { query });
}

export async function impersonateCustomer(customerId, reason) {
  return apiClient('/auth/impersonate-customer/', {
    method: 'POST',
    data: { customerId, reason },
  });
}

// ── 2. Operations & Supply Chain (§2.2) ───────────────────────────────────
export async function fetchPoRegister(params = {}) {
  const query = typeof params === 'object' && params !== null ? params : {};
  return apiClient('/purchase/orders/register/', { query });
}

export async function fetchVendorAdvances(vendorIdOrParams) {
  const query = typeof vendorIdOrParams === 'object' && vendorIdOrParams !== null
    ? vendorIdOrParams
    : vendorIdOrParams ? { vendorId: vendorIdOrParams } : {};
  return apiClient('/purchase/advances/', { query });
}

export async function createVendorAdvance(data) {
  return apiClient('/purchase/advances/', {
    method: 'POST',
    data,
  });
}

export async function reconcileVendorAdvance(advanceId, purchaseBillId, amount) {
  return apiClient(`/purchase/advances/${advanceId}/reconcile/`, {
    method: 'POST',
    data: { purchaseBillId, bill_id: purchaseBillId, amount },
  });
}

export async function createShortSupplyDebitNote(billId, { noteReason, shortfallAmount, shortfallItems }) {
  return apiClient('/purchase/receipts/create-short-supply-debit-note/', {
    method: 'POST',
    data: { billId, noteReason, shortfallAmount, shortfallItems },
  });
}

export async function fetchVendorWeightVariations() {
  return apiClient('/purchase/receipts/vendor-weight-variations/');
}

export async function fetchDemoUnits(params = {}) {
  return apiClient('/inventory/demo-units/', { query: params });
}

export async function createDemoUnit(data) {
  return apiClient('/inventory/demo-units/', {
    method: 'POST',
    data,
  });
}

export async function returnDemoUnitInspection(unitId, data) {
  return apiClient(`/inventory/demo-units/${unitId}/return-inspection/`, {
    method: 'POST',
    data,
  });
}

export async function convertDemoUnitToSale(unitId, data) {
  return apiClient(`/inventory/demo-units/${unitId}/convert-to-sale/`, {
    method: 'POST',
    data,
  });
}

export async function fetchReworkOrders(params = {}) {
  return apiClient('/inventory/rework-orders/', { query: params });
}

export async function createReworkOrder(data) {
  return apiClient('/inventory/rework-orders/', {
    method: 'POST',
    data,
  });
}

export async function logReworkScrap(orderId, data) {
  return apiClient(`/inventory/rework-orders/${orderId}/log-scrap/`, {
    method: 'POST',
    data,
  });
}
export const logScrapFromRework = logReworkScrap;

/** Move a rework order along: Pending -> In Rework -> Completed (restored to stock). */
export async function updateReworkOrder(orderId, data) {
  return apiClient(`/inventory/rework-orders/${orderId}/`, {
    method: 'PATCH',
    data,
  });
}

export async function fetchScrapLogs(params = {}) {
  return apiClient('/inventory/scrap-logs/', { query: params });
}

export async function createScrapLog(data) {
  return apiClient('/inventory/scrap-logs/', {
    method: 'POST',
    data,
  });
}

// ── 3. Finance & Accounting (§2.4) ────────────────────────────────────────
export async function fetchBudgets() {
  return apiClient('/accounts/budgets/');
}

export async function createBudget(data) {
  return apiClient('/accounts/budgets/', {
    method: 'POST',
    data,
  });
}

export async function updateBudget(id, data) {
  return apiClient(`/accounts/budgets/${id}/`, {
    method: 'PATCH',
    data,
  });
}

export async function deleteBudget(id) {
  return apiClient(`/accounts/budgets/${id}/`, {
    method: 'DELETE',
  });
}

export async function fetchBudgetVarianceSummary() {
  return apiClient('/accounts/budgets/variance-summary/');
}

// ── 4. HRMS (§2.5) ────────────────────────────────────────────────────────
const LIFECYCLE_STORAGE_KEYS = {
  transfers: 'evenmore_hrms_transfers',
  promotions: 'evenmore_hrms_promotions',
  warnings: 'evenmore_hrms_warnings',
  awards: 'evenmore_hrms_awards',
};

function readLocalLifecycle(key) {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalLifecycle(key, list) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(list || []));
    }
  } catch {}
}

function saveLocalLifecycleItem(key, item) {
  const current = readLocalLifecycle(key);
  const existsIndex = current.findIndex((x) => String(x.id) === String(item.id));
  let updated;
  if (existsIndex >= 0) {
    updated = [...current];
    updated[existsIndex] = { ...updated[existsIndex], ...item };
  } else {
    updated = [item, ...current];
  }
  writeLocalLifecycle(key, updated);
  return item;
}

function matchesEmp(record, employeeId) {
  if (!employeeId) return true;
  const target = String(employeeId).trim().toLowerCase();
  const idStr = String(record.employeeId || record.employee || '').trim().toLowerCase();
  const nameStr = String(record.employeeName || '').trim().toLowerCase();
  const codeStr = String(record.employeeCode || '').trim().toLowerCase();
  return idStr === target || nameStr === target || codeStr === target;
}

export async function fetchEmployeeTransfers(employeeId) {
  const localItems = readLocalLifecycle(LIFECYCLE_STORAGE_KEYS.transfers).filter((item) => matchesEmp(item, employeeId));
  try {
    const query = employeeId ? { employeeId } : {};
    const res = await apiClient('/hrms/transfers/', { query });
    const serverRows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    if (serverRows.length > 0) {
      const serverIds = new Set(serverRows.map((r) => String(r.id)));
      const extraLocal = localItems.filter((l) => !serverIds.has(String(l.id)));
      return [...serverRows, ...extraLocal];
    }
    return localItems;
  } catch {
    return localItems;
  }
}

export async function createEmployeeTransfer(data) {
  const payload = {
    id: data.id || `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId: data.employeeId || data.employee,
    employeeName: data.employeeName || '',
    fromDepartmentId: data.fromDepartmentId || data.from_department,
    from_department: data.from_department || data.fromDepartmentId,
    toDepartmentId: data.toDepartmentId || data.to_department,
    to_department: data.to_department || data.toDepartmentId,
    fromLocationId: data.fromLocationId || data.from_location,
    toLocationId: data.toLocationId || data.to_location,
    effective_date: data.effective_date || data.effectiveDate,
    effectiveDate: data.effective_date || data.effectiveDate,
    reason: data.reason || '',
    status: data.status || 'Completed',
    createdAt: new Date().toISOString(),
  };
  saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.transfers, payload);
  try {
    const res = await apiClient('/hrms/transfers/', { method: 'POST', data: payload });
    const saved = res?.data || res || payload;
    saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.transfers, saved);
    return saved;
  } catch {
    return payload;
  }
}

export async function fetchEmployeePromotions(employeeId) {
  const localItems = readLocalLifecycle(LIFECYCLE_STORAGE_KEYS.promotions).filter((item) => matchesEmp(item, employeeId));
  try {
    const query = employeeId ? { employeeId } : {};
    const res = await apiClient('/hrms/promotions/', { query });
    const serverRows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    if (serverRows.length > 0) {
      const serverIds = new Set(serverRows.map((r) => String(r.id)));
      const extraLocal = localItems.filter((l) => !serverIds.has(String(l.id)));
      return [...serverRows, ...extraLocal];
    }
    return localItems;
  } catch {
    return localItems;
  }
}

export async function createEmployeePromotion(data) {
  const payload = {
    id: data.id || `promotion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId: data.employeeId || data.employee,
    employeeName: data.employeeName || '',
    fromDesignationId: data.fromDesignationId || data.previous_designation,
    previous_designation: data.previous_designation || data.fromDesignationId,
    toDesignationId: data.toDesignationId || data.new_designation,
    new_designation: data.new_designation || data.toDesignationId,
    previous_salary: data.previous_salary !== undefined ? Number(data.previous_salary) : Number(data.previousSalary || 0),
    new_salary: data.new_salary !== undefined ? Number(data.new_salary) : Number(data.newSalary || 0),
    effective_date: data.effective_date || data.effectiveDate,
    effectiveDate: data.effective_date || data.effectiveDate,
    justification: data.justification || data.notes || '',
    notes: data.notes || data.justification || '',
    status: data.status || 'Effective',
    createdAt: new Date().toISOString(),
  };
  saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.promotions, payload);
  try {
    const res = await apiClient('/hrms/promotions/', { method: 'POST', data: payload });
    const saved = res?.data || res || payload;
    saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.promotions, saved);
    return saved;
  } catch {
    return payload;
  }
}

export async function fetchEmployeeWarnings(employeeId) {
  const localItems = readLocalLifecycle(LIFECYCLE_STORAGE_KEYS.warnings).filter((item) => matchesEmp(item, employeeId));
  try {
    const query = employeeId ? { employeeId } : {};
    const res = await apiClient('/hrms/warnings/', { query });
    const serverRows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    if (serverRows.length > 0) {
      const serverIds = new Set(serverRows.map((r) => String(r.id)));
      const extraLocal = localItems.filter((l) => !serverIds.has(String(l.id)));
      return [...serverRows, ...extraLocal];
    }
    return localItems;
  } catch {
    return localItems;
  }
}

export async function createEmployeeWarning(data) {
  const payload = {
    id: data.id || `warning-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId: data.employeeId || data.employee,
    employeeName: data.employeeName || '',
    subject: data.subject || data.title,
    title: data.title || data.subject,
    severity: data.severity || data.warning_level || 'First Written',
    warning_level: data.warning_level || data.severity || 'First Written',
    issue_date: data.issue_date || data.warning_date || data.date,
    warning_date: data.warning_date || data.issue_date || data.date,
    description: data.description || data.explanation || '',
    explanation: data.explanation || data.description || '',
    status: data.status || 'Issued',
    createdAt: new Date().toISOString(),
  };
  saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.warnings, payload);
  try {
    const res = await apiClient('/hrms/warnings/', { method: 'POST', data: payload });
    const saved = res?.data || res || payload;
    saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.warnings, saved);
    return saved;
  } catch {
    return payload;
  }
}

export async function fetchEmployeeAwards(employeeId) {
  const localItems = readLocalLifecycle(LIFECYCLE_STORAGE_KEYS.awards).filter((item) => matchesEmp(item, employeeId));
  try {
    const query = employeeId ? { employeeId } : {};
    const res = await apiClient('/hrms/awards/', { query });
    const serverRows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    if (serverRows.length > 0) {
      const serverIds = new Set(serverRows.map((r) => String(r.id)));
      const extraLocal = localItems.filter((l) => !serverIds.has(String(l.id)));
      return [...serverRows, ...extraLocal];
    }
    return localItems;
  } catch {
    return localItems;
  }
}

export async function createEmployeeAward(data) {
  const payload = {
    id: data.id || `award-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId: data.employeeId || data.employee,
    employeeName: data.employeeName || '',
    award_name: data.award_name || data.title,
    title: data.title || data.award_name,
    category: data.category || 'Excellence',
    award_date: data.award_date || data.presentation_date || data.date,
    presentation_date: data.presentation_date || data.award_date || data.date,
    gift_amount: data.gift_amount !== undefined ? Number(data.gift_amount) : Number(data.cash_reward || 0),
    cash_reward: data.cash_reward !== undefined ? Number(data.cash_reward) : Number(data.gift_amount || 0),
    citation: data.citation || '',
    createdAt: new Date().toISOString(),
  };
  saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.awards, payload);
  try {
    const res = await apiClient('/hrms/awards/', { method: 'POST', data: payload });
    const saved = res?.data || res || payload;
    saveLocalLifecycleItem(LIFECYCLE_STORAGE_KEYS.awards, saved);
    return saved;
  } catch {
    return payload;
  }
}

export async function confirmEmployeeProbation(employeeId, data = {}) {
  return apiClient(`/hrms/employees/${employeeId}/confirm-probation/`, { method: 'POST', data });
}

export async function extendEmployeeProbation(employeeId, data = {}) {
  return apiClient(`/hrms/employees/${employeeId}/extend-probation/`, { method: 'POST', data });
}

export async function evaluateEmployeeLifecycle() {
  return apiClient('/hrms/employees/evaluate-lifecycle/', { method: 'POST' });
}

export async function waiveResignationNotice(resignationId, data = {}) {
  return apiClient(`/hrms/resignations/${resignationId}/waive-notice/`, { method: 'POST', data });
}

export async function shortenResignationNotice(resignationId, data = {}) {
  return apiClient(`/hrms/resignations/${resignationId}/shorten-notice/`, { method: 'POST', data });
}

export async function fetchTravelRequests(employeeId) {
  const query = employeeId ? { employeeId } : {};
  return apiClient('/hrms/travel-requests/', { query });
}

export async function createTravelRequest(data) {
  return apiClient('/hrms/travel-requests/', { method: 'POST', data });
}

export async function updateTravelRequest(id, data) {
  return apiClient(`/hrms/travel-requests/${id}/`, { method: 'PATCH', data });
}

export async function deleteTravelRequest(id) {
  return apiClient(`/hrms/travel-requests/${id}/`, { method: 'DELETE' });
}

export async function approveTravelRequest(id, remark = "") {
  return apiClient(`/hrms/travel-requests/${id}/approve/`, { method: 'POST', data: { remark } });
}

export async function rejectTravelRequest(id, reason = "") {
  return apiClient(`/hrms/travel-requests/${id}/reject/`, { method: 'POST', data: { remark: reason, reason } });
}

export async function settleTravelRequest(id, data = {}) {
  return apiClient(`/hrms/travel-requests/${id}/settle/`, { method: 'POST', data });
}

export async function fetchAnnouncements() {
  return apiClient('/hrms/announcements/');
}

export async function createAnnouncement(data) {
  return apiClient('/hrms/announcements/', { method: 'POST', data });
}

export async function updateAnnouncement(id, data) {
  return apiClient(`/hrms/announcements/${id}/`, { method: 'PATCH', data });
}

export async function publishAnnouncement(id) {
  return apiClient(`/hrms/announcements/${id}/publish/`, { method: 'POST' });
}

export async function archiveAnnouncement(id) {
  return apiClient(`/hrms/announcements/${id}/archive/`, { method: 'POST' });
}

export async function deleteAnnouncement(id) {
  return apiClient(`/hrms/announcements/${id}/`, { method: 'DELETE' });
}

export async function addComplaintComment(complaintId, text) {
  return apiClient(`/hrms/complaints/${complaintId}/comment/`, { method: 'POST', data: { text } });
}

export async function resolveComplaint(complaintId, resolution) {
  return apiClient(`/hrms/complaints/${complaintId}/resolve/`, { method: 'POST', data: { resolution } });
}

export async function sendOfferLetter(offerId) {
  return apiClient(`/hrms/offers/${offerId}/send_offer/`, { method: 'POST' });
}

export async function acceptOfferLetter(offerId) {
  return apiClient(`/hrms/offers/${offerId}/accept_offer/`, { method: 'POST' });
}


export async function calculateLeaveDaysPreview(fromDate, toDate, leaveTypeId) {
  return apiClient('/hrms/leave/calculate-days/', {
    method: 'POST',
    data: { fromDate, toDate, leaveTypeId },
  });
}

export async function generateInterviewZoom(interviewId) {
  return apiClient(`/hrms/interviews/${interviewId}/generate-zoom-meeting/`, {
    method: 'POST',
  });
}

export async function fetchScreeningQuestions(jobId) {
  const query = jobId ? { jobId } : {};
  return apiClient('/hrms/recruitment/questions/', { query });
}

export async function createScreeningQuestion(data) {
  return apiClient('/hrms/recruitment/questions/', { method: 'POST', data });
}

// ── 5. PMS (§2.6) ─────────────────────────────────────────────────────────
export async function fetchProjectBugs(projectId) {
  const query = projectId ? { projectId } : {};
  return apiClient('/pms/bugs/', { query });
}

export async function createProjectBug(data) {
  return apiClient('/pms/bugs/', { method: 'POST', data });
}

export async function updateProjectBug(bugId, data) {
  return apiClient(`/pms/bugs/${bugId}/`, { method: 'PATCH', data });
}

export async function fetchDelegatedTasks(tab = 'assigned_to_me') {
  return apiClient('/pms/delegated-tasks/', { query: { tab } });
}

export async function createDelegatedTask(data) {
  return apiClient('/pms/delegated-tasks/', { method: 'POST', data });
}
export const delegateTask = createDelegatedTask;

export async function acceptDelegatedTask(id) {
  return apiClient(`/pms/delegated-tasks/${id}/accept/`, { method: 'POST' });
}

export async function rejectDelegatedTask(id, reason) {
  return apiClient(`/pms/delegated-tasks/${id}/reject/`, { method: 'POST', data: { reason } });
}

export async function completeDelegatedTask(id, notes) {
  return apiClient(`/pms/delegated-tasks/${id}/complete/`, { method: 'POST', data: { notes } });
}

export async function fetchTimesheets(employeeId) {
  const query = employeeId ? { employeeId } : {};
  return apiClient('/pms/timesheets/', { query });
}

export async function createTimesheet(data) {
  return apiClient('/pms/timesheets/', { method: 'POST', data });
}

export async function submitTimesheet(id) {
  return apiClient(`/pms/timesheets/${id}/submit/`, { method: 'POST' });
}

export async function approveTimesheet(id) {
  return apiClient(`/pms/timesheets/${id}/approve/`, { method: 'POST' });
}

export async function rejectTimesheet(id, reason) {
  return apiClient(`/pms/timesheets/${id}/reject/`, { method: 'POST', data: { reason } });
}

export async function fetchTimesheetEntries(params = {}) {
  return apiClient('/pms/timesheet-entries/', { query: params });
}

/** Log worked hours by hand; the entry joins the caller's timesheet for that week. */
export async function logTimesheetHours({ projectId, taskId, taskName, hours, hourlyRate, date, description }) {
  return apiClient('/pms/timesheet-entries/log/', {
    method: 'POST',
    data: { projectId, taskId, taskName, hours, hourlyRate, date, description },
  });
}

export async function startLiveTimer({ projectId, taskId, description, isBillable, hourlyRate }) {
  return apiClient('/pms/timesheet-entries/start-timer/', {
    method: 'POST',
    data: { projectId, taskId, description, isBillable, hourlyRate },
  });
}

export async function stopLiveTimer(entryId) {
  return apiClient(`/pms/timesheet-entries/${entryId}/stop-timer/`, {
    method: 'POST',
  });
}

export async function deleteTimesheetEntry(id) {
  return apiClient(`/pms/timesheet-entries/${id}/`, {
    method: 'DELETE',
  });
}

export async function fetchActiveTimer() {
  return apiClient('/pms/timesheet-entries/active-timer/');
}

export const startTimesheetTimer = startLiveTimer;
export const stopTimesheetTimer = stopLiveTimer;
export const getActiveTimesheetTimer = fetchActiveTimer;

export async function fetchProjectProfitability(projectId) {
  return apiClient(`/pms/projects/${projectId}/profitability/`);
}

export async function fetchCrossProjectCalendar() {
  return apiClient('/pms/calendar-schedule/');
}

// ── 6. Platform & Settings (§2.7) ─────────────────────────────────────────
export async function fetchCustomFields(entityType) {
  const query = entityType ? { entityType } : {};
  return apiClient('/custom-fields/', { query });
}

export async function createCustomField(data) {
  return apiClient('/custom-fields/', { method: 'POST', data });
}

export async function deleteCustomField(id) {
  return apiClient(`/custom-fields/${id}/`, { method: 'DELETE' });
}

export async function fetchWebhooks() {
  return apiClient('/webhooks/');
}

export async function createWebhook(data) {
  return apiClient('/webhooks/', { method: 'POST', data });
}

export async function deleteWebhook(id) {
  return apiClient(`/webhooks/${id}/`, { method: 'DELETE' });
}

export async function testPingWebhook(id) {
  return apiClient(`/webhooks/${id}/test-ping/`, { method: 'POST' });
}

export async function sendOmnichannelNotification(data) {
  return apiClient('/notifications/send-omnichannel/', {
    method: 'POST',
    data,
  });
}

// ── 7. Targeted Services Implementation Scope ─────────────────────────────
// §2.1 CRM Bulk Lead Assignment
export async function bulkAssignLeads(data) {
  return apiClient('/crm/leads/bulk-assign/', {
    method: 'POST',
    data,
  });
}

// §2.2 Quality Control (QC) Inspection Desk (Hidden: QC out of scope)
// export async function fetchQualityInspections(params = {}) {
//   return apiClient('/inventory/quality-inspections/', { query: params });
// }
// export async function createQualityInspection(data) {
//   return apiClient('/inventory/quality-inspections/', {
//     method: 'POST',
//     data,
//   });
// }
// export async function completeQualityInspection(id, data) {
//   return apiClient(`/inventory/quality-inspections/${id}/complete-inspection/`, {
//     method: 'POST',
//     data,
//   });
// }

// §2.5 Universal Meetings & Conference Room Booking
export async function fetchMeetingRooms(params = {}) {
  return apiClient('/hrms/meeting-rooms/', { query: params });
}

export async function createMeetingRoom(data) {
  return apiClient('/hrms/meeting-rooms/', {
    method: 'POST',
    data,
  });
}

export async function fetchCompanyMeetings(params = {}) {
  return apiClient('/hrms/meetings/', { query: params });
}

export async function createCompanyMeeting(data) {
  return apiClient('/hrms/meetings/', {
    method: 'POST',
    data,
  });
}

export async function updateCompanyMeeting(id, data) {
  return apiClient(`/hrms/meetings/${id}/`, {
    method: 'PUT',
    data,
  });
}

export async function saveMeetingMinutes(id, data) {
  return apiClient(`/hrms/meetings/${id}/mom/`, {
    method: 'POST',
    data,
  });
}

// §2.8 Vendor Self-Service Portal
export async function vendorPortalLogin(email) {
  return apiClient('/purchase/vendor-portal/auth/login/', {
    method: 'POST',
    data: { email },
  });
}

export async function fetchVendorOrders(token) {
  const headers = token ? { 'X-Vendor-Token': token } : {};
  return apiClient('/purchase/vendor-portal/orders/', { headers });
}

export async function acknowledgeVendorOrder(orderId, token) {
  const headers = token ? { 'X-Vendor-Token': token } : {};
  return apiClient(`/purchase/vendor-portal/orders/${orderId}/acknowledge/`, {
    method: 'POST',
    headers,
  });
}

export async function submitVendorMilestone(orderId, data, token) {
  const headers = token ? { 'X-Vendor-Token': token } : {};
  return apiClient(`/purchase/vendor-portal/orders/${orderId}/milestones/`, {
    method: 'POST',
    data,
    headers,
  });
}

export async function submitVendorASN(data, token) {
  const headers = token ? { 'X-Vendor-Token': token } : {};
  return apiClient('/purchase/vendor-portal/asn/create/', {
    method: 'POST',
    data,
    headers,
  });
}

export async function fetchVendorLedger(token) {
  const headers = token ? { 'X-Vendor-Token': token } : {};
  return apiClient('/purchase/vendor-portal/ledger/', { headers });
}


