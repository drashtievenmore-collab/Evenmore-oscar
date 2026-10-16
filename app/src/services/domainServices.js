import { api } from './api';

// ── CRM ──────────────────────────────────────────────────────────────────
// Graph parity: Lead Data Operations, Notes & Discussions, Stage & Task
// Kanban, Lead Detail Workspace (users/products/files), Custom Form Builder.

export const crmService = {
  // Leads (existing — preserved)
  getLeads: (query) => api.get('/crm/leads/', { query }),
  getLead: (id) => api.get(`/crm/leads/${id}/`),
  createLead: (data) => api.post('/crm/leads/', data),
  updateLead: (id, data) => api.patch(`/crm/leads/${id}/`, data),
  deleteLead: (id) => api.delete(`/crm/leads/${id}/`),
  // Leads — bulk / pin (graph: deleteAllLeads, pinLead, togglePinLead)
  bulkDeleteLeads: (ids) => api.post('/crm/leads/bulk-delete/', { ids }),
  pinLead: (id) => api.post(`/crm/leads/${id}/pin/`),
  unpinLead: (id) => api.post(`/crm/leads/${id}/unpin/`),
  // Lead users & products (graph: addUser/editUser, addProduct/editProduct)
  getLeadUsers: (leadId) => api.get(`/crm/leads/${leadId}/users/`),
  addLeadUser: (leadId, data) => api.post(`/crm/leads/${leadId}/users/`, data),
  updateLeadUser: (leadId, userId, data) => api.patch(`/crm/leads/${leadId}/users/${userId}/`, data),
  getLeadProducts: (leadId) => api.get(`/crm/leads/${leadId}/products/`),
  addLeadProduct: (leadId, data) => api.post(`/crm/leads/${leadId}/products/`, data),
  updateLeadProduct: (leadId, productId, data) => api.patch(`/crm/leads/${leadId}/products/${productId}/`, data),
  // Sources & emails (graph: addSource, sendEmail, toggleRecipient)
  getLeadSources: (leadId) => api.get(`/crm/leads/${leadId}/sources/`),
  addLeadSource: (leadId, data) => api.post(`/crm/leads/${leadId}/sources/`, data),
  sendLeadEmail: (leadId, data) => api.post(`/crm/leads/${leadId}/emails/`, data),
  // Discussion & notes (graph: DiscussionNotesTab + 8 handlers)
  getDiscussionThreads: (leadId) => api.get(`/crm/leads/${leadId}/threads/`),
  sendThreadMessage: (leadId, threadId, data) => api.post(`/crm/leads/${leadId}/threads/${threadId}/messages/`, data),
  logMailAction: (leadId, data) => api.post(`/crm/leads/${leadId}/emails/`, data),
  saveNote: (leadId, data) => api.post(`/crm/leads/${leadId}/notes/`, data),
  // Files (graph: handleUploadFiles/handleViewFile/handleDownloadFile/handleRemoveFile)
  getLeadFiles: (leadId) => api.get(`/crm/leads/${leadId}/files/`),
  uploadLeadFiles: (leadId, data) => api.post(`/crm/leads/${leadId}/files/`, data),
  deleteLeadFile: (leadId, fileId) => api.delete(`/crm/leads/${leadId}/files/${fileId}/`),
  // Tasks (existing get/create — preserved; graph adds update/delete/stages)
  getTasks: (query) => api.get('/crm/tasks/', { query }),
  createTask: (data) => api.post('/crm/tasks/', data),
  updateTask: (id, data) => api.patch(`/crm/tasks/${id}/`, data),
  deleteTask: (id) => api.delete(`/crm/tasks/${id}/`),
  getStageTasks: () => api.get('/crm/stage-tasks/'),
  saveStageTasks: (data) => api.post('/crm/stage-tasks/', data),
  // Form builder (graph: FIELD_LIBRARY, createField, sections)
  getLeadForms: () => api.get('/crm/forms/'),
  getLeadForm: (id) => api.get(`/crm/forms/${id}/`),
  saveLeadForm: (data) => api.post('/crm/forms/', data),
  updateLeadForm: (id, data) => api.patch(`/crm/forms/${id}/`, data),
  deleteLeadForm: (id) => api.delete(`/crm/forms/${id}/`),
  // Deal → CRM project hand-off (server links party/deal/owner/value)
  createDealProject: (dealId, data) => api.post(`/crm/deals/${dealId}/create-project/`, data || {}),
  // Deal timeline entries (mirrors the server audit trail)
  getDealActivities: (dealId) => api.get(`/crm/deals/${dealId}/activities/`),
  postDealActivity: (dealId, data) => api.post(`/crm/deals/${dealId}/activities/`, data || {}),
  // Deal workspace lines, documents (persisted sub-resources)
  getDealLines: (dealId) => api.get(`/crm/deals/${dealId}/lines/`),
  addDealLine: (dealId, data) => api.post(`/crm/deals/${dealId}/lines/`, data || {}),
  updateDealLine: (dealId, lineId, data) => api.patch(`/crm/deals/${dealId}/lines/${lineId}/`, data || {}),
  deleteDealLine: (dealId, lineId) => api.delete(`/crm/deals/${dealId}/lines/${lineId}/`),
  getDealDocuments: (dealId) => api.get(`/crm/deals/${dealId}/documents/`),
  addDealDocument: (dealId, data) => api.post(`/crm/deals/${dealId}/documents/`, data || {}),
  deleteDealDocument: (dealId, documentId) => api.delete(`/crm/deals/${dealId}/documents/${documentId}/`),
};

