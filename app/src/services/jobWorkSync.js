/**
 * jobWorkSync — backend API layer for Job Work.
 *
 * The server is the source of truth: nothing here caches business records
 * in the browser. Every call throws on failure so the page can show the
 * error and keep the unsaved record off screen.
 *
 * Child rows of a Job Work Order (materials / outwards / inwards / charges /
 * reprocesses / documents) and of a Process Plan (charges) are written one
 * at a time through their per-row endpoints. A header PATCH never carries
 * child rows. Document numbers (JWO, outward, inward, reprocess) are
 * allocated by the server.
 */
import { api } from './api';
import { getStoredToken } from '../utils/authUtils';

export function isJobWorkBackendEnabled() {
  try {
    return Boolean(getStoredToken());
  } catch {
    return false;
  }
}

const PAGE_SIZE = 200;

function rowsFrom(body) {
  if (Array.isArray(body)) return body;
  return body?.results || [];
}

const num = (v) => Number(v ?? 0) || 0;
const orUndef = (v) => (v === '' || v === null || v === undefined ? undefined : v);

/* ── mapping: server already speaks camelCase (BaseModelSerializer) ── */

export function jwoFromApi(row) {
  if (!row) return row;
  return {
    id: row.id,
    jwoNo: row.jwoNo || '',
    processPlanId: row.processPlanId || null,
    process: row.process || '',
    vendor: row.vendor || '',
    orderDate: row.orderDate || '',
    plannedQty: num(row.plannedQty),
    rate: num(row.rate),
    totalAmount: num(row.totalAmount),
    expectedCompletion: row.expectedCompletion || '',
    status: row.status || '',
    remarks: row.remarks || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    materials: (row.materials || []).map((m) => ({
      id: m.id,
      fabricItem: m.fabricItem || '',
      fabricQuality: m.fabricQuality || '',
      shade: m.shade || '',
      lotNo: m.lotNo || '',
      qty: num(m.qty),
      rate: num(m.rate),
      amount: num(m.amount),
    })),
    outwards: (row.outwards || []).map((o) => ({
      id: o.id,
      no: o.no || '',
      date: o.date || '',
      qty: num(o.qty),
      lrNo: o.lrNo || '',
      transporter: o.transporter || '',
      warehouse: o.warehouse || '',
      vehicleNo: o.vehicleNo || '',
      driver: o.driver || '',
      remarks: o.remarks || '',
      status: o.status || '',
    })),
    inwards: (row.inwards || []).map((r) => ({
      id: r.id,
      no: r.no || '',
      date: r.date || '',
      qty: num(r.qty),
      accepted: num(r.accepted),
      rejected: num(r.rejected),
      challanNo: r.challanNo || '',
      status: r.status || '',
    })),
    charges: (row.charges || []).map((c) => ({
      id: c.id,
      type: c.type || '',
      description: c.description || '',
      rate: num(c.rate),
      qty: num(c.qty),
      amount: num(c.amount),
      status: c.status || '',
    })),
    reprocesses: (row.reprocesses || []).map((r) => ({
      id: r.id,
      no: r.no || '',
      inwardNo: r.inwardNo || '',
      date: r.date || '',
      qty: num(r.qty),
      reason: r.reason || '',
      expectedReturn: r.expectedReturn || '',
      status: r.status || '',
      remarks: r.remarks || '',
    })),
    documents: (row.documents || []).map((d) => ({
      id: d.id,
      type: d.type || 'Other',
      no: d.no || '',
      date: d.date || '',
      fileName: d.fileName || '',
      uploadedBy: d.uploadedBy || '',
      url: d.url || '',
      fileId: d.fileId || '',
      remarks: d.remarks || '',
    })),
    signatures: row.signatures || {},
    lossEntries: (row.lossEntries || row.losses || []).map((l) => ({
      id: l.id,
      lossReasonId: l.lossReasonId || '',
      lossReasonName: l.lossReasonName || l.loss_reason_name || '',
      qty: num(l.qty),
      status: l.status || 'Pending',
      approvedBy: l.approvedBy || '',
      approvedAt: l.approvedAt || '',
      remarks: l.remarks || '',
    })),
  };
}

/** Header fields only — child rows go through the per-row endpoints. */
export function jwoHeaderToApi(jwo) {
  const out = {};
  if (jwo.processPlanId !== undefined) out.processPlanId = jwo.processPlanId || null;
  if (jwo.processMasterId !== undefined) out.processMasterId = jwo.processMasterId || null;
  if (jwo.process !== undefined) out.process = jwo.process || '';
  if (jwo.vendorId !== undefined) out.vendorId = jwo.vendorId || null;
  if (jwo.vendor !== undefined) out.vendor = jwo.vendor || '';
  if (jwo.orderDate !== undefined) out.orderDate = orUndef(jwo.orderDate);
  if (jwo.rate !== undefined) out.rate = num(jwo.rate);
  if (jwo.expectedCompletion !== undefined) out.expectedCompletion = jwo.expectedCompletion || null;
  if (jwo.expectedLossPct !== undefined) out.expectedLossPct = num(jwo.expectedLossPct);
  if (jwo.status !== undefined) out.status = jwo.status;
  if (jwo.remarks !== undefined) out.remarks = jwo.remarks || '';
  return out;
}

