import React from 'react';
import {
  Check, Boxes, Droplets, Cog, ShieldCheck, Layers, Play,
  Send, ArrowRightLeft, ClipboardList, Truck, Receipt, Trophy, CircleDot,
  ArrowRight, ShoppingCart, Factory, FileSpreadsheet, ExternalLink, AlertCircle,
  Sparkles, CheckCircle2, ChevronRight, Trash2, Calendar, Clock, Hourglass, XCircle,
  ArrowDownToLine, IndianRupee, FileText, Plus
} from 'lucide-react';
import { computeStageCompletionPct } from '../../../../stores/pmsStore';
import { StageStatusBadge } from '../../components/StageStatusBadge';

function dateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function weightOf(stage) {
  return Number(stage.percentage ?? stage.weightPct ?? stage.weight) || 0;
}

function qty(stage, key) {
  const v = stage.quantities?.[key];
  if (v === undefined || v === null || v === '') return '—';
  return Number(v).toLocaleString('en-IN');
}

function statusTone(status) {
  if (status === 'Completed') {
    return { ring: '#10b981', chipBg: '#d1fae5', chipFg: '#065f46', label: 'Completed' };
  }
  if (status === 'In Progress') {
    return { ring: '#2563eb', chipBg: '#dbeafe', chipFg: '#1d4ed8', label: 'In Progress' };
  }
  if (status === 'Not Required') {
    return { ring: '#94a3b8', chipBg: '#f1f5f9', chipFg: '#64748b', label: 'Not Required' };
  }
  if (status === 'Delayed') {
    return { ring: '#f43f5e', chipBg: '#ffe4e6', chipFg: '#9f1239', label: 'Delayed' };
  }
  if (status === 'At Risk') {
    return { ring: '#f59e0b', chipBg: '#fef3c7', chipFg: '#92400e', label: 'At Risk' };
  }
  return { ring: '#cbd5e1', chipBg: '#f8fafc', chipFg: '#64748b', label: 'Pending' };
}

function DepartmentBadge({ department }) {
  const d = (department || '').trim();
  let styleClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = d || 'General';

  if (d.toLowerCase().includes('purchase')) {
    styleClass = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'Purchase';
  } else if (d.toLowerCase().includes('inventory')) {
    styleClass = 'bg-slate-100 text-slate-700 border-slate-200';
    label = 'Inventory';
  } else if (d.toLowerCase().includes('quality') || d.toLowerCase() === 'qc') {
    styleClass = 'bg-teal-50 text-teal-700 border-teal-200';
    label = 'QC';
  } else if (d.toLowerCase().includes('production')) {
    styleClass = 'bg-amber-50 text-amber-700 border-amber-200';
    label = 'Production';
  } else if (d.toLowerCase().includes('accounts')) {
    styleClass = 'bg-purple-50 text-purple-700 border-purple-200';
    label = 'Accounts';
  } else if (d.toLowerCase().includes('job work') || d.toLowerCase().includes('jobwork')) {
    styleClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    label = 'Job Work';
  } else if (d.toLowerCase().includes('dispatch')) {
    styleClass = 'bg-orange-50 text-orange-700 border-orange-200';
    label = 'Dispatch';
  } else if (d.toLowerCase().includes('management')) {
    styleClass = 'bg-slate-50 text-slate-700 border-slate-200';
    label = 'Management';
  }

  return (
    <span className={`w-full max-w-[84px] py-0.5 px-1.5 rounded-full text-[10px] font-semibold text-center border truncate inline-block ${styleClass}`}>
      {label}
    </span>
  );
}