// ── Sales pipeline ───────────────────────────────────────────────────────

export const salesService = {
  // Existing — preserved
  getQuotations: (query) => api.get('/sales/quotations/', { query }),
  getOrders: (query) => api.get('/sales/orders/', { query }),
  getInvoices: (query) => api.get('/sales/invoices/', { query }),
  getPayments: (query) => api.get('/sales/payments/', { query }),
  createInvoice: (data) => api.post('/sales/invoices/', data),
  // Full document pipeline: Quotation → Order → Invoice → Challan → Payment → Return
  createQuotation: (data) => api.post('/sales/quotations/', data),
  updateQuotationStatus: (id, status) => api.patch(`/sales/quotations/${id}/`, { status }),
  // Customer approval: Accepted + automatic Lead -> Customer conversion
  // (transactional on the server; never creates a Sales Order).
  approveQuotation: (id, data) => api.post(`/sales/quotations/${id}/approve/`, data || {}),
  acceptQuotation: (id, data) => api.post(`/sales/quotations/${id}/accept/`, data || {}),
  convertQuotationToOrder: (id) => api.post(`/sales/quotations/${id}/convert-to-order/`),
  createOrder: (data) => api.post('/sales/orders/', data),
  updateOrderStage: (id, stage) => api.patch(`/sales/orders/${id}/`, { stage }),
  convertOrderToChallan: (id) => api.post(`/sales/orders/${id}/convert-to-challan/`),
  convertOrderToInvoice: (id) => api.post(`/sales/orders/${id}/convert-to-invoice/`),
  updateInvoiceStatus: (id, status) => api.patch(`/sales/invoices/${id}/`, { status }),
  getChallans: (query) => api.get('/sales/challans/', { query }),
  recordPaymentIn: (data) => api.post('/sales/payments/', data),
  getReturns: (query) => api.get('/sales/returns/', { query }),
  createSalesReturn: (data) => api.post('/sales/returns/', data),
  getCustomerLedger: (customerId) => api.get(`/sales/customers/${customerId}/ledger/`),
  getInvoiceOutstanding: (invoiceId) => api.get(`/sales/invoices/${invoiceId}/outstanding/`),
  // Commercials & Brokerage (Phase 3)
  getBrokerCommissions: (query) => api.get('/sales/broker-commissions/', { query }),
  approveBrokerCommission: (id) => api.post(`/sales/broker-commissions/${id}/approve/`),
  makeBrokerPayable: (id) => api.post(`/sales/broker-commissions/${id}/make-payable/`),
  payBrokerCommission: (id, data) => api.post(`/sales/broker-commissions/${id}/pay/`, data),
  getBrokerStatement: (query) => api.get('/sales/broker-commissions/statement/', { query }),
  getPartyDiscounts: (query) => api.get('/sales/party-discounts/', { query }),
  getPartyDiscountAnnualReport: (query) => api.get('/sales/party-discounts/annual-report/', { query }),
  getOrderPickingList: (id) => api.get(`/sales/orders/${id}/picking-list/`),
  // E-Invoice & E-Way Bill
  generateInvoiceIRN: (id) => api.post(`/sales/invoices/${id}/generate-irn/`),
  cancelInvoiceIRN: (id, data) => api.post(`/sales/invoices/${id}/cancel-irn/`, data),
  generateInvoiceEwayBill: (id, data) => api.post(`/sales/invoices/${id}/generate-eway-bill/`, data),
  generateChallanEwayBill: (id, data) => api.post(`/sales/delivery-challans/${id}/generate-eway-bill/`, data),
};