const ROW_MAPPERS = {
  materials: (m) => ({
    fabricItem: m.fabricItem || '',
    fabricQuality: m.fabricQuality || '',
    shade: m.shade || '',
    lotNo: m.lotNo || '',
    qty: num(m.qty),
    rate: num(m.rate),
  }),
  outwards: (o) => ({
    date: orUndef(o.date),
    qty: num(o.qty),
    lrNo: o.lrNo || '',
    transporter: o.transporter || '',
    warehouse: o.warehouse || '',
    vehicleNo: o.vehicleNo || '',
    driver: o.driver || '',
    remarks: o.remarks || '',
    ...(o.takas ? { takas: o.takas } : {}),
    ...(o.status ? { status: o.status } : {}),
  }),
  inwards: (r) => ({
    date: orUndef(r.date),
    qty: num(r.qty),
    ...(r.accepted !== undefined && r.accepted !== '' ? { accepted: num(r.accepted) } : {}),
    rejected: num(r.rejected),
    challanNo: r.challanNo || '',
    ...(r.takas ? { takas: r.takas } : {}),
    ...(r.status ? { status: r.status } : {}),
  }),
  losses: (l) => ({
    lossReasonId: l.lossReasonId || null,
    qty: num(l.qty),
    remarks: l.remarks || '',
    ...(l.status ? { status: l.status } : {}),
  }),
  charges: (c) => ({
    type: c.type || '',
    description: c.description || '',
    rate: num(c.rate),
    qty: num(c.qty),
    ...(c.status ? { status: c.status } : {}),
  }),
  reprocesses: (r) => ({
    inwardNo: r.inwardNo || '',
    date: orUndef(r.date),
    qty: num(r.qty),
    reason: r.reason || '',
    expectedReturn: r.expectedReturn || null,
    ...(r.status ? { status: r.status } : {}),
    remarks: r.remarks || '',
  }),
  documents: (d) => ({
    type: d.type || 'Other',
    no: d.no || '',
    date: orUndef(d.date),
    fileName: d.fileName || '',
    fileId: d.fileId || null,
    remarks: d.remarks || '',
  }),
};

/** Create payload: header plus the initial rows the form collected. */
export function jwoCreateToApi(jwo) {
  const body = jwoHeaderToApi(jwo);
  ['materials', 'outwards', 'inwards', 'charges'].forEach((kind) => {
    const rows = (jwo[kind] || []).filter(Boolean);
    if (rows.length) body[kind] = rows.map(ROW_MAPPERS[kind]);
  });
  return body;
}

export function planFromApi(row) {
  if (!row) return row;
  const expQty = num(row.expectedQty);
  return {
    id: row.id,
    planNo: row.planNo || '',
    date: row.date || '',
    process: row.process || '',
    processCategory: row.processCategory || '',
    vendor: row.vendor || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    fabricItem: row.fabricItem || '',
    greyLotNo: row.greyLotNo || '',
    fabricQuality: row.fabricQuality || '',
    takaRollNo: row.takaRollNo || '',
    shade: row.shade || '',
    expectedQty: expQty,
    plannedQty: expQty,
    expectedLoss: num(row.expectedLoss),
    expectedReturnQty: num(row.expectedReturnQty),
    weight: num(row.weight),
    finishedWeight: num(row.finishedWeight),
    noOfRolls: num(row.noOfRolls),
    startDate: row.startDate || '',
    targetDate: row.targetDate || row.expectedCompletionDate || '',
    expectedCompletionDate: row.expectedCompletionDate || row.targetDate || '',
    assignedEmployee: row.assignedEmployee || '',
    approver: row.approver || '',
    status: row.status || '',
    remarks: row.remarks || '',
    created_at: row.created_at || '',
    updatedAt: row.updated_at || '',
    charges: (row.charges || []).map((c) => ({
      id: c.id,
      type: c.type || '',
      description: c.description || '',
      rate: num(c.rate),
      qty: num(c.qty),
      amount: num(c.amount),
      status: c.status || '',
    })),
  };
}

/** Plan header fields. `withCharges` only on create. */
export function planToApi(p, { withCharges = false } = {}) {
  const qty = num(p.plannedQty ?? p.expectedQty);
  const body = {
    date: orUndef(p.date),
    process: p.process || '',
    processCategory: p.processCategory || null,
    vendor: p.vendor || '',
    contactPerson: p.contactPerson || null,
    phone: p.phone || null,
    fabricItem: p.fabricItem || '',
    greyLotNo: p.greyLotNo || null,
    fabricQuality: p.fabricQuality || '',
    takaRollNo: p.takaRollNo || null,
    shade: p.shade || null,
    expectedQty: qty,
    expectedLoss: num(p.expectedLoss),
    expectedReturnQty: num(p.expectedReturnQty),
    weight: p.weight ? num(p.weight) : null,
    finishedWeight: p.finishedWeight ? num(p.finishedWeight) : null,
    noOfRolls: p.noOfRolls ? num(p.noOfRolls) : null,
    startDate: p.startDate || null,
    expectedCompletionDate: p.expectedCompletionDate || p.targetDate || null,
    email: p.email || null,
    address: p.address || null,
    assignedEmployee: p.assignedEmployee || null,
    approver: p.approver || null,
    remarks: p.remarks || null,
  };
  if (p.status) body.status = p.status;
  if (withCharges) body.charges = (p.charges || []).map(ROW_MAPPERS.charges);
  return body;
}

