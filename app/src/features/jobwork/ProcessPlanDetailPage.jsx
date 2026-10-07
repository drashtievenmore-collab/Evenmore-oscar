import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Eye, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  loadPlans,
  nextPlanNumber,
  savePlans,
  toDDMMYYYY,
  numIN,
  statusPill,
  ProcessPlanForm,
  VENDOR_CONTACTS,
  VENDOR_OPTIONS,
  PROCESS_OPTIONS,
} from './ProcessPlanListPage';
import { loadJWOs, saveJWOs, nextJWONumber, jwoKpis } from './jobWorkOrdersStore';
import PageHeader from '../../components/ui/PageHeader';

const TABS = ['Plan Details', 'Job Work Orders', 'Material Requirement', 'Timeline', 'Charges', 'Documents', 'Remarks'];

function InfoRow({ label, value, accent }) {
  return (
    <p className="flex gap-2 text-[12.5px] leading-6">
      <span className="w-[118px] shrink-0 font-medium text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <span className={`font-semibold ${accent || 'text-[#17294e]'}`}>{value}</span>
    </p>
  );
}

export default function ProcessPlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(loadPlans);
  const [tab, setTab] = useState('Plan Details');
  const [showEdit, setShowEdit] = useState(false);
  const [jwos, setJwos] = useState(loadJWOs);
  const [showCreateJWO, setShowCreateJWO] = useState(false);
  const [createForm, setCreateForm] = useState({
    jwoNo: '',
    orderDate: '',
    vendor: '',
    process: '',
    plannedQty: '',
    receivedQty: '',
    rate: '',
    expectedCompletion: '',
    status: 'In-Process',
  });
  const [viewingJWO, setViewingJWO] = useState(null);
  const [editingJWO, setEditingJWO] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [addingJWO, setAddingJWO] = useState(null);
  const [addForm, setAddForm] = useState({ type: 'outward', qty: '', date: new Date().toISOString().slice(0, 10) });
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterialIdx, setEditingMaterialIdx] = useState(null);
  const [viewingMaterial, setViewingMaterial] = useState(null);
  const [materialForm, setMaterialForm] = useState({
    fabricItem: '',
    fabricQuality: '',
    shade: '',
    greyLotNo: '',
    takaRollNo: '',
    requiredQty: '',
    availableQty: '',
    allocatedQty: '',
  });
  // Plan charges — starts empty, never seeded. User-added only.
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editingChargeId, setEditingChargeId] = useState(null);
  const [viewingCharge, setViewingCharge] = useState(null);
  const [chargeForm, setChargeForm] = useState({ type: '', description: '', rate: '', qty: '' });

  // Backend-first refresh when logged in.
  useEffect(() => {
    let live = true;
    import('../../services/jobWorkSync').then(({ pullPlans, isJobWorkBackendEnabled }) => {
      if (!isJobWorkBackendEnabled()) return;
      pullPlans().then((rows) => {
        if (live && Array.isArray(rows)) {
          setPlans(rows);
          savePlans(rows);
        }
      }).catch(() => {});
    });
    setJwos(loadJWOs());
    return () => { live = false; };
  }, []);

  const po = plans.find((p) => String(p.id) === String(id));

  const persist = (next) => {
    setPlans(next);
    savePlans(next);
  };

  const persistPlan = (updated) => {
    const next = plans.map((p) => (String(p.id) === String(po.id) ? updated : p));
    persist(next);
    import('../../services/jobWorkSync').then(({ pushUpdatePlan, isJobWorkBackendEnabled }) => {
      if (!isJobWorkBackendEnabled()) return;
      pushUpdatePlan(po.id, updated).then((saved) => {
        if (saved) persist(plans.map((p) => (String(p.id) === String(po.id) ? saved : p)));
      }).catch(() => {});
    }).catch(() => {});
  };

  // ── Plan charges (user-added only, never seeded) ──
  const planCharges = po.charges || [];
  const openAddCharge = () => {
    setEditingChargeId(null);
    setChargeForm({ type: '', description: '', rate: String(8), qty: String(plannedM) });
    setShowChargeModal(true);
  };
  const openEditCharge = (c) => {
    setEditingChargeId(c.id);
    setChargeForm({
      type: c.type || '',
      description: c.description || '',
      rate: String(c.rate ?? ''),
      qty: String(c.qty ?? ''),
    });
    setShowChargeModal(true);
  };
  const handleSaveCharge = (e) => {
    e?.preventDefault?.();
    const rate = Number(chargeForm.rate) || 0;
    const qty = Number(chargeForm.qty) || 0;
    if (!chargeForm.type.trim()) { window.alert('Charge type is required.'); return; }
    if (!(qty > 0)) { window.alert('Quantity must be greater than 0.'); return; }
    const row = {
      id: editingChargeId || `pc-${Date.now()}`,
      type: chargeForm.type.trim(),
      description: chargeForm.description.trim(),
      rate,
      qty,
      amount: qty * rate,
      status: 'Active',
    };
    const next = editingChargeId
      ? planCharges.map((c) => (String(c.id) === String(editingChargeId) ? row : c))
      : [...planCharges, row];
    persistPlan({ ...po, charges: next });
    setShowChargeModal(false);
    setEditingChargeId(null);
  };
  const handleDeleteCharge = (cid) => {
    if (!window.confirm('Delete this charge?')) return;
    persistPlan({ ...po, charges: planCharges.filter((c) => String(c.id) !== String(cid)) });
  };

  if (!po) {
    return (
      <div className="min-h-[calc(100vh-62px)] bg-[#f4f7fb] p-3 md:p-4">
        <div className="mt-3 rounded-xl border border-[#e2eaf5] bg-white p-10 text-center">
          <p className="text-[14px] font-extrabold text-[#17294e]">No records found</p>
          <p className="mt-1 text-[12px] text-slate-400">This process plan no longer exists.</p>
          <button
            onClick={() => navigate('/job-work/process-plan')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-4 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Back to Process Plan
          </button>
        </div>
      </div>
    );
  }

  const handleDuplicate = async () => {
    const copy = {
      ...po,
      id: `pp-${Date.now()}`,
      planNo: nextPlanNumber(plans),
      status: 'Active',
      date: new Date().toISOString().slice(0, 10),
    };
    persist([copy, ...plans]);
    try {
      const { pushCreatePlan, isJobWorkBackendEnabled } = await import('../../services/jobWorkSync');
      if (isJobWorkBackendEnabled()) {
        await pushCreatePlan(copy);
      }
    } catch {}
    navigate(`/job-work/process-plan/${copy.id}`);
  };

  const handleSave = async (values) => {
    const updated = { ...po, ...values };
    const nextPlans = plans.map((p) => (p.id === po.id ? updated : p));
    persist(nextPlans);
    try {
      const { pushUpdatePlan, isJobWorkBackendEnabled } = await import('../../services/jobWorkSync');
      if (isJobWorkBackendEnabled()) {
        await pushUpdatePlan(po.id, updated);
      }
    } catch {}
    setShowEdit(false);
  };

  const plannedM = Number(po.plannedQty ?? po.expectedQty) || 0;
  const lossPct = Number(po.expectedLoss) || 0;
  const returnM = Number(po.expectedReturnQty) || Math.round(plannedM * (1 - lossPct / 100) * 100) / 100;
  const startDate = po.startDate || po.date || '';
  const completionDate = po.expectedCompletionDate || po.targetDate || '';
  const createdOn = po.created_at
    ? `${toDDMMYYYY(String(po.created_at).slice(0, 10))} ${new Date(po.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
    : `${toDDMMYYYY(po.date)} 10:30 AM`;

  const dir = VENDOR_CONTACTS?.[po.vendor] || {};
  const contactPerson = po.contactPerson || dir.contact || '—';
  const phone = po.phone || dir.phone || '—';
  const email = po.email || dir.email || '—';
  const address = po.address || dir.address || '—';

  const relatedJwos = (jwos || []).filter((o) =>
    (o.processPlanId && String(o.processPlanId) === String(po.id)) ||
    ((o.vendor === po.vendor || o.process === po.process) &&
      (String(o.processPlanId || '') === '' || o.processPlanId == null) &&
      o.vendor === po.vendor && o.process === po.process),
  );
  const linkedQty = relatedJwos.reduce((s, o) => s + (jwoKpis(o).totalOrdered || 0), 0);
  const linkedReceived = relatedJwos.reduce((s, o) => s + (jwoKpis(o).totalInward || 0), 0);
  const linkedPending = relatedJwos.reduce((s, o) => s + (jwoKpis(o).pending || 0), 0);
  const linkedAmt = relatedJwos.reduce((s, o) => s + (jwoKpis(o).totalAmount || 0), 0);

  // ── Timeline: 7 stages derived from plan + JWOs, no dump data ──
  const addDays = (iso, n) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const firstJWO = relatedJwos[0] || null;
  const firstOutward = (relatedJwos.flatMap((o) => o.outwards || []))[0] || null;
  const firstInward = (relatedJwos.flatMap((o) => o.inwards || []))[0] || null;
  const inwardPlanned = (firstJWO && firstJWO.expectedCompletion) || completionDate || '';
  const baseStages = [
    { stage: 'Process Plan Created', planned: po.date || '', actual: (po.created_at ? String(po.created_at).slice(0, 10) : po.date) || '', status: 'Completed', remarks: '' },
    { stage: 'Job Work Order', planned: (firstJWO && firstJWO.orderDate) || '', actual: (firstJWO && firstJWO.orderDate) || '', status: firstJWO ? 'Completed' : 'Pending', remarks: firstJWO ? `${firstJWO.jwoNo} created` : '' },
    { stage: 'Outward Challan', planned: (firstJWO && firstJWO.orderDate) || '', actual: (firstOutward && firstOutward.date) || '', status: firstOutward ? 'Completed' : 'Pending', remarks: '' },
    { stage: 'Processing', planned: (firstOutward && firstOutward.date) || (firstJWO && firstJWO.orderDate) || '', actual: '', status: firstOutward && !firstInward ? 'In Progress' : firstInward ? 'Completed' : 'Pending', remarks: firstOutward ? 'Fabric at vendor' : '' },
    { stage: 'Inward Receipt', planned: inwardPlanned, actual: (firstInward && firstInward.date) || '', status: firstInward ? 'Completed' : 'Pending', remarks: '' },
    { stage: 'Quality Check', planned: inwardPlanned ? addDays(inwardPlanned, 3) : '', actual: '', status: po.status === 'Completed' ? 'Completed' : 'Pending', remarks: '' },
    { stage: 'Completion', planned: completionDate || (inwardPlanned ? addDays(inwardPlanned, 5) : ''), actual: po.status === 'Completed' ? (completionDate || '') : '', status: po.status === 'Completed' ? 'Completed' : 'Pending', remarks: '' },
  ];
  const timelineOverrides = po.timelineOverrides || {};
  const timelineStages = baseStages.map((s, i) => ({ ...s, ...(timelineOverrides[i] || {}) }));
  const timelinePill = (s) =>
    s === 'Completed'
      ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
      : s === 'In Progress'
        ? 'bg-blue-100 text-blue-600 border-blue-200'
        : 'bg-orange-100 text-orange-500 border-orange-200';
  const [viewingStage, setViewingStage] = useState(null);
  const [editingStageIdx, setEditingStageIdx] = useState(null);
  const [stageForm, setStageForm] = useState({ planned: '', actual: '', status: 'Pending', remarks: '' });

  const openEditStage = (idx) => {
    const s = timelineStages[idx];
    setEditingStageIdx(idx);
    setStageForm({ planned: s.planned || '', actual: s.actual || '', status: s.status || 'Pending', remarks: s.remarks || '' });
  };
  const handleSaveStage = (e) => {
    e?.preventDefault?.();
    if (editingStageIdx === null) return;
    const next = { ...(po.timelineOverrides || {}), [editingStageIdx]: { ...stageForm } };
    persist(plans.map((p) => (String(p.id) === String(po.id) ? { ...p, timelineOverrides: next } : p)));
    setEditingStageIdx(null);
  };

  // ── Material Requirement rows: ONLY user-added rows, no dump/seed data ──
  const materialRows = (po.requirementRows || []).map((r) => ({
    ...r,
    requiredQty: Number(r.requiredQty) || 0,
    availableQty: Number(r.availableQty) || 0,
    allocatedQty: Number(r.allocatedQty) || 0,
    pendingQty: Math.max(0, (Number(r.requiredQty) || 0) - (Number(r.allocatedQty) || 0)),
  }));
  const matTotals = materialRows.reduce(
    (t, r) => ({
      required: t.required + r.requiredQty,
      available: t.available + r.availableQty,
      allocated: t.allocated + r.allocatedQty,
      pending: t.pending + r.pendingQty,
    }),
    { required: 0, available: 0, allocated: 0, pending: 0 },
  );

  const persistMaterials = (rows) => {
    persist(plans.map((p) => (String(p.id) === String(po.id) ? { ...p, requirementRows: rows } : p)));
  };

  const openAddMaterial = () => {
    setEditingMaterialIdx(null);
    setMaterialForm({
      fabricItem: '', fabricQuality: '', shade: '', greyLotNo: '', takaRollNo: '',
      requiredQty: '', availableQty: '', allocatedQty: '',
    });
    setShowMaterialModal(true);
  };

  const openEditMaterial = (idx) => {
    const r = materialRows[idx];
    setEditingMaterialIdx(idx);
    setMaterialForm({
      fabricItem: r.fabricItem || '', fabricQuality: r.fabricQuality || '', shade: r.shade || '',
      greyLotNo: r.greyLotNo || '', takaRollNo: r.takaRollNo || '',
      requiredQty: String(r.requiredQty ?? ''), availableQty: String(r.availableQty ?? ''), allocatedQty: String(r.allocatedQty ?? ''),
    });
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = (e) => {
    e?.preventDefault?.();
    const required = Number(materialForm.requiredQty) || 0;
    const available = Number(materialForm.availableQty) || 0;
    const allocated = Number(materialForm.allocatedQty) || 0;
    if (!materialForm.fabricItem?.trim()) { window.alert('Please enter Fabric Item.'); return; }
    if (!(required > 0)) { window.alert('Required Qty must be greater than 0.'); return; }
    if (allocated < 0 || allocated > required) { window.alert('Allocated must be between 0 and Required.'); return; }
    const row = {
      fabricItem: materialForm.fabricItem.trim(),
      fabricQuality: materialForm.fabricQuality || '',
      shade: materialForm.shade || '',
      greyLotNo: materialForm.greyLotNo || '',
      takaRollNo: materialForm.takaRollNo || '',
      requiredQty: required, availableQty: available, allocatedQty: allocated,
    };
    const current = (po.requirementRows || []);
    const next = editingMaterialIdx === null ? [...current, row] : current.map((r, i) => (i === editingMaterialIdx ? row : r));
    persistMaterials(next);
    setShowMaterialModal(false);
    setEditingMaterialIdx(null);
  };

  const handleDeleteMaterial = (idx) => {
    if (!window.confirm('Delete this material row?')) return;
    const current = (po.requirementRows || []);
    persistMaterials(current.filter((_, i) => i !== idx));
  };

  const jwoStatusPill = (s) =>
    s === 'Completed'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
      : s === 'In-Process'
        ? 'bg-orange-50 text-orange-500 border-orange-200'
        : 'bg-amber-50 text-amber-600 border-amber-200';

  const handleCreateJWO = () => {
    // Fully BLANK form — user enters every value manually.
    setCreateForm({
      jwoNo: '',
      orderDate: '',
      vendor: '',
      process: '',
      plannedQty: '',
      receivedQty: '',
      rate: '',
      expectedCompletion: '',
      status: 'In-Process',
    });
    setShowCreateJWO(true);
  };

  // A row opened in a modal can be re-identified by the background sync
  // (local `jwo-…` id → server UUID) before Save. Match id first, jwoNo after.
  const sameJwo = (o, ref) =>
    String(o.id) === String(ref.id) ||
    (ref.jwoNo && String(o.jwoNo) === String(ref.jwoNo));

  const persistJwos = (next) => {
    setJwos(next);
    try { saveJWOs(next); } catch { /* ignore */ }
    // Background backend sync for the changed row(s).
    import('../../services/jobWorkSync').then(({ pushUpdateJWO, isJobWorkBackendEnabled }) => {
      if (!isJobWorkBackendEnabled()) return;
      next.forEach((o) => { try { pushUpdateJWO(o.id, o)?.catch?.(() => {}); } catch {} });
    }).catch(() => {});
  };

  const handleSaveCreateJWO = (e) => {
    e?.preventDefault?.();
    if (!createForm.jwoNo?.trim()) {
      window.alert('Please enter JWO No. manually.');
      return;
    }
    if (!createForm.orderDate) {
      window.alert('Please enter Date manually.');
      return;
    }
    if (!createForm.vendor) {
      window.alert('Please select Vendor manually.');
      return;
    }
    if (!createForm.process) {
      window.alert('Please select Process manually.');
      return;
    }
    const qty = Number(createForm.plannedQty) || 0;
    const rate = Number(createForm.rate) || 0;
    const received = Number(createForm.receivedQty) || 0;
    if (!(qty > 0)) {
      window.alert('Please enter Quantity manually (must be greater than 0).');
      return;
    }
    if (!(rate > 0)) {
      window.alert('Please enter Rate manually (must be greater than 0).');
      return;
    }
    if (received < 0 || received > qty) {
      window.alert('Received must be between 0 and Quantity.');
      return;
    }
    const fresh = {
      id: `jwo-${Date.now()}`,
      jwoNo: createForm.jwoNo.trim(),
      processPlanId: po.id,
      process: createForm.process,
      vendor: createForm.vendor,
      orderDate: createForm.orderDate,
      plannedQty: qty,
      rate,
      totalAmount: qty * rate,
      expectedCompletion: createForm.expectedCompletion || '',
      status: createForm.status || 'In-Process',
      materials: [
        {
          id: `m-${Date.now()}`,
          fabricItem: po.fabricItem || 'Cotton Fabric',
          fabricQuality: po.fabricQuality || 'GSM 120',
          shade: po.shade || '',
          lotNo: po.greyLotNo || 'LOT-001',
          qty,
          rate,
          amount: qty * rate,
        },
      ],
      outwards: [],
      inwards: received > 0 ? [{
        id: `i-${Date.now()}`,
        no: 'JWO-IN-001',
        date: createForm.orderDate,
        qty: received,
        accepted: received,
        rejected: 0,
        status: 'Received',
      }] : [],
      remarks: '',
    };
    // Save locally and STAY on this tab so the new row is visible in the table.
    const next = [fresh, ...jwos];
    setJwos(next);
    try { saveJWOs(next); } catch { /* ignore */ }
    setShowCreateJWO(false);
    setTab('Job Work Orders');
    // Sync to backend in the background (server owns the JWO number).
    // On success the server row has a new id — replace the URL so a
    // refresh still finds the order instead of "not found".
    import('../../services/jobWorkSync').then(({ pushCreateJWO, isJobWorkBackendEnabled }) => {
      if (!isJobWorkBackendEnabled()) return;
      pushCreateJWO(fresh).then((saved) => {
        if (saved) {
          setJwos((prev) => {
            const merged = prev.map((o) => (o.id === fresh.id ? saved : o));
            try { saveJWOs(merged); } catch { /* ignore */ }
            return merged;
          });
        }
      }).catch(() => { /* offline — local copy already saved */ });
    });
  };

  const openEditJWO = (o) => {
    setEditingJWO(o);
    setEditForm({
      jwoNo: o.jwoNo || '',
      orderDate: o.orderDate || '',
      vendor: o.vendor || '',
      process: o.process || '',
      plannedQty: String(o.plannedQty ?? ''),
      receivedQty: String(jwoKpis(o).totalInward ?? ''),
      rate: String(o.rate ?? ''),
      expectedCompletion: o.expectedCompletion || '',
      status: o.status || 'In-Process',
    });
  };

  const handleSaveEditJWO = (e) => {
    e?.preventDefault?.();
    if (!editingJWO) return;
    const qty = Number(editForm.plannedQty) || 0;
    const rate = Number(editForm.rate) || 0;
    const received = Number(editForm.receivedQty) || 0;
    if (!(qty > 0)) {
      window.alert('Quantity must be greater than 0.');
      return;
    }
    if (received < 0 || received > qty) {
      window.alert('Received must be between 0 and Quantity.');
      return;
    }
    const inwards = received > 0 ? [{
      id: (editingJWO.inwards || [])[0]?.id || `i-${Date.now()}`,
      no: (editingJWO.inwards || [])[0]?.no || 'JWO-IN-001',
      date: editForm.orderDate || editingJWO.orderDate,
      qty: received,
      accepted: received,
      rejected: 0,
      status: 'Received',
    }] : [];
    const updated = {
      ...editingJWO,
      jwoNo: editForm.jwoNo || editingJWO.jwoNo,
      orderDate: editForm.orderDate || editingJWO.orderDate,
      vendor: editForm.vendor,
      process: editForm.process,
      plannedQty: qty,
      rate,
      totalAmount: qty * rate,
      expectedCompletion: editForm.expectedCompletion,
      status: editForm.status,
      inwards,
      materials: (editingJWO.materials || []).length
        ? (editingJWO.materials || []).map((m, i) =>
            i === 0 ? { ...m, qty, rate, amount: qty * rate } : m,
          )
        : editingJWO.materials,
    };
    persistJwos(jwos.map((o) => (sameJwo(o, editingJWO) ? { ...updated, id: o.id } : o)));
    setEditingJWO(null);
    setEditForm(null);
  };

  const openAddTxn = (o) => {
    setAddingJWO(o);
    setAddForm({ type: 'outward', qty: '', date: new Date().toISOString().slice(0, 10) });
  };

  const handleSaveAddTxn = (e) => {
    e?.preventDefault?.();
    if (!addingJWO) return;
    const qty = Number(addForm.qty) || 0;
    if (!(qty > 0)) {
      window.alert('Quantity must be greater than 0.');
      return;
    }
    let updated;
    if (addForm.type === 'outward') {
      const max = (addingJWO.outwards || []).reduce((m, x) => Math.max(m, Number(String(x.no || '').replace(/\D/g, '')) || 0), 0);
      const entry = {
        id: `o-${Date.now()}`,
        no: `JWO-OUT-${String(max + 1).padStart(3, '0')}`,
        date: addForm.date,
        qty,
        status: 'Sent',
      };
      updated = { ...addingJWO, outwards: [...(addingJWO.outwards || []), entry] };
    } else {
      const max = (addingJWO.inwards || []).reduce((m, x) => Math.max(m, Number(String(x.no || '').replace(/\D/g, '')) || 0), 0);
      const entry = {
        id: `i-${Date.now()}`,
        no: `JWO-IN-${String(max + 1).padStart(3, '0')}`,
        date: addForm.date,
        qty,
        accepted: qty,
        rejected: 0,
        status: 'Received',
      };
      updated = { ...addingJWO, inwards: [...(addingJWO.inwards || []), entry] };
    }
    persistJwos(jwos.map((o) => (sameJwo(o, addingJWO) ? { ...updated, id: o.id } : o)));
    setAddingJWO(null);
  };

  const summary = [
    ['Process', po.process || '—'],
    ['Vendor', po.vendor || '—'],
    ['Plan Date', toDDMMYYYY(po.date)],
    ['Planned Qty (M)', numIN(plannedM)],
    ['Expected Loss (%)', lossPct.toFixed(2)],
    ['Expected Return (M)', numIN(returnM)],
    ['Start Date', startDate ? toDDMMYYYY(startDate) : '—'],
    ['Completion Date', completionDate ? toDDMMYYYY(completionDate) : '—'],
  ];

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#f4f7fb] p-3 md:p-5 space-y-3.5">
      {/* Top Header */}
      <PageHeader
        title={`Process Plan Details - ${po.planNo}`}
        titleExtra={
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPill(po.status)}`}>
            {po.status || 'Active'}
          </span>
        }
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Job Work / Processing' },
          { label: 'Process Plan', path: '/job-work/process-plan' },
          { label: po.planNo },
        ]}
        actions={
          <>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8] transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Printer size={13} /> Print
            </button>
          </>
        }
      />

      {/* Section 1 — Summary strip (separate card) */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {summary.map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-medium text-slate-400">{k}</p>
              <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — Tabs + body (separate card) */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        {/* Tab Strip */}
        <div className="flex gap-5 overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap pb-2 text-[12.5px] font-bold transition-colors ${
                tab === t ? 'border-b-2 border-[#2563eb] text-[#2563eb]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="mt-4">
          {tab === 'Plan Details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Basic Information */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#17294e]">Basic Information</p>
                  <div className="mt-2">
                    <InfoRow label="Process Plan No." value={po.planNo} />
                    <InfoRow label="Plan Date" value={toDDMMYYYY(po.date)} />
                    <InfoRow label="Process" value={po.process || '—'} />
                    <InfoRow label="Process Category" value={po.processCategory || '—'} accent="text-amber-500" />
                    <InfoRow label="Status" value={po.status || 'Active'} accent="text-emerald-500" />
                    <InfoRow label="Created By" value={po.assignedEmployee || po.createdBy || 'Admin'} />
                    <InfoRow label="Created On" value={createdOn} />
                  </div>
                </div>

                {/* Material Details */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Material Details</p>
                  <div className="mt-2">
                    <InfoRow label="Fabric Item" value={po.fabricItem || '—'} />
                    <InfoRow label="Fabric Quality" value={po.fabricQuality || '—'} />
                    <InfoRow label="Shade / Colour" value={po.shade || '—'} />
                    <InfoRow label="Grey Lot No." value={po.greyLotNo || 'LOT-001'} />
                    <InfoRow label="Taka / Roll No." value={po.takaRollNo || po.takaRoll || 'T-001'} />
                    <InfoRow label="Weight (KG)" value={po.weight ? numIN(po.weight) : '12,500'} />
                    <InfoRow label="No. of Rolls" value={po.noOfRolls || '250'} />
                  </div>
                </div>

                {/* Vendor Details */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Vendor Details</p>
                  <div className="mt-2">
                    <InfoRow label="Vendor" value={po.vendor || '—'} />
                    <InfoRow label="Contact Person" value={contactPerson} />
                    <InfoRow label="Phone" value={phone} />
                    <InfoRow label="Email" value={email} />
                    <InfoRow label="Address" value={address} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Quantity & Planning */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 lg:col-span-2">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Quantity &amp; Planning</p>
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {[
                      ['Planned Quantity (M)', numIN(plannedM)],
                      ['Expected Loss (%)', lossPct.toFixed(2)],
                      ['Expected Return (M)', numIN(returnM)],
                      ['Start Date', startDate ? toDDMMYYYY(startDate) : '—'],
                      ['Completion Date', completionDate ? toDDMMYYYY(completionDate) : '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] font-medium text-slate-400">{k}</p>
                        <p className="mt-0.5 text-[14px] font-extrabold text-[#17294e]">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remarks */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Remarks</p>
                  <p className="mt-2 text-[12.5px] font-medium leading-6 text-slate-600">
                    {po.remarks || 'Dyeing process for export order.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'Job Work Orders' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Linked Job Work Orders</h3>
                <button
                  onClick={handleCreateJWO}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={14} /> Create Job Work Order
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[1180px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">JWO No.</th>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Vendor</th>
                      <th className="px-3.5 py-2.5">Process</th>
                      <th className="px-3.5 py-2.5 text-right">Quantity (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Received (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Pending (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Rate (₹/M)</th>
                      <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
                      <th className="px-3.5 py-2.5">Exp. Completion</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedJwos.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                          No job work orders linked to {po.planNo} yet.
                        </td>
                      </tr>
                    )}
                    {relatedJwos.map((o, i) => {
                      const k = jwoKpis(o);
                      return (
                      <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3">
                          <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="font-mono font-bold text-blue-600 hover:underline">
                            {o.jwoNo}
                          </button>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{toDDMMYYYY(o.orderDate)}</td>
                        <td className="px-3.5 py-3 text-slate-600">{o.vendor}</td>
                        <td className="px-3.5 py-3 text-slate-600">{o.process}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(k.totalOrdered)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(k.totalInward)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-600">{numIN(k.pending)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{Number(o.rate || 0).toFixed(2)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">{numIN(k.totalAmount)}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{o.expectedCompletion ? toDDMMYYYY(o.expectedCompletion) : '—'}</td>
                        <td className="px-3.5 py-3 text-center">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${jwoStatusPill(o.status)}`}>
                            {o.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingJWO(o)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEditJWO(o)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => openAddTxn(o)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Add">
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {relatedJwos.length > 0 && (
                      <tr className="bg-slate-50/70 font-extrabold text-[#17294e]">
                        <td className="px-3.5 py-2.5 text-center" colSpan={5}>Total</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedQty)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedReceived)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedPending)}</td>
                        <td className="px-3.5 py-2.5" />
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedAmt)}</td>
                        <td className="px-3.5 py-2.5" />
                        <td colSpan={2} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Remarks' && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <p className="text-[13.5px] font-extrabold text-[#2563eb]">Remarks</p>
              <p className="mt-2 text-[12.5px] font-medium leading-6 text-slate-600">
                {po.remarks || 'Dyeing process for export order.'}
              </p>
            </div>
          )}

          {tab === 'Material Requirement' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Material Requirement</h3>
                <button
                  onClick={openAddMaterial}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={14} /> Add Material
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[1080px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">Fabric Item</th>
                      <th className="px-3.5 py-2.5">Fabric Quality</th>
                      <th className="px-3.5 py-2.5">Shade / Colour</th>
                      <th className="px-3.5 py-2.5">Grey Lot No.</th>
                      <th className="px-3.5 py-2.5">Taka / Roll</th>
                      <th className="px-3.5 py-2.5 text-right">Required Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Available Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Allocated Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Pending Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                          No materials added yet. Click "+ Add Material" to add one.
                        </td>
                      </tr>
                    )}
                    {materialRows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3 text-slate-700">{r.fabricItem || '—'}</td>
                        <td className="px-3.5 py-3 text-slate-700">{r.fabricQuality || '—'}</td>
                        <td className="px-3.5 py-3 text-slate-700">{r.shade || '—'}</td>
                        <td className="px-3.5 py-3 font-mono text-slate-700">{r.greyLotNo || '—'}</td>
                        <td className="px-3.5 py-3 font-mono text-slate-700">{r.takaRollNo || '—'}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(r.requiredQty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(r.availableQty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(r.allocatedQty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">{numIN(r.pendingQty)}</td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingMaterial(r)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEditMaterial(i)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteMaterial(i)} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {materialRows.length > 0 && (
                      <tr className="bg-slate-50/70 font-extrabold text-[#17294e]">
                        <td className="px-3.5 py-2.5 text-center" colSpan={6}>Total</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(matTotals.required)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(matTotals.available)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(matTotals.allocated)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(matTotals.pending)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Timeline' && (
            <div className="space-y-3">
              <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Timeline</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[900px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">Stage</th>
                      <th className="px-3.5 py-2.5">Planned Date</th>
                      <th className="px-3.5 py-2.5">Actual Date</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5">Remarks</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineStages.map((s, i) => (
                      <tr key={s.stage} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3 text-slate-700">{s.stage}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{s.planned ? toDDMMYYYY(s.planned) : '–'}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{s.actual ? toDDMMYYYY(s.actual) : '-'}</td>
                        <td className="px-3.5 py-3 text-center">
                          <span className={`inline-block min-w-[92px] rounded-lg border px-3 py-1 text-[11px] font-bold ${timelinePill(s.status)}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600">{s.remarks || '-'}</td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingStage({ ...s, idx: i })} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEditStage(i)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                              <Pencil size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Charges' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Processing Charges</h3>
                <button
                  onClick={openAddCharge}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={14} /> Add Charge
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[860px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">Charge Type</th>
                      <th className="px-3.5 py-2.5">Description</th>
                      <th className="px-3.5 py-2.5 text-right">Rate (₹/M)</th>
                      <th className="px-3.5 py-2.5 text-right">Quantity (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planCharges.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                          No charges added yet. Click "+ Add Charge" above.
                        </td>
                      </tr>
                    )}
                    {planCharges.map((c, i) => (
                      <tr key={c.id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3 font-semibold text-slate-800">{c.type}</td>
                        <td className="px-3.5 py-3 text-slate-600">{c.description || '—'}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{Number(c.rate || 0).toFixed(2)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(c.qty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">{numIN(c.amount)}</td>
                        <td className="px-3.5 py-3 text-center">
                          <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-600">
                            {c.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingCharge(c)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEditCharge(c)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteCharge(c.id)} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab !== 'Plan Details' && tab !== 'Job Work Orders' && tab !== 'Material Requirement' && tab !== 'Timeline' && tab !== 'Charges' && tab !== 'Remarks' && (
            <div className="rounded-lg bg-slate-50 px-4 py-12 text-center">
              <p className="text-[13px] font-extrabold text-[#17294e]">No records found</p>
              <p className="mt-1 text-[11.5px] text-slate-400">There is no {tab} data for {po.planNo} yet.</p>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <ProcessPlanForm
          title={`Edit Process Plan — ${po.planNo}`}
          initial={po}
          isEdit={true}
          isModal={true}
          plans={plans}
          onSave={handleSave}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">
                {editingChargeId ? 'Edit Charge' : 'Add Charge'} — {po.planNo}
              </h3>
              <button
                onClick={() => setShowChargeModal(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCharge} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Charge Type *</label>
                <input
                  required
                  value={chargeForm.type}
                  onChange={(e) => setChargeForm({ ...chargeForm, type: e.target.value })}
                  placeholder="e.g. Dyeing Charge"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Description</label>
                <input
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                  placeholder="e.g. Dyeing Processing"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Rate (₹/M) *</label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={chargeForm.rate}
                  onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Quantity (M) *</label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={chargeForm.qty}
                  onChange={(e) => setChargeForm({ ...chargeForm, qty: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2.5 text-right text-[13px] font-extrabold text-[#17294e]">
                Amount: ₹ {numIN((Number(chargeForm.qty) || 0) * (Number(chargeForm.rate) || 0))}
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-5 py-2 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  {editingChargeId ? 'Update Charge' : 'Add Charge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs" onClick={() => setViewingCharge(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">{viewingCharge.type}</h3>
              <button
                onClick={() => setViewingCharge(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 space-y-1.5 text-[12.5px]">
              <InfoRow label="Description" value={viewingCharge.description || '—'} />
              <InfoRow label="Rate (₹/M)" value={Number(viewingCharge.rate || 0).toFixed(2)} />
              <InfoRow label="Quantity (M)" value={numIN(viewingCharge.qty)} />
              <InfoRow label="Amount (₹)" value={numIN(viewingCharge.amount)} />
              <InfoRow label="Status" value={viewingCharge.status || 'Active'} accent="text-emerald-600" />
            </div>
          </div>
        </div>
      )}

      {showCreateJWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Create Job Work Order — {po.planNo}</h3>
              <button
                onClick={() => setShowCreateJWO(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCreateJWO} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">JWO No.</label>
                <input
                  required
                  value={createForm.jwoNo}
                  onChange={(e) => setCreateForm({ ...createForm, jwoNo: e.target.value })}
                  placeholder="e.g. JWO-005"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Date</label>
                <input
                  type="date"
                  required
                  value={createForm.orderDate}
                  onChange={(e) => setCreateForm({ ...createForm, orderDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Vendor</label>
                <select
                  required
                  value={createForm.vendor}
                  onChange={(e) => setCreateForm({ ...createForm, vendor: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="">Select vendor</option>
                  {(VENDOR_OPTIONS || []).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Process</label>
                <select
                  required
                  value={createForm.process}
                  onChange={(e) => setCreateForm({ ...createForm, process: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="">Select process</option>
                  {(PROCESS_OPTIONS || []).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Quantity (M)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={createForm.plannedQty}
                  onChange={(e) => setCreateForm({ ...createForm, plannedQty: e.target.value })}
                  placeholder="e.g. 1200"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Received (M)</label>
                <input
                  type="number"
                  min="0"
                  value={createForm.receivedQty}
                  onChange={(e) => setCreateForm({ ...createForm, receivedQty: e.target.value })}
                  placeholder="e.g. 0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Pending (M)</label>
                <input
                  readOnly
                  placeholder="Auto"
                  value={createForm.plannedQty ? numIN(Math.max(0, (Number(createForm.plannedQty) || 0) - (Number(createForm.receivedQty) || 0))) : ''}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-amber-600 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Rate (₹/M)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={createForm.rate}
                  onChange={(e) => setCreateForm({ ...createForm, rate: e.target.value })}
                  placeholder="e.g. 8"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Amount (₹)</label>
                <input
                  readOnly
                  placeholder="Auto"
                  value={createForm.plannedQty && createForm.rate ? numIN((Number(createForm.plannedQty) || 0) * (Number(createForm.rate) || 0)) : ''}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  {['In-Process', 'Completed', 'Draft'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Expected Completion</label>
                <input
                  type="date"
                  value={createForm.expectedCompletion}
                  onChange={(e) => setCreateForm({ ...createForm, expectedCompletion: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateJWO(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingJWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Job Work Order — {viewingJWO.jwoNo}</h3>
              <button onClick={() => setViewingJWO(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['JWO No.', viewingJWO.jwoNo], ['Date', toDDMMYYYY(viewingJWO.orderDate)], ['Vendor', viewingJWO.vendor], ['Process', viewingJWO.process], ['Quantity (M)', numIN(jwoKpis(viewingJWO).totalOrdered)], ['Received (M)', numIN(jwoKpis(viewingJWO).totalInward)], ['Pending (M)', numIN(jwoKpis(viewingJWO).pending)], ['Rate (₹/M)', Number(viewingJWO.rate || 0).toFixed(2)], ['Amount (₹)', numIN(jwoKpis(viewingJWO).totalAmount)], ['Exp. Completion', viewingJWO.expectedCompletion ? toDDMMYYYY(viewingJWO.expectedCompletion) : '—'], ['Status', viewingJWO.status]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-400">{k}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setViewingJWO(null); navigate(`/job-work/orders/${viewingJWO.id}`); }} className="rounded-lg bg-[#2563eb] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-[#1d4ed8]">
                Open Full Details
              </button>
            </div>
          </div>
        </div>
      )}

      {editingJWO && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Edit Job Work Order — {editingJWO.jwoNo}</h3>
              <button onClick={() => { setEditingJWO(null); setEditForm(null); }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditJWO} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">JWO No.</label>
                <input value={editForm.jwoNo} onChange={(e) => setEditForm({ ...editForm, jwoNo: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Date</label>
                <input type="date" required value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Vendor</label>
                <select value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {(VENDOR_OPTIONS || []).map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Process</label>
                <select value={editForm.process} onChange={(e) => setEditForm({ ...editForm, process: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {(PROCESS_OPTIONS || []).map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Quantity (M)</label>
                <input type="number" required min="1" value={editForm.plannedQty} onChange={(e) => setEditForm({ ...editForm, plannedQty: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Received (M)</label>
                <input type="number" min="0" value={editForm.receivedQty} onChange={(e) => setEditForm({ ...editForm, receivedQty: e.target.value })} placeholder="e.g. 0" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Pending (M)</label>
                <input readOnly placeholder="Auto" value={editForm.plannedQty ? numIN(Math.max(0, (Number(editForm.plannedQty) || 0) - (Number(editForm.receivedQty) || 0))) : ''} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-amber-600 outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Rate (₹/M)</label>
                <input type="number" required min="0" step="0.01" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Amount (₹)</label>
                <input readOnly value={numIN((Number(editForm.plannedQty) || 0) * (Number(editForm.rate) || 0))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {['In-Process', 'Completed', 'Draft'].map((s) => (<option key={s}>{s}</option>))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Expected Completion</label>
                <input type="date" value={editForm.expectedCompletion} onChange={(e) => setEditForm({ ...editForm, expectedCompletion: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setEditingJWO(null); setEditForm(null); }} className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]">
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addingJWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Add Transaction — {addingJWO.jwoNo}</h3>
              <button onClick={() => setAddingJWO(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveAddTxn} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Type</label>
                <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  <option value="outward">Outward Challan (dispatched)</option>
                  <option value="inward">Inward Receipt (received)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-600">Date</label>
                  <input type="date" required value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-600">Quantity (M)</label>
                  <input type="number" required min="1" value={addForm.qty} onChange={(e) => setAddForm({ ...addForm, qty: e.target.value })} placeholder="e.g. 500" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddingJWO(null)} className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]">
                  Add {addForm.type === 'outward' ? 'Outward' : 'Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">{editingMaterialIdx === null ? 'Add Material' : 'Edit Material'} — {po.planNo}</h3>
              <button onClick={() => setShowMaterialModal(false)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveMaterial} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Fabric Item</label>
                <input required value={materialForm.fabricItem} onChange={(e) => setMaterialForm({ ...materialForm, fabricItem: e.target.value })} placeholder="e.g. Cotton Fabric" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Fabric Quality</label>
                <input value={materialForm.fabricQuality} onChange={(e) => setMaterialForm({ ...materialForm, fabricQuality: e.target.value })} placeholder="e.g. GSM 120" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Shade / Colour</label>
                <input value={materialForm.shade} onChange={(e) => setMaterialForm({ ...materialForm, shade: e.target.value })} placeholder="e.g. Navy Blue" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Grey Lot No.</label>
                <input value={materialForm.greyLotNo} onChange={(e) => setMaterialForm({ ...materialForm, greyLotNo: e.target.value })} placeholder="e.g. LOT-001" className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Taka / Roll</label>
                <input value={materialForm.takaRollNo} onChange={(e) => setMaterialForm({ ...materialForm, takaRollNo: e.target.value })} placeholder="e.g. T-001" className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Required Qty (M)</label>
                <input type="number" required min="1" value={materialForm.requiredQty} onChange={(e) => setMaterialForm({ ...materialForm, requiredQty: e.target.value })} placeholder="e.g. 30000" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Available Qty (M)</label>
                <input type="number" min="0" value={materialForm.availableQty} onChange={(e) => setMaterialForm({ ...materialForm, availableQty: e.target.value })} placeholder="e.g. 30000" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Allocated Qty (M)</label>
                <input type="number" min="0" value={materialForm.allocatedQty} onChange={(e) => setMaterialForm({ ...materialForm, allocatedQty: e.target.value })} placeholder="e.g. 25000" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Pending Qty (M)</label>
                <input readOnly placeholder="Auto" value={materialForm.requiredQty ? numIN(Math.max(0, (Number(materialForm.requiredQty) || 0) - (Number(materialForm.allocatedQty) || 0))) : ''} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none" />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]">
                  {editingMaterialIdx === null ? 'Add Material' : 'Update Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Material — {viewingMaterial.fabricItem}</h3>
              <button onClick={() => setViewingMaterial(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['Fabric Item', viewingMaterial.fabricItem], ['Fabric Quality', viewingMaterial.fabricQuality], ['Shade / Colour', viewingMaterial.shade], ['Grey Lot No.', viewingMaterial.greyLotNo], ['Taka / Roll', viewingMaterial.takaRollNo], ['Required Qty (M)', numIN(viewingMaterial.requiredQty)], ['Available Qty (M)', numIN(viewingMaterial.availableQty)], ['Allocated Qty (M)', numIN(viewingMaterial.allocatedQty)], ['Pending Qty (M)', numIN(Math.max(0, (Number(viewingMaterial.requiredQty) || 0) - (Number(viewingMaterial.allocatedQty) || 0)))]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-400">{k}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v || '—'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setViewingMaterial(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">{viewingStage.stage}</h3>
              <button onClick={() => setViewingStage(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['Stage', viewingStage.stage], ['Status', viewingStage.status], ['Planned Date', viewingStage.planned ? toDDMMYYYY(viewingStage.planned) : '–'], ['Actual Date', viewingStage.actual ? toDDMMYYYY(viewingStage.actual) : '-'], ['Remarks', viewingStage.remarks || '-']].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-400">{k}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setViewingStage(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingStageIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Edit — {timelineStages[editingStageIdx]?.stage}</h3>
              <button onClick={() => setEditingStageIdx(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveStage} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Planned Date</label>
                <input type="date" value={stageForm.planned} onChange={(e) => setStageForm({ ...stageForm, planned: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Actual Date</label>
                <input type="date" value={stageForm.actual} onChange={(e) => setStageForm({ ...stageForm, actual: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Status</label>
                <select value={stageForm.status} onChange={(e) => setStageForm({ ...stageForm, status: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {['Pending', 'In Progress', 'Completed'].map((s) => (<option key={s}>{s}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Remarks</label>
                <input value={stageForm.remarks} onChange={(e) => setStageForm({ ...stageForm, remarks: e.target.value })} placeholder="e.g. JWO-001 created" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingStageIdx(null)} className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]">
                  Update Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
