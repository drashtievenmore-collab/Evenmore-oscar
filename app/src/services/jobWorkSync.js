/**
 * jobWorkSync — backend translation layer for Job Work.
 * Uses the shared api client (JWT, /api/v1). With no token it is inert
 * and callers fall back to localStorage, so the app stays usable offline.
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

/* ── mapping: server already speaks camelCase (BaseModelSerializer) ── */

export function jwoFromApi(row) {
  if (!row) return row;
  return {
    id: row.id,
    jwoNo: row.jwoNo || row.jwo_no,
    processPlanId: row.processPlanId,
    process: row.process || '',
    vendor: row.vendor || row.vendor_name || '',
    orderDate: row.orderDate || row.order_date || '',
    plannedQty: Number(row.plannedQty ?? row.planned_qty ?? 0),
    rate: Number(row.rate ?? 0),
    totalAmount: Number(row.totalAmount ?? row.total_amount ?? 0),
    expectedCompletion: row.expectedCompletion || row.expected_completion || '',
    status: row.status || 'In-Process',
    remarks: row.remarks || '',
    materials: (row.materials || []).map((m) => ({
      id: m.id,
      fabricItem: m.fabricItem || '',
      fabricQuality: m.fabricQuality || '',
      shade: m.shade || '',
      lotNo: m.lotNo || m.lot_no || '',
      qty: Number(m.qty ?? 0),
      rate: Number(m.rate ?? 0),
      amount: Number(m.amount ?? 0),
    })),
    outwards: (row.outwards || []).map((o) => ({
      id: o.id,
      no: o.no || '',
      date: o.date || '',
      qty: Number(o.qty ?? 0),
      lrNo: o.lrNo || o.lr_no || '',
      transporter: o.transporter || '',
      status: o.status || 'Sent',
    })),
    inwards: (row.inwards || []).map((r) => ({
      id: r.id,
      no: r.no || '',
      date: r.date || '',
      qty: Number(r.qty ?? 0),
      accepted: Number(r.accepted ?? 0),
      rejected: Number(r.rejected ?? 0),
      challanNo: r.challanNo || r.challan_no || '',
      status: r.status || 'Received',
    })),
    charges: (row.charges || []).map((c) => ({
      id: c.id,
      type: c.type || '',
      description: c.description || '',
      rate: Number(c.rate ?? 0),
      qty: Number(c.qty ?? 0),
      amount: Number(c.amount ?? Number(c.qty || 0) * Number(c.rate || 0)),
      status: c.status || 'Active',
    })),
    reprocesses: (row.reprocesses || []).map((r) => ({
      id: r.id,
      no: r.no || '',
      inwardNo: r.inwardNo || r.inward_no || '',
      date: r.date || '',
      qty: Number(r.qty ?? 0),
      reason: r.reason || '',
      expectedReturn: r.expectedReturn || r.expected_return || '',
      status: r.status || 'Pending',
      remarks: r.remarks || '',
    })),
    documents: (row.documents || []).map((d) => ({
      id: d.id,
      type: d.type || d.documentType || d.document_type || 'Other',
      no: d.no || d.documentNo || d.document_no || '',
      date: d.date || '',
      fileName: d.fileName || d.file_name || d.name || '',
      uploadedBy: d.uploadedBy || d.uploaded_by || 'Admin',
      url: d.url || d.file || '',
      fileId: d.fileId || d.file_id || '',
    })),
    _synced: true,
  };
}