// ── Purchase pipeline ────────────────────────────────────────────────────

export const purchaseService = {
  getVendors: (query) => api.get('/purchase/vendors/', { query }),
  getPurchaseOrders: (query) => api.get('/purchase/orders/', { query }),
  createPurchaseOrder: (data) => api.post('/purchase/orders/', data),
  getPurchaseBills: (query) => api.get('/purchase/bills/', { query }),
  createPurchaseBill: (data) => api.post('/purchase/bills/', data),
  getVendorBills: (query) => api.get('/purchase/vendor-bills/', { query }),
  getVendorBill: (id) => api.get(`/purchase/vendor-bills/${id}/`),
  createVendorBill: (data) => api.post('/purchase/vendor-bills/', data),
  updateVendorBill: (id, data) => api.patch(`/purchase/vendor-bills/${id}/`, data),
  deleteVendorBill: (id) => api.delete(`/purchase/vendor-bills/${id}/`),
  sendVendorBillForMatching: (id) => api.post(`/purchase/vendor-bills/${id}/send-for-matching/`, {}),
  getVendorBillMatching: (id) => api.get(`/purchase/vendor-bills/${id}/matching/`),
  recheckVendorBillMatching: (id) => api.post(`/purchase/vendor-bills/${id}/recheck-matching/`, {}),
  approveVendorBill: (id, remarks) => api.post(`/purchase/vendor-bills/${id}/approve/`, { remarks: remarks || '' }),
  rejectVendorBill: (id, remarks) => api.post(`/purchase/vendor-bills/${id}/reject/`, { remarks: remarks || '' }),
  getVendorBillApprovalHistory: (id) => api.get(`/purchase/vendor-bills/${id}/approval-history/`),
  recordPaymentOut: (data) => api.post('/purchase/payments/', data),
  getPaymentsOut: (query) => api.get('/purchase/payments/', { query }),
  getPurchaseReturns: (query) => api.get('/purchase/returns/', { query }),
  createPurchaseReturn: (data) => api.post('/purchase/returns/', data),
  getExpenses: (query) => api.get('/purchase/expenses/', { query }),
  createExpense: (data) => api.post('/purchase/expenses/', data),
  getVendorLedger: (vendorId) => api.get(`/purchase/vendors/${vendorId}/ledger/`),
  getBillOutstanding: (billId) => api.get(`/purchase/bills/${billId}/outstanding/`),
};

// ── Parties ──────────────────────────────────────────────────────────────

export const partiesService = {
  getParties: (query) => api.get('/parties/', { query }),
  getParty: (id) => api.get(`/parties/${id}/`),
  createParty: (data) => api.post('/parties/', data),
  updateParty: (id, data) => api.patch(`/parties/${id}/`, data),
  getCustomers: (query) => api.get('/parties/customers/', { query }),
  getVendors: (query) => api.get('/parties/vendors/', { query }),
};

// ── HRMS ─────────────────────────────────────────────────────────────────

export const hrmsService = {
  // Existing — preserved
  getEmployees: (query) => api.get('/hrms/employees/', { query }),
  getAttendance: (query) => api.get('/hrms/attendance/', { query }),
  getLeaveRequests: (query) => api.get('/hrms/leave/', { query }),
  getPayroll: (query) => api.get('/hrms/payroll/', { query }),
  getCandidates: (query) => api.get('/hrms/candidates/', { query }),
  // Attendance & regularization
  markAttendance: (data) => api.post('/hrms/attendance/', data),
  bulkMarkAttendance: (data) => api.post('/hrms/attendance/bulk/', data),
  requestRegularization: (data) => api.post('/hrms/attendance/regularize/', data),
  approveRegularization: (id, approved) => api.patch(`/hrms/attendance/regularizations/${id}/`, { approved }),
  // Leave & payroll
  requestLeave: (data) => api.post('/hrms/leave/', data),
  approveLeave: (id, approved) => api.patch(`/hrms/leave/${id}/`, { approved }),
  processPayroll: (data) => api.post('/hrms/payroll/process/', data),
  // Recruitment pipeline
  createJob: (data) => api.post('/hrms/jobs/', data),
  moveCandidate: (id, stage) => api.patch(`/hrms/candidates/${id}/`, { stage }),
  scheduleInterview: (data) => api.post('/hrms/interviews/', data),
  createOffer: (data) => api.post('/hrms/offers/', data),
  // Performance / training / org
  getKpis: (query) => api.get('/hrms/performance/kpis/', { query }),
  createAppraisal: (data) => api.post('/hrms/performance/appraisals/', data),
  trackGoal: (id, data) => api.patch(`/hrms/performance/goals/${id}/`, data),
  getTrainings: (query) => api.get('/hrms/trainings/', { query }),
};