function StageIcon({ name, department, sequence }) {
  const text = `${name ?? ''} ${department ?? ''}`.toLowerCase();
  if (text.includes('purchase po') || text.includes('po') || text.includes('work instruction')) {
    return <FileText size={18} strokeWidth={1.8} />;
  }
  if (text.includes('supplier delivery') || text.includes('outward')) {
    return <Truck size={18} strokeWidth={1.8} />;
  }
  if (text.includes('grn') || text.includes('stock check') || text.includes('dispatch')) {
    return <Boxes size={18} strokeWidth={1.8} />;
  }
  if (text.includes('lot') || text.includes('taka')) {
    return <Layers size={18} strokeWidth={1.8} />;
  }
  if (text.includes('qc') || text.includes('quality') || text.includes('verification')) {
    return <ShieldCheck size={18} strokeWidth={1.8} />;
  }
  if (text.includes('stock updated')) {
    return <Boxes size={18} strokeWidth={1.8} />;
  }
  if (text.includes('assign') || text.includes('employee')) {
    return <ClipboardList size={18} strokeWidth={1.8} />;
  }
  if (text.includes('daily production') || text.includes('bill match')) {
    return <FileSpreadsheet size={18} strokeWidth={1.8} />;
  }
  if (text.includes('completion') || text.includes('closure')) {
    return <CheckCircle2 size={18} strokeWidth={1.8} />;
  }
  if (text.includes('payment') || text.includes('approval') || text.includes('invoice')) {
    return <IndianRupee size={18} strokeWidth={1.8} />;
  }
  if (text.includes('plan')) {
    return <ClipboardList size={18} strokeWidth={1.8} />;
  }
  if (text.includes('dye') || text.includes('processing')) {
    return <Cog size={18} strokeWidth={1.8} />;
  }
  if (text.includes('inward')) {
    return <ArrowDownToLine size={18} strokeWidth={1.8} />;
  }
  return <CircleDot size={18} strokeWidth={1.8} />;
}

function StageStatusPill({ status }) {
  if (status === 'Completed') {
    return (
      <span className="w-full max-w-[84px] py-0.5 px-2 rounded-full text-[10px] font-bold text-center bg-emerald-50 text-emerald-700 border border-emerald-200 truncate inline-block">
        Completed
      </span>
    );
  }
  if (status === 'Not Required') {
    return (
      <span className="w-full max-w-[84px] py-0.5 px-2 rounded-full text-[10px] font-bold text-center bg-slate-50 text-slate-500 border border-slate-200 truncate inline-block">
        Not Required
      </span>
    );
  }
  if (status === 'In Progress') {
    return (
      <span className="w-full max-w-[84px] py-0.5 px-2 rounded-full text-[10px] font-bold text-center bg-blue-50 text-blue-700 border border-blue-200 truncate inline-block">
        In Progress
      </span>
    );
  }
  return (
    <span className="w-full max-w-[84px] py-0.5 px-2 rounded-full text-[10px] font-bold text-center bg-slate-50 text-slate-500 border border-slate-200 truncate inline-block">
      Pending
    </span>
  );
}