export function jwoToApi(jwo) {
  const cleanLines = (lines, map) =>
    (lines || [])
      .filter((l) => l && (l.qty || l.quantity || l.fabricItem || l.no || l.type || l.fileName))
      .map(map);
  return {
    processPlanId: jwo.processPlanId || undefined,
    process: jwo.process || '',
    vendor: jwo.vendor || '',
    orderDate: jwo.orderDate || undefined,
    plannedQty: Number(jwo.plannedQty ?? 0),
    rate: Number(jwo.rate ?? 0),
    totalAmount: Number(jwo.totalAmount ?? 0),
    expectedCompletion: jwo.expectedCompletion || undefined,
    status: jwo.status || 'In-Process',
    remarks: jwo.remarks || undefined,
    materials: cleanLines(jwo.materials, (m) => ({
      ...(typeof m.id === 'string' && m.id.length === 36 ? { id: m.id } : {}),
      fabricItem: m.fabricItem || '',
      fabricQuality: m.fabricQuality || '',
      shade: m.shade || '',
      lotNo: m.lotNo || '',
      qty: Number(m.qty ?? 0),
      rate: Number(m.rate ?? 0),
      amount: Number(m.amount ?? Number(m.qty || 0) * Number(m.rate || 0)),
    })),
    outwards: cleanLines(jwo.outwards, (o) => ({
      ...(typeof o.id === 'string' && o.id.length === 36 ? { id: o.id } : {}),
      no: o.no || '',
      date: o.date || undefined,
      qty: Number(o.qty ?? 0),
      lrNo: o.lrNo || '',
      transporter: o.transporter || '',
      status: o.status || 'Sent',
    })),
    inwards: cleanLines(jwo.inwards, (r) => ({
      ...(typeof r.id === 'string' && r.id.length === 36 ? { id: r.id } : {}),
      no: r.no || '',
      date: r.date || undefined,
      qty: Number(r.qty ?? 0),
      accepted: Number(r.accepted ?? Math.max(0, Number(r.qty || 0) - Number(r.rejected || 0))),
      rejected: Number(r.rejected ?? 0),
      challanNo: r.challanNo || '',
      status: r.status || 'Received',
    })),
    charges: cleanLines(jwo.charges, (c) => ({
      ...(typeof c.id === 'string' && c.id.length === 36 ? { id: c.id } : {}),
      type: c.type || '',
      description: c.description || '',
      rate: Number(c.rate ?? 0),
      qty: Number(c.qty ?? 0),
      amount: Number(c.amount ?? Number(c.qty || 0) * Number(c.rate || 0)),
      status: c.status || 'Active',
    })),
    reprocesses: cleanLines(jwo.reprocesses, (r) => ({
      ...(typeof r.id === 'string' && r.id.length === 36 ? { id: r.id } : {}),
      no: r.no || '',
      inwardNo: r.inwardNo || '',
      date: r.date || undefined,
      qty: Number(r.qty ?? 0),
      reason: r.reason || '',
      expectedReturn: r.expectedReturn || undefined,
      status: r.status || 'Pending',
      remarks: r.remarks || undefined,
    })),
    documents: cleanLines(jwo.documents, (d) => ({
      ...(typeof d.id === 'string' && d.id.length === 36 ? { id: d.id } : {}),
      type: d.type || '',
      no: d.no || '',
      date: d.date || undefined,
      fileName: d.fileName || '',
      uploadedBy: d.uploadedBy || 'Admin',
      url: d.url || '',
      fileId: d.fileId || undefined,
    })),
  };
}

export function planFromApi(row) {
  if (!row) return row;
  const expQty = Number(row.expectedQty ?? row.expected_qty ?? row.plannedQty ?? row.planned_qty ?? 0);return {
    id: row.id,
    planNo: row.planNo || row.plan_no,
    date: row.date || '',
    process: row.process || '',
    processCategory: row.processCategory || row.process_category || '',
    vendor: row.vendor || row.vendor_name || '',
    contactPerson: row.contactPerson || row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    fabricItem: row.fabricItem || row.fabric_item || '',
    greyLotNo: row.greyLotNo || row.grey_lot_no || '',
    fabricQuality: row.fabricQuality || row.fabric_quality || '',
    takaRollNo: row.takaRollNo || row.taka_roll_no || '',
    shade: row.shade || '',
    expectedQty: expQty,
    plannedQty: expQty,
    expectedLoss: Number(row.expectedLoss ?? row.expected_loss ?? 0),
    expectedReturnQty: Number(row.expectedReturnQty ?? row.expected_return_qty ?? 0),
    weight: Number(row.weight ?? 0),
    finishedWeight: Number(row.finishedWeight ?? row.finished_weight ?? 0),
    noOfRolls: Number(row.noOfRolls ?? row.no_of_rolls ?? 0),
    startDate: row.startDate || row.start_date || '',
    targetDate: row.targetDate || row.target_date || row.expectedCompletionDate || row.expected_completion_date || '',
    expectedCompletionDate: row.expectedCompletionDate || row.expected_completion_date || row.targetDate || row.target_date || '',
    assignedEmployee: row.assignedEmployee || row.assigned_employee || '',
    approver: row.approver || '',
    status: row.status || 'Active',
    remarks: row.remarks || '',
    charges: (row.charges || []).map((c) => ({
      id: c.id,
      type: c.type || '',
      description: c.description || '',
      rate: Number(c.rate ?? 0),
      qty: Number(c.qty ?? 0),
      amount: Number(c.amount ?? Number(c.qty || 0) * Number(c.rate || 0)),
      status: c.status || 'Active',
    })),
    _synced: true,
  };
}