// ── Inventory ────────────────────────────────────────────────────────────

export const inventoryService = {
  getDashboard: (query) => api.get('/inventory/dashboard/', { query }),
  getQCDashboard: (query) => api.get('/inventory/qc/dashboard/', { query }),
  getQCPending: (query) => api.get('/inventory/qc/pending/', { query }),
  bulkAssignQC: (data) => api.post('/inventory/qc/pending/bulk-assign/', data),
  completeQCInspection: (data) => api.post('/inventory/qc/complete/', data),
  updateQCDisposition: (receiptId, data) => api.post(`/purchase/receipts/${receiptId}/qc/`, data),
  getQCRegister: (query) => api.get('/inventory/qc/register/', { query }),
  createManualQC: (data) => api.post('/inventory/qc/register/manual/', data),
  getQCDispositionList: (query) => api.get('/inventory/qc/disposition/', { query }),
  saveQCDisposition: (data) => api.post('/inventory/qc/disposition/', data),
  getQCReinspection: (query) => api.get('/inventory/qc/reinspection/', { query }),
  createQCReinspection: (data) => api.post('/inventory/qc/reinspection/', data),
  saveQCReinspectionDisposition: (data) => api.post('/inventory/qc/reinspection/', { ...data, actionType: 'disposition' }),
  getQCReports: (query) => api.get('/inventory/qc/reports/', { query }),
  // Lot / Taka Register
  getLotRegister: (query) => api.get('/inventory/lot-register/', { query }),
  createLotTaka: (data) => api.post('/inventory/lot-register/', data),
  updateLotTaka: (id, data) => api.patch(`/inventory/lot-register/${id}/`, data),
  // Taka Tag Print
  getTakaTags: (query) => api.get('/inventory/taka-tags/', { query }),
  recordTakaTagPrint: (data) => api.post('/inventory/taka-tags/print/', data),
  scanTakaTag: (code) => api.get('/inventory/taka-tags/scan/', { query: { code } }),
  getTakaTagHistory: (id) => api.get(`/inventory/taka-tags/${id}/history/`),
  getTakaTagsPdfUrl: (ids) => `/api/inventory/taka-tags/pdf/?ids=${Array.isArray(ids) ? ids.join(',') : ids}`,
  // Phase 2.3 Traceability & Ageing
  getLotTraceability: (target) => api.get('/inventory/traceability/', { query: { target } }),
  getStockAgeing: (query) => api.get('/inventory/stock/ageing/', { query }),
  getSlowMovingStock: (query) => api.get('/inventory/stock/slow-moving/', { query }),
  // Phase 2.6 QC Inspections (4-Point ASTM Piece Inspection)
  getQCInspections: (query) => api.get('/inventory/qc-inspections/', { query }),
  getQCInspection: (id) => api.get(`/inventory/qc-inspections/${id}/`),
  createQCInspection: (data) => api.post('/inventory/qc-inspections/', data),
  updateQCInspection: (id, data) => api.patch(`/inventory/qc-inspections/${id}/`, data),
  approveQCInspection: (id) => api.post(`/inventory/qc-inspections/${id}/approve/`),
  getDefects: (query) => api.get('/inventory/defects/', { query }),
  // Existing — preserved
  getItems: (query) => api.get('/inventory/items/', { query }),
  getStockPositions: (query) => api.get('/inventory/stock/', { query }),
  getCombinedGreyStock: (query) => api.get('/inventory/combined-grey-stock/', { query }),
  getCombinedGreyStockSetting: () => api.get('/inventory/combined-grey-stock/setting/'),
  updateCombinedGreyStockSetting: (data) => api.post('/inventory/combined-grey-stock/setting/', data),
  issueSample: (data) => api.post('/inventory/stock/', { ...data, action: 'issue_sample' }),
  returnSample: (data) => api.post('/inventory/stock/', { ...data, action: 'return_sample' }),
  getTransfers: (query) => api.get('/inventory/transfers/', { query }),
  getLocations: (query) => api.get('/inventory/locations/', { query }),
  getLocationsSummary: () => api.get('/inventory/locations/summary/'),
  getLocationsHierarchy: () => api.get('/inventory/locations/hierarchy/'),
  getLocationDetails: (id) => api.get(`/inventory/locations/${id}/details/`),
  createLocation: (data) => api.post('/inventory/locations/', data),
  updateLocation: (id, data) => api.patch(`/inventory/locations/${id}/`, data),
  deleteLocation: (id) => api.delete(`/inventory/locations/${id}/`),
  // Master, movements, valuation & audit
  createItem: (data) => api.post('/inventory/items/', data),
  updateItem: (id, data) => api.patch(`/inventory/items/${id}/`, data),
  deleteItem: (id) => api.delete(`/inventory/items/${id}/`),
  adjustStock: (data) => api.post('/inventory/adjustments/', data),
  getMovements: (query) => api.get('/inventory/movements/', { query }),
  createTransfer: (data) => api.post('/inventory/transfers/', data),
  reportFaultyPart: (data) => api.post('/inventory/faulty-parts/', data),
  updateFaultyPartStatus: (id, status) => api.patch(`/inventory/faulty-parts/${id}/`, { status }),
  recordServiceUsage: (data) => api.post('/inventory/service-usage/', data),
  getValuation: (query) => api.get('/inventory/valuation/', { query }),
  createZoneRequest: (data) => api.post('/inventory/zone-requests/', data),
  updateZoneRequest: (id, status) => api.patch(`/inventory/zone-requests/${id}/`, { status }),
  createMonthEndAudit: (data) => api.post('/inventory/audits/', data),
  // Sampling (Phase 3.2)
  getSamples: (query) => api.get('/inventory/samples/', { query }),
  getSample: (id) => api.get(`/inventory/samples/${id}/`),
  createSample: (data) => api.post('/inventory/samples/', data),
  returnSampleAction: (id, data) => api.post(`/inventory/samples/${id}/return-sample/`, data),
  consumeSampleAction: (id, data) => api.post(`/inventory/samples/${id}/consume-sample/`, data),
  getSampleDashboard: () => api.get('/inventory/samples/dashboard/'),
  // Logistics & Tempo (Phase 3.7)
  getTrips: (query) => api.get('/inventory/trips/', { query }),
  getTrip: (id) => api.get(`/inventory/trips/${id}/`),
  createTrip: (data) => api.post('/inventory/trips/', data),
  allocateTripFreight: (id) => api.post(`/inventory/trips/${id}/allocate-freight/`),
  getTransporters: (query) => api.get('/masters/transporters/', { query }),
  createTransporter: (data) => api.post('/masters/transporters/', data),
  // Costing & Lot Profitability (Phase 3.1)
  getLotCostEntries: (query) => api.get('/inventory/lot-cost-entries/', { query }),
  createLotCostEntry: (data) => api.post('/inventory/lot-cost-entries/', data),
  getLotLandedCost: (lotNumber) => api.get('/inventory/lot-cost-entries/landed-cost/', { query: { lotNumber } }),
  getLotProfitability: (query) => api.get('/inventory/lot-cost-entries/profitability/', { query }),
};