/* ── Job Work Orders ── */

export async function fetchJWOs() {
  const body = await api.get('/jobwork/orders/', { query: { limit: PAGE_SIZE } });
  return rowsFrom(body).map(jwoFromApi);
}

export async function fetchJWO(id) {
  return jwoFromApi(await api.get(`/jobwork/orders/${id}/`));
}

export async function createJWO(jwo) {
  return jwoFromApi(await api.post('/jobwork/orders/', jwoCreateToApi(jwo)));
}

export async function updateJWOHeader(id, fields) {
  return jwoFromApi(await api.patch(`/jobwork/orders/${id}/`, jwoHeaderToApi(fields)));
}

export async function deleteJWO(id) {
  await api.delete(`/jobwork/orders/${id}/`);
  return true;
}

/** Approval point (approve_jobwork). */
export async function closeJWO(id, options) {
  const payload = typeof options === 'string' ? { remarks: options } : (options || {});
  return jwoFromApi(await api.post(`/jobwork/orders/${id}/close/`, payload));
}

/** kind: materials | outwards | inwards | charges | reprocesses | documents */
export async function createJWORow(orderId, kind, row) {
  return api.post(`/jobwork/orders/${orderId}/${kind}/`, ROW_MAPPERS[kind](row));
}

export async function updateJWORow(orderId, kind, rowId, row) {
  return api.patch(`/jobwork/orders/${orderId}/${kind}/${rowId}/`, ROW_MAPPERS[kind](row));
}

export async function deleteJWORow(orderId, kind, rowId) {
  await api.delete(`/jobwork/orders/${orderId}/${kind}/${rowId}/`);
  return true;
}

export async function signJWODocument(orderId, { documentType, documentId, signatoryType, signature }) {
  return api.post(`/jobwork/orders/${orderId}/sign/`, {
    documentType,
    documentId,
    signatoryType,
    signature,
  });
}

/* ── Process Plans ── */

export async function fetchPlans() {
  const body = await api.get('/jobwork/process-plans/', { query: { limit: PAGE_SIZE } });
  return rowsFrom(body).map(planFromApi);
}

export async function fetchPlan(id) {
  return planFromApi(await api.get(`/jobwork/process-plans/${id}/`));
}

export async function createPlan(plan) {
  return planFromApi(await api.post('/jobwork/process-plans/', planToApi(plan, { withCharges: true })));
}

export async function updatePlan(id, plan) {
  return planFromApi(await api.patch(`/jobwork/process-plans/${id}/`, planToApi(plan)));
}

export async function deletePlan(id) {
  await api.delete(`/jobwork/process-plans/${id}/`);
  return true;
}

/** Approval points (approve_jobwork). */
export async function approvePlan(id) {
  return planFromApi(await api.post(`/jobwork/process-plans/${id}/approve/`, {}));
}

export async function completePlan(id) {
  return planFromApi(await api.post(`/jobwork/process-plans/${id}/complete/`, {}));
}

export async function createPlanCharge(planId, charge) {
  return api.post(`/jobwork/process-plans/${planId}/charges/`, ROW_MAPPERS.charges(charge));
}

export async function updatePlanCharge(planId, chargeId, charge) {
  return api.patch(`/jobwork/process-plans/${planId}/charges/${chargeId}/`, ROW_MAPPERS.charges(charge));
}

export async function deletePlanCharge(planId, chargeId) {
  await api.delete(`/jobwork/process-plans/${planId}/charges/${chargeId}/`);
  return true;
}

/** Human-readable message from an api.js error. */
export function errorMessage(err, fallback = 'Could not save. Please try again.') {
  if (!err) return fallback;
  const fe = err.payload?.field_errors || err.payload?.fieldErrors;
  const base = err.payload?.message || err.message || fallback;
  if (fe && typeof fe === 'object') {
    const details = Object.values(fe).flat().filter(Boolean).join(' ');
    if (details && !base.includes(details)) return `${base} ${details}`;
  }
  return base;
}

export async function lookupJWORate({ processorId, processId, fabricQualityId }) {
  const query = {};
  if (processorId) query.processorId = processorId;
  if (processId) query.processId = processId;
  if (fabricQualityId) query.fabricQualityId = fabricQualityId;
  return api.get('/jobwork/orders/lookup-rate/', { query });
}

export async function approveJWOLoss(orderId, lossId) {
  return api.post(`/jobwork/orders/${orderId}/losses/${lossId}/approve/`, {});
}

export async function fetchProcessorLedger(processorId) {
  const query = {};
  if (processorId) query.processorId = processorId;
  return api.get('/jobwork/orders/processor-ledger/', { query });
}