export function planToApi(p) {
  const qty = Number(p.plannedQty ?? p.expectedQty ?? 0);
  return {
    date: p.date || undefined,
    process: p.process || '',
    processCategory: p.processCategory || undefined,
    vendor: p.vendor || '',
    contactPerson: p.contactPerson || undefined,
    phone: p.phone || undefined,
    fabricItem: p.fabricItem || '',
    greyLotNo: p.greyLotNo || undefined,
    fabricQuality: p.fabricQuality || '',
    takaRollNo: p.takaRollNo || undefined,
    shade: p.shade || undefined,
    expectedQty: qty,
    expectedLoss: Number(p.expectedLoss ?? 0),
    expectedReturnQty: Number(p.expectedReturnQty ?? 0),
    weight: p.weight ? Number(p.weight) : undefined,
    finishedWeight: p.finishedWeight ? Number(p.finishedWeight) : undefined,
    noOfRolls: p.noOfRolls ? Number(p.noOfRolls) : undefined,
    startDate: p.startDate || undefined,
    expectedCompletionDate: p.expectedCompletionDate || p.targetDate || undefined,
    targetDate: p.expectedCompletionDate || p.targetDate || undefined,
    email: p.email || undefined,
    address: p.address || undefined,
    assignedEmployee: p.assignedEmployee || undefined,
    approver: p.approver || undefined,
    status: p.status || 'Active',
    remarks: p.remarks || undefined,
    charges: (p.charges || []).map((c) => ({
      ...(typeof c.id === 'string' && c.id.length === 36 ? { id: c.id } : {}),
      type: c.type || '',
      description: c.description || '',
      rate: Number(c.rate ?? 0),
      qty: Number(c.qty ?? 0),
      amount: Number(c.amount ?? Number(c.qty || 0) * Number(c.rate || 0)),
      status: c.status || 'Active',
    })),
  };
}

/* ── API calls ── */

const isUuid = (id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);

/**
 * Push rows the server has never seen (created offline — non-UUID ids) and
 * swap in the server ids. Returns the list. Failures stay local for the
 * next load instead of being dropped.
 */
export async function reconcilePendingCreates(cached, pushCreate) {
  const pending = (cached || []).filter((r) => r && !isUuid(r.id));
  if (pending.length === 0) return cached;
  let next = [...cached];
  for (const local of pending) {
    try {
      const saved = await pushCreate(local);
      if (saved) next = next.map((r) => (r.id === local.id ? { ...local, ...saved } : r));
    } catch { /* retry on the next load */ }
  }
  return next;
}

/**
 * Server rows win by id; rows the server has never seen (no `_synced`
 * stamp) are kept so offline creates survive a refresh.
 */
export function mergeServerRows(cached, serverRows) {
  const rows = Array.isArray(serverRows) ? serverRows : [];
  const ids = new Set(rows.map((r) => String(r.id)));
  return [
    ...(cached || []).filter((r) => r && !r._synced && !ids.has(String(r.id))),
    ...rows,
  ];
}

function dataUrlToFile(dataUrl, name) {
  const [head, data] = String(dataUrl || '').split(',');
  const mime = /data:(.*?);/.exec(head || '')?.[1] || 'application/octet-stream';
  const bin = atob(data || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name || 'document', { type: mime });
}

/**
 * Retry-upload order documents whose bytes never reached the server
 * (offline at attach time). Rows keep a data-URL preview locally, so the
 * bytes are still here to send. Returns the order with `fileId`s filled in.
 */