export const productionService = {
  getAgencyDashboard: (query) => api.get('/production/dashboard/agencies/', { query }),
  getEmployeeDashboard: (query) => api.get('/production/dashboard/employees/', { query }),
  getSalespersonDashboard: (query) => api.get('/production/dashboard/salesperson/', { query }),
  getInstructions: (query) => api.get('/production/instructions/', { query }),
  getDailyEntries: (query) => api.get('/production/daily-entries/', { query }),
  // Salesperson Incentives (Phase 3.4)
  getIncentiveSchemes: (query) => api.get('/pms/incentive-schemes/', { query }),
  createIncentiveScheme: (data) => api.post('/pms/incentive-schemes/', data),
  updateIncentiveScheme: (id, data) => api.patch(`/pms/incentive-schemes/${id}/`, data),
  calculateIncentive: (id, data) => api.post(`/pms/incentive-schemes/${id}/calculate/`, data),
  getIncentiveCalculations: (query) => api.get('/pms/incentive-calcs/', { query }),
  approveIncentiveCalculation: (id) => api.post(`/pms/incentive-calcs/${id}/approve/`),
  postIncentiveCalculation: (id) => api.post(`/pms/incentive-calcs/${id}/post-to-ledger/`),
  payIncentiveCalculation: (id, data) => api.post(`/pms/incentive-calcs/${id}/pay/`, data),
  reverseIncentiveCalculation: (id, data) => api.post(`/pms/incentive-calcs/${id}/reverse/`, data),
};