function getStageSummary(stage, pipelineSummary) {
  const seq = stage.sequence;
  const q = stage.quantities || {};
  const isNotReq = stage.status === 'Not Required';
  const doc = stage.document;

  if (isNotReq) {
    return {
      line1: 'Qty: —',
      line2: 'Not Required',
    };
  }

  if (seq === 1) {
    const alloc = q.reserved || pipelineSummary?.allocated_meters || 0;
    const cust = pipelineSummary?.customer_meters;
    const own = pipelineSummary?.own_meters;
    const line2 =
      cust !== undefined && own !== undefined && (cust > 0 || own > 0)
        ? `(${Number(cust).toLocaleString('en-IN')} cust + ${Number(own).toLocaleString('en-IN')} own)`
        : alloc > 0
        ? 'Stock Allocated'
        : 'Stock Check Pending';
    return {
      line1: alloc > 0 ? `Allocated: ${Number(alloc).toLocaleString('en-IN')} m` : 'Allocated: —',
      line2,
    };
  }
  if (seq === 1) {
    const alloc = q.reserved || pipelineSummary?.allocated_meters || 0;
    const cust = pipelineSummary?.customer_meters;
    const own = pipelineSummary?.own_meters;
    const line2 =
      cust !== undefined && own !== undefined && (cust > 0 || own > 0)
        ? `(${Number(cust).toLocaleString('en-IN')} cust + ${Number(own).toLocaleString('en-IN')} own)`
        : alloc > 0
        ? 'Stock Allocated'
        : 'Stock Check Pending';
    return {
      line1: alloc > 0 ? `Allocated: ${Number(alloc).toLocaleString('en-IN')} m` : 'Allocated: —',
      line2,
    };
  }
  if (seq === 2) {
    const shortage = q.input || pipelineSummary?.shortage_meters || 0;
    const good = q.good || 0;
    return {
      line1: shortage > 0 ? `Shortage: ${Number(shortage).toLocaleString('en-IN')} m` : 'PO: —',
      line2: doc?.number ? `PO ${doc.number}` : (good > 0 ? `Received: ${Number(good).toLocaleString('en-IN')} m` : 'Procurement Pending'),
    };
  }
  if (seq === 3) {
    const planned = q.produced || q.input || pipelineSummary?.required_meters || 0;
    return {
      line1: planned > 0 ? `Planned: ${Number(planned).toLocaleString('en-IN')} m` : 'Plan: —',
      line2: doc?.number ? `Plan: ${doc.number}` : (doc?.label || 'Vendor Assignment'),
    };
  }
  if (seq === 4) {
    const sent = q.produced || q.input || pipelineSummary?.dyeing_sent_meters || 0;
    return {
      line1: sent > 0 ? `Sent: ${Number(sent).toLocaleString('en-IN')} m` : 'Outward: —',
      line2: doc?.number ? `Challan ${doc.number}` : 'Job Work Outward',
    };
  }
  if (seq === 5) {
    const atVendor = q.input || pipelineSummary?.dyeing_sent_meters || 0;
    const processed = q.produced || pipelineSummary?.customer_project_received_meters || 0;
    return {
      line1: atVendor > 0 ? `At Vendor: ${Number(atVendor).toLocaleString('en-IN')} m` : 'At Vendor: —',
      line2: processed > 0 ? `Processed: ${Number(processed).toLocaleString('en-IN')} m` : 'Processing Pending',
    };
  }
  if (seq === 6) {
    const rec = q.good || pipelineSummary?.customer_project_received_meters || 0;
    const req = pipelineSummary?.required_meters || q.input || 0;
    const pending = Math.max(0, req - rec);
    return {
      line1: rec > 0 ? `Received: ${Number(rec).toLocaleString('en-IN')} m` : 'Received: —',
      line2: req > 0 ? `Pending: ${Number(pending).toLocaleString('en-IN')} m` : 'Inward Pending',
    };
  }
  if (seq === 7) {
    const qcPass = q.accepted || 0;
    const totalRec = pipelineSummary?.customer_project_received_meters || q.good || 0;
    const pendingQC = Math.max(0, totalRec - qcPass);
    return {
      line1: qcPass > 0 ? `QC Pass: ${Number(qcPass).toLocaleString('en-IN')} m` : 'QC Pass: —',
      line2: totalRec > 0 ? `Pending QC: ${Number(pendingQC).toLocaleString('en-IN')} m` : 'Inspection Pending',
    };
  }
  if (seq === 8) {
    const disp = q.dispatched || 0;
    const cust = pipelineSummary?.customer_meters || pipelineSummary?.required_meters || 0;
    return {
      line1: disp > 0 ? `Dispatched: ${Number(disp).toLocaleString('en-IN')} m` : 'Dispatch: —',
      line2: cust > 0 ? `Customer: ${Number(cust).toLocaleString('en-IN')} m` : 'Dispatch Pending',
    };
  }
  if (seq === 9) {
    const invAmt = q.invoicedAmount || 0;
    const paidAmt = q.paidAmount || 0;
    return {
      line1: invAmt > 0 ? `Invoiced: ₹${Number(invAmt).toLocaleString('en-IN')}` : 'Invoiced: —',
      line2: paidAmt > 0 ? `Paid: ₹${Number(paidAmt).toLocaleString('en-IN')}` : 'Payment Pending',
    };
  }
  if (seq === 10) {
    const isDone = stage.status === 'Completed';
    return {
      line1: isDone ? 'Project Closed' : 'Closure: Pending',
      line2: isDone ? 'All Requirements Met' : 'Pending Verification',
    };
  }

  return {
    line1: `Weight: ${weightOf(stage)}%`,
    line2: stage.department || '—',
  };
}