export async function uploadPendingJWODocs(jwo) {
  const docs = jwo?.documents || [];
  if (!docs.some((d) => d && !d.fileId && typeof d.url === 'string' && d.url.startsWith('data:'))) {
    return jwo;
  }
  const { uploadFileToBackend } = await import('./fileUploadService');
  let changed = false;
  const next = [];
  for (const d of docs) {
    if (d && !d.fileId && typeof d.url === 'string' && d.url.startsWith('data:')) {
      try {
        const fileId = await uploadFileToBackend(dataUrlToFile(d.url, d.fileName), d.fileName || 'document', 'jobwork_document');
        changed = true;
        next.push({ ...d, fileId });
        continue;
      } catch (err) {
        console.warn('[jobWorkSync] doc upload retry failed:', err?.message || err);
      }
    }
    next.push(d);
  }
  return changed ? { ...jwo, documents: next } : jwo;
}

export async function pullJWOs() {
  if (!isJobWorkBackendEnabled()) return null;
  try {
    const body = await api.get('/jobwork/orders/', { query: { limit: PAGE_SIZE } });
    return rowsFrom(body).map(jwoFromApi);
  } catch (err) {
    console.warn('[jobWorkSync] pull orders failed:', err?.message || err);
    return null;
  }
}

export async function pushCreateJWO(jwo) {
  if (!isJobWorkBackendEnabled()) return null;
  const body = await api.post('/jobwork/orders/', jwoToApi(jwo));
  return jwoFromApi(body);
}

export async function pushUpdateJWO(id, jwo) {
  if (!isJobWorkBackendEnabled()) return null;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return null;
  const body = await api.patch(`/jobwork/orders/${id}/`, jwoToApi(jwo));
  return jwoFromApi(body);
}

export async function pushDeleteJWO(id) {
  if (!isJobWorkBackendEnabled()) return false;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return false;
  await api.delete(`/jobwork/orders/${id}/`);
  return true;
}

export async function pullPlans() {
  if (!isJobWorkBackendEnabled()) return null;
  try {
    const body = await api.get('/jobwork/process-plans/', { query: { limit: PAGE_SIZE } });
    return rowsFrom(body).map(planFromApi);
  } catch (err) {
    console.warn('[jobWorkSync] pull plans failed:', err?.message || err);
    return null;
  }
}

export async function pushCreatePlan(plan) {
  if (!isJobWorkBackendEnabled()) return null;
  const body = await api.post('/jobwork/process-plans/', planToApi(plan));
  return planFromApi(body);
}

export async function pushUpdatePlan(id, plan) {
  if (!isJobWorkBackendEnabled()) return null;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return null;
  const body = await api.patch(`/jobwork/process-plans/${id}/`, planToApi(plan));
  return planFromApi(body);
}

export async function pushDeletePlan(id) {
  if (!isJobWorkBackendEnabled()) return false;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return false;
  await api.delete(`/jobwork/process-plans/${id}/`);
  return true;
}

/* ── vendor process instructions (grey-fabric PI) ── */

export function vpiFromApi(row) {
  if (!row) return row;
  return {
    id: row.id,
    piNumber: row.piNumber || row.pi_number,
    poId: row.poId || row.po_id || '',
    poNumber: row.poNumber || row.po_number || '',
    vendorId: row.vendorId || row.vendor_id || '',
    vendor: row.vendor || '',
    fabric: row.fabric || '',
    fabricSku: row.fabricSku || row.fabric_sku || '',
    processType: row.processType || row.process_type || '',
    assignedEmployee: row.assignedEmployee || row.assigned_employee || '',
    assignedQty: Number(row.assignedQty ?? row.assigned_qty ?? 0),
    producedQty: Number(row.producedQty ?? row.produced_qty ?? 0),
    date: row.date || '',
    startDate: row.startDate || row.start_date || '',
    expectedCompletionDate: row.expectedCompletionDate || row.expected_completion_date || '',
    status: row.status || 'In Progress',
    remarks: row.remarks || '',
    _synced: true,
  };
}

