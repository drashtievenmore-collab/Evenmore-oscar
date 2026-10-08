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
  getEstimates: (query) => api.get('/sales/estimates/', { query }),
  createEstimate: (data) => api.post('/sales/estimates/', data),
  updateEstimate: (id, data) => api.patch(`/sales/estimates/${id}/`, data),
  convertEstimateToQuotation: (id) => api.post(`/sales/estimates/${id}/convert-to-quotation/`),
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
  // Existing — preserved
  getItems: (query) => api.get('/inventory/items/', { query }),
  getStockPositions: (query) => api.get('/inventory/stock/', { query }),
  getTransfers: (query) => api.get('/inventory/transfers/', { query }),
  getLocations: (query) => api.get('/inventory/locations/', { query }),
  // Master, movements, valuation & audit
  createItem: (data) => api.post('/inventory/items/', data),
  updateItem: (id, data) => api.patch(`/inventory/items/${id}/`, data),
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
};

// ── Accounts ─────────────────────────────────────────────────────────────

export const accountsService = {
  getJournalEntries: (query) => api.get('/accounts/journal/', { query }),
  createJournalEntry: (data) => api.post('/accounts/journal/', data),
  getLedger: (accountId, query) => api.get(`/accounts/ledger/${accountId}/`, { query }),
  getProfitAndLoss: (query) => api.get('/accounts/reports/profit-and-loss/', { query }),
  getBalanceSheet: (query) => api.get('/accounts/reports/balance-sheet/', { query }),
  getBankAccounts: () => api.get('/accounts/bank-accounts/'),
};