export const PURCHASE_PO_STAGES = [
  { name: 'Create Grey Purchase PO', department: 'Purchase', branch: 'branch_purchase', weight: 5, icon: 'FileText' },
  { name: 'Supplier Delivery', department: 'Purchase', branch: 'branch_purchase', weight: 5, icon: 'Truck' },
  { name: 'GRN / Inward', department: 'Inventory', branch: 'branch_purchase', weight: 5, icon: 'Boxes' },
  { name: 'Lot & Taka Creation', department: 'Inventory', branch: 'branch_purchase', weight: 5, icon: 'Layers' },
  { name: 'Grey QC', department: 'QC', branch: 'branch_purchase', weight: 5, icon: 'ShieldCheck' },
  { name: 'Grey Stock Updated', department: 'Inventory', branch: 'branch_purchase', weight: 5, icon: 'Boxes' },
];

export const VENDOR_PRODUCTION_STAGES = [
  { name: 'Production Work Instruction', department: 'Production', branch: 'branch_production', weight: 3.33, icon: 'FileText' },
  { name: 'Assign Vendor A + Employee', department: 'Production', branch: 'branch_production', weight: 3.33, icon: 'ClipboardList' },
  { name: 'Daily Production Entry', department: 'Production', branch: 'branch_production', weight: 3.33, icon: 'FileSpreadsheet' },
  { name: 'Production Completion', department: 'Production', branch: 'branch_production', weight: 3.33, icon: 'CheckCircle2' },
  { name: 'Final Quantity Verification', department: 'QC', branch: 'branch_production', weight: 3.33, icon: 'ShieldCheck' },
  { name: 'Generate Final Job Work PO', department: 'Production', branch: 'branch_production', weight: 3.33, icon: 'FileText' },
  { name: 'Production / Job Work PO', department: 'Accounts', branch: 'branch_production', weight: 3.33, icon: 'FileText' },
  { name: 'Agency Bill Match (PO + verified qty + invoice)', department: 'Accounts', branch: 'branch_production', weight: 3.33, icon: 'FileSpreadsheet' },
  { name: 'Approval / Hold / Payment', department: 'Accounts', branch: 'branch_production', weight: 3.36, icon: 'IndianRupee' },
];

export const DOWNSTREAM_STAGES = [
  { name: 'Processing Plan & Vendor Assignment', department: 'Job Work', branch: 'common', weight: 10, icon: 'ClipboardList' },
  { name: 'Job Work Outward (Send to Vendor)', department: 'Job Work', branch: 'common', weight: 10, icon: 'Truck' },
  { name: 'Processing (Dyeing)', department: 'Job Work', branch: 'common', weight: 10, icon: 'Cog' },
  { name: 'Job Work Inward (Receive)', department: 'Job Work', branch: 'common', weight: 10, icon: 'ArrowDownToLine' },
  { name: 'Quality Check & Stock Allocation', department: 'QC', branch: 'common', weight: 10, icon: 'ShieldCheck' },
  { name: 'Customer Dispatch', department: 'Dispatch', branch: 'common', weight: 10, icon: 'Boxes' },
  { name: 'Invoice & Payment Collection', department: 'Accounts', branch: 'common', weight: 10, icon: 'IndianRupee' },
  { name: 'Project Closure', department: 'Management', branch: 'common', weight: 10, icon: 'CheckCircle2' },
];

export const STAGE_1_DEF = {
  name: 'Grey Stock Check & Allocation',
  department: 'Inventory',
  branch: 'common',
  weight: 10,
  icon: 'Boxes',
};

export const STATIC_PIPELINE_STAGES = [
  STAGE_1_DEF,
  { name: 'Procurement (If Required)', department: 'Purchase', branch: 'branch_b', weight: 10, icon: 'ShoppingCart' },
  ...DOWNSTREAM_STAGES,
].map((s, idx) => ({ ...s, sequence: idx + 1 }));