export function vpiToApi(pi) {
  return {
    poId: pi.poId || undefined,
    poNumber: pi.poNumber || undefined,
    vendorId: pi.vendorId || undefined,
    vendor: pi.vendor || '',
    fabric: pi.fabric || '',
    fabricSku: pi.fabricSku || undefined,
    processType: pi.processType || '',
    assignedEmployee: pi.assignedEmployee || undefined,
    assignedQty: Number(pi.assignedQty ?? 0),
    producedQty: Number(pi.producedQty ?? 0),
    date: pi.date || undefined,
    startDate: pi.startDate || undefined,
    expectedCompletionDate: pi.expectedCompletionDate || undefined,
    status: pi.status || 'In Progress',
    remarks: pi.remarks || undefined,
  };
}

export async function pullVPIs() {
  if (!isJobWorkBackendEnabled()) return null;
  try {
    const body = await api.get('/jobwork/process-instructions/', { query: { limit: PAGE_SIZE } });
    return rowsFrom(body).map(vpiFromApi);
  } catch (err) {
    console.warn('[jobWorkSync] pull instructions failed:', err?.message || err);
    return null;
  }
}

export async function pushCreateVPI(pi) {
  if (!isJobWorkBackendEnabled()) return null;
  const body = await api.post('/jobwork/process-instructions/', vpiToApi(pi));
  return vpiFromApi(body);
}

export async function pushUpdateVPI(id, pi) {
  if (!isJobWorkBackendEnabled()) return null;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return null;
  const body = await api.patch(`/jobwork/process-instructions/${id}/`, vpiToApi(pi));
  return vpiFromApi(body);
}

export async function pushDeleteVPI(id) {
  if (!isJobWorkBackendEnabled()) return false;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return false;
  await api.delete(`/jobwork/process-instructions/${id}/`);
  return true;
}

/* ── VPI daily progress entries ── */

export function vpiEntryFromApi(row) {
  if (!row) return row;
  return {
    id: row.id,
    instructionId: row.instructionId || row.instruction_id || '',
    date: row.date || '',
    produced: Number(row.producedQty ?? row.produced_qty ?? row.produced ?? 0),
    producedQty: Number(row.producedQty ?? row.produced_qty ?? row.produced ?? 0),
    by: row.enteredBy || row.entered_by || '',
    enteredBy: row.enteredBy || row.entered_by || '',
    remarks: row.remarks || '',
    photoFileId: row.photoFileId || row.photo_file || undefined,
    photo: row.photoUrl || row.photo_url || '',
    photoUrl: row.photoUrl || row.photo_url || '',
    _synced: true,
  };
}

export async function pullVPIEntries(instructionId) {
  if (!isJobWorkBackendEnabled()) return null;
  try {
    const query = { limit: PAGE_SIZE, ...(instructionId ? { instructionId } : {}) };
    const body = await api.get('/jobwork/pi-entries/', { query });
    const rows = rowsFrom(body).map(vpiEntryFromApi);
    return instructionId ? rows.filter((r) => String(r.instructionId) === String(instructionId)) : rows;
  } catch (err) {
    console.warn('[jobWorkSync] pull pi entries failed:', err?.message || err);
    return null;
  }
}

export async function pushCreateVPIEntry(entry) {
  if (!isJobWorkBackendEnabled()) return null;
  const body = await api.post('/jobwork/pi-entries/', {
    instructionId: entry.instructionId || entry.piId,
    date: entry.date || undefined,
    producedQty: Number(entry.produced ?? entry.producedQty ?? 0),
    enteredBy: entry.by || entry.enteredBy || undefined,
    remarks: entry.remarks || undefined,
    photoFileId: entry.photoFileId || undefined,
  });
  return vpiEntryFromApi(body);
}

export async function pushUpdateVPIEntry(id, entry) {
  if (!isJobWorkBackendEnabled()) return null;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return null;
  const body = await api.patch(`/jobwork/pi-entries/${id}/`, {
    date: entry.date || undefined,
    producedQty: entry.produced ?? entry.producedQty ?? undefined,
    enteredBy: entry.by || entry.enteredBy || undefined,
    remarks: entry.remarks ?? undefined,
    photoFileId: entry.photoFileId || undefined,
  });
  return vpiEntryFromApi(body);
}

export async function pushDeleteVPIEntry(id) {
  if (!isJobWorkBackendEnabled()) return false;
  const isUuid = typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
  if (!isUuid) return false;
  await api.delete(`/jobwork/pi-entries/${id}/`);
  return true;
}