export const accountingService = {
  getAccounts: (query) => api.get('/accounts/chart-of-accounts/', { query }),
  getBankAccounts: (query) => api.get('/accounts/bank-accounts/', { query }),
  getJournalEntries: (query) => api.get('/accounts/journal/', { query }),
  getStandaloneNotes: (query) => api.get('/accounts/standalone-notes/', { query }),
  createStandaloneNote: (data) => api.post('/accounts/standalone-notes/', data),
  approveStandaloneNote: (id) => api.post(`/accounts/standalone-notes/${id}/approve/`),
  postStandaloneNote: (id) => api.post(`/accounts/standalone-notes/${id}/post/`),
  cancelStandaloneNote: (id, data) => api.post(`/accounts/standalone-notes/${id}/cancel/`, data),
  getDayBook: (query) => api.get('/accounts/reports/day-book/', { query }),
  getOverdueSummary: (query) => api.get('/accounts/reports/overdue-summary/', { query }),
  getSubLedgers: (query) => api.get('/accounts/reports/sub-ledgers/', { query }),
  getTallyExportUrl: (type, dateFrom, dateTo) => `/api/accounts/export/tally/?type=${type || 'vouchers'}${dateFrom ? '&dateFrom=' + dateFrom : ''}${dateTo ? '&dateTo=' + dateTo : ''}`,
  getExcelExportUrl: (register, dateFrom, dateTo) => `/api/accounts/export/excel/?register=${register || 'sales'}${dateFrom ? '&dateFrom=' + dateFrom : ''}${dateTo ? '&dateTo=' + dateTo : ''}`,
};

// ── Approvals Engine (Phase 4.1) ──────────────────────────────────────────
export const approvalService = {
  getRequests: (query) => api.get('/approvals/requests/', { query }),
  getRequestBadge: () => api.get('/approvals/requests/badge/'),
  approveRequest: (id, data) => api.post(`/approvals/requests/${id}/approve/`, data || {}),
  rejectRequest: (id, data) => api.post(`/approvals/requests/${id}/reject/`, data || {}),
  getRules: (query) => api.get('/approvals/rules/', { query }),
  createRule: (data) => api.post('/approvals/rules/', data),
  updateRule: (id, data) => api.patch(`/approvals/rules/${id}/`, data),
  deleteRule: (id) => api.delete(`/approvals/rules/${id}/`),
};

// ── Alerts & Exceptions Engine (Phase 4.3) ────────────────────────────────
export const alertService = {
  getIncidents: (query) => api.get('/alerts/incidents/', { query }),
  getIncidentBadge: () => api.get('/alerts/incidents/badge/'),
  acknowledgeIncident: (id) => api.post(`/alerts/incidents/${id}/acknowledge/`, {}),
  resolveIncident: (id) => api.post(`/alerts/incidents/${id}/resolve/`, {}),
  getSettings: (query) => api.get('/alerts/settings/', { query }),
  updateSetting: (id, data) => api.patch(`/alerts/settings/${id}/`, data),
};

// ── MIS Reports (Phase 4.4) ───────────────────────────────────────────────
export const misService = {
  getAnnualCommercialLeakage: (query) => api.get('/reports/annual-commercial-leakage/', { query }),
  getPartyProfitability: (query) => api.get('/reports/party-profitability/', { query }),
  getDesignColourAnalysis: (query) => api.get('/reports/design-colour-analysis/', { query }),
  getStockAgeingMis: (query) => api.get('/reports/stock-ageing-mis/', { query }),
};

// ── Job Work & ITC-04 Statutory Reporting (Phase 4.5) ─────────────────────
export const jobworkService = {
  getProcessPlans: (query) => api.get('/jobwork/process-plans/', { query }),
  getOrders: (query) => api.get('/jobwork/orders/', { query }),
  getITC04Report: (query) => api.get('/jobwork/itc-04/', { query }),
  getITC04ExportUrl: (financialYear, quarter, table = 'both') =>
    `/api/v1/jobwork/itc-04/export/?table=${table}${financialYear ? '&financialYear=' + financialYear : ''}${quarter ? '&quarter=' + quarter : ''}`,
};