export function buildStaticPipelineStages(project) {
  if (!project) return [];
  const existingStages = project.stages || [];
  const cfv = project.customFieldValues || project.custom_field_values || {};
  const shortageAction =
    project.shortageAction ||
    cfv.shortage_action ||
    cfv.shortageAction ||
    project.pipelineSummary?.shortage_action ||
    project.pipelineSummary?.shortageAction;

  const shortageMeters = Number(
    project.shortageMeters ??
    project.pipelineSummary?.shortage_meters ??
    (project.requirementMeters && project.allocatedMeters ? project.requirementMeters - project.allocatedMeters : 0)
  );

  let rawList;
  if (shortageMeters <= 0 && !shortageAction) {
    rawList = [STAGE_1_DEF, ...DOWNSTREAM_STAGES];
  } else if (shortageAction === 'PURCHASE_PO') {
    rawList = [STAGE_1_DEF, ...PURCHASE_PO_STAGES, ...DOWNSTREAM_STAGES];
  } else if (shortageAction === 'PRODUCTION_ORDER') {
    rawList = [STAGE_1_DEF, ...VENDOR_PRODUCTION_STAGES, ...DOWNSTREAM_STAGES];
  } else {
    rawList = [STAGE_1_DEF, ...PURCHASE_PO_STAGES, ...DOWNSTREAM_STAGES];
  }

  const defsWithSeq = rawList.map((item, idx) => ({
    ...item,
    sequence: idx + 1,
  }));

  const baseStages = defsWithSeq.map((def) => {
    const existing = existingStages.find((s) => {
      if (!s) return false;
      const nm = (s.name || '').trim().toLowerCase();
      if (nm === 'dyeing' || nm === 'vbvb' || nm.includes('customer requirement')) return false;
      return nm === def.name.trim().toLowerCase();
    });

    let status = 'Pending';
    let completionPct = 0;

    if (existing && existing.status) {
      status = existing.status;
      completionPct = Number(existing.completionPct ?? (existing.status === 'Completed' ? 100 : 0));
    }

    const weight = existing ? (existing.percentage ?? existing.weightPct ?? def.weight) : def.weight;

    return {
      id: existing?.id || `static-stage-${def.sequence}`,
      sequence: def.sequence,
      name: def.name,
      department: existing?.department || def.department,
      branch: def.branch,
      isRequired: status !== 'Not Required',
      percentage: Number(weight),
      weightPct: Number(weight),
      weight: Number(weight),
      status,
      completionPct,
      startDateTime: existing?.startDateTime || null,
      expectedCompletionDateTime: existing?.expectedCompletionDateTime || null,
      actualStartDateTime: existing?.actualStartDateTime || null,
      actualCompletionDateTime: existing?.actualCompletionDateTime || null,
      quantities: existing?.quantities || {},
      document: existing?.document || null,
      tasks: existing?.tasks || [],
      documents: existing?.documents || [],
      approvals: existing?.approvals || [],
    };
  });

  return baseStages;
}

export function ConditionalStockBanner({ pipelineSummary }) {
  if (!pipelineSummary) return null;

  const isBranchA = pipelineSummary.route_branch === 'BRANCH_A';
  const isPartial = pipelineSummary.route_branch === 'PARTIAL';

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span
            className="text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full border"
            style={
              isBranchA
                ? { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
                : isPartial
                ? { background: '#faf5ff', color: '#7e22ce', borderColor: '#e9d5ff' }
                : { background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }
            }
          >
            {pipelineSummary.route_label || 'Conditional Grey Stock Workflow'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {isBranchA
              ? 'Required grey fabric available. Procurement stage bypassed; routed directly to Processing.'
              : isPartial
              ? 'Partial stock available. Allocated in-stock fabric; shortage routed through Procurement.'
              : 'Grey fabric in shortage. Procurement & Weaving stages active.'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
        <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-100">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Requirement</span>
          <p className="text-sm font-black text-slate-800">{Number(pipelineSummary.required_meters || 0).toLocaleString('en-IN')} M</p>
        </div>
        <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-100">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Warehouse Grey Stock</span>
          <p className="text-sm font-black text-slate-800">{Number(pipelineSummary.available_meters || 0).toLocaleString('en-IN')} M</p>
        </div>
        <div className="rounded-lg bg-emerald-50/60 p-2.5 border border-emerald-100">
          <span className="text-[10px] font-semibold text-emerald-600 uppercase">Allocated Stock</span>
          <p className="text-sm font-black text-emerald-700">{Number(pipelineSummary.allocated_meters || 0).toLocaleString('en-IN')} M</p>
        </div>
        <div
          className="rounded-lg p-2.5 border"
          style={
            Number(pipelineSummary.shortage_meters || 0) > 0
              ? { background: '#fff1f2', borderColor: '#fecdd3' }
              : { background: '#f8fafc', borderColor: '#e2e8f0' }
          }
        >
          <span className="text-[10px] font-semibold text-slate-400 uppercase">Procurement Shortage</span>
          <p
            className="text-sm font-black"
            style={{ color: Number(pipelineSummary.shortage_meters || 0) > 0 ? '#e11d48' : '#64748b' }}
          >
            {Number(pipelineSummary.shortage_meters || 0).toLocaleString('en-IN')} M
          </p>
        </div>
      </div>
    </div>
  );
}

export function StageStepper({ stages, currentStageId, selectedStageSequence = 1, onSelectStage }) {
  if (!stages || !stages.length) return null;

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs overflow-x-auto">
      <div className="min-w-max pb-1">
        <ol className="flex items-start justify-between" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {stages.map((stage, idx) => {
            const isDone = stage.status === 'Completed';
            const isNotReq = stage.status === 'Not Required';
            const isInProg = stage.status === 'In Progress';
            const isDelayed = stage.status === 'Delayed';
            const isCurrent = currentStageId && stage.id === currentStageId;
            const isSelected = selectedStageSequence === stage.sequence;

            const circleColor = isDone
              ? 'border-emerald-500 text-emerald-600 bg-white'
              : isNotReq
              ? 'border-sky-400 text-sky-600 bg-white'
              : isInProg
              ? 'border-blue-500 text-blue-600 bg-white'
              : isDelayed
              ? 'border-rose-500 text-rose-600 bg-white'
              : 'border-slate-300 text-slate-400 bg-white';

            return (
              <li key={stage.id || stage.sequence} className="flex items-start">
                <button
                  type="button"
                  onClick={() => onSelectStage && onSelectStage(stage.sequence)}
                  className={`flex flex-col items-center w-28 shrink-0 p-1.5 text-center rounded-xl transition-all cursor-pointer text-left border ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-300 shadow-xs'
                      : 'border-transparent hover:bg-slate-50/80 hover:border-slate-200'
                  }`}
                  title={`Click to view Stage ${stage.sequence}: ${stage.name}`}
                >
                  <div className="flex items-center justify-center w-full relative">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${circleColor} ${
                        isSelected ? 'ring-3 ring-blue-400 ring-offset-1 font-black shadow-xs' : isCurrent ? 'ring-2 ring-blue-300' : ''
                      }`}
                    >
                      {stage.sequence}
                    </span>
                  </div>

                  <div className={`mt-2 flex items-center justify-center h-6 ${isSelected ? 'text-blue-600' : 'text-slate-600'}`}>
                    <StageIcon name={stage.name} department={stage.department} sequence={stage.sequence} />
                  </div>

                  <p
                    className={`mt-1.5 text-[11px] leading-tight line-clamp-2 min-h-[28px] ${
                      isSelected ? 'font-black text-blue-900' : 'font-bold text-slate-800'
                    }`}
                    title={stage.name}
                  >
                    {stage.name}
                  </p>

                  <div className="mt-1.5 w-full flex justify-center">
                    <DepartmentBadge department={stage.department} />
                  </div>

                  <div className="mt-1 w-full flex justify-center">
                    <StageStatusPill status={stage.status} />
                  </div>
                </button>

                {idx < stages.length - 1 && (
                  <div className="flex items-center justify-center text-slate-300 font-light text-sm pt-3 px-1 shrink-0 select-none">
                    →
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default StageStepper;

