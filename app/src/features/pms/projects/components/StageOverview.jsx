import React from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Boxes, Droplets, Cog, ShieldCheck, Layers, Play,
  Send, ArrowRightLeft, ClipboardList, Truck, Receipt, Trophy, CircleDot,
  ArrowRight, ShoppingCart, Factory, FileSpreadsheet, ExternalLink, AlertCircle,
  Sparkles, CheckCircle2, ChevronRight, Trash2, Calendar, Clock, Hourglass, XCircle,
  ArrowDownToLine, IndianRupee, FileText, Pencil, Eye, Plus
} from 'lucide-react';
import { computeStageCompletionPct } from '../../../../stores/pmsStore';
import { StageStatusBadge } from '../../components/StageStatusBadge';

/**
 * StageOverview — Enhanced Project Stage Pipeline & Stage Details Table
 * matching Oscar ERP specification with Conditional Grey Stock Workflow.
 */

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

function StageIcon({ name, department, sequence }) {
  const text = `${name ?? ''} ${department ?? ''}`.toLowerCase();
  if (sequence === 1 || text.includes('requirement') || text.includes('approval') || text.includes('order')) {
    return <ShoppingCart size={18} strokeWidth={1.8} />;
  }
  if (sequence === 2 || text.includes('check') || text.includes('allocat')) {
    return <Boxes size={18} strokeWidth={1.8} />;
  }
  if (sequence === 3 || text.includes('procurement') || text.includes('purchase')) {
    return <ShoppingCart size={18} strokeWidth={1.8} />;
  }
  if (sequence === 4 || text.includes('plan') || text.includes('assignment')) {
    return <ClipboardList size={18} strokeWidth={1.8} />;
  }
  if (sequence === 5 || text.includes('outward') || text.includes('send')) {
    return <Truck size={18} strokeWidth={1.8} />;
  }
  if (sequence === 6 || text.includes('dye') || text.includes('processing')) {
    return <Cog size={18} strokeWidth={1.8} />;
  }
  if (sequence === 7 || text.includes('inward') || text.includes('receive')) {
    return <ArrowDownToLine size={18} strokeWidth={1.8} />;
  }
  if (sequence === 8 || text.includes('quality') || text.includes('qc') || text.includes('stock')) {
    return <ShieldCheck size={18} strokeWidth={1.8} />;
  }
  if (sequence === 9 || text.includes('dispatch') || text.includes('customer')) {
    return <Boxes size={18} strokeWidth={1.8} />;
  }
  if (sequence === 10 || text.includes('invoice') || text.includes('payment')) {
    return <IndianRupee size={18} strokeWidth={1.8} />;
  }
  if (sequence === 11 || text.includes('close') || text.includes('closure')) {
    return <Trophy size={18} strokeWidth={1.8} />;
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
    <span className="w-full max-w-[84px] py-0.5 px-2 rounded-full text-[10px] font-bold text-center bg-slate-50 text-slate-400 border border-slate-200 truncate inline-block">
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
    const req = q.requirement || q.accepted || pipelineSummary?.required_meters || stage.requirementMeters || 0;
    return {
      line1: req > 0 ? `Required: ${Number(req).toLocaleString('en-IN')} m` : 'Requirement: —',
      line2: doc?.number ? `Order ${doc.number}` : (doc?.label || 'Sales Order'),
    };
  }
  if (seq === 2) {
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
  if (seq === 3) {
    const shortage = q.input || pipelineSummary?.shortage_meters || 0;
    const good = q.good || 0;
    return {
      line1: shortage > 0 ? `Shortage: ${Number(shortage).toLocaleString('en-IN')} m` : 'PO: —',
      line2: doc?.number ? `PO ${doc.number}` : (good > 0 ? `Received: ${Number(good).toLocaleString('en-IN')} m` : 'Procurement Pending'),
    };
  }
  if (seq === 4) {
    const planned = q.produced || q.input || pipelineSummary?.required_meters || 0;
    return {
      line1: planned > 0 ? `Planned: ${Number(planned).toLocaleString('en-IN')} m` : 'Plan: —',
      line2: doc?.number ? `Plan: ${doc.number}` : (doc?.label || 'Vendor Assignment'),
    };
  }
  if (seq === 5) {
    const sent = q.produced || q.input || pipelineSummary?.dyeing_sent_meters || 0;
    return {
      line1: sent > 0 ? `Sent: ${Number(sent).toLocaleString('en-IN')} m` : 'Outward: —',
      line2: doc?.number ? `Challan ${doc.number}` : 'Job Work Outward',
    };
  }
  if (seq === 6) {
    const atVendor = q.input || pipelineSummary?.dyeing_sent_meters || 0;
    const processed = q.produced || pipelineSummary?.customer_project_received_meters || 0;
    return {
      line1: atVendor > 0 ? `At Vendor: ${Number(atVendor).toLocaleString('en-IN')} m` : 'At Vendor: —',
      line2: processed > 0 ? `Processed: ${Number(processed).toLocaleString('en-IN')} m` : 'Processing Pending',
    };
  }
  if (seq === 7) {
    const rec = q.good || pipelineSummary?.customer_project_received_meters || 0;
    const req = pipelineSummary?.required_meters || q.input || 0;
    const pending = Math.max(0, req - rec);
    return {
      line1: rec > 0 ? `Received: ${Number(rec).toLocaleString('en-IN')} m` : 'Received: —',
      line2: req > 0 ? `Pending: ${Number(pending).toLocaleString('en-IN')} m` : 'Inward Pending',
    };
  }
  if (seq === 8) {
    const qcPass = q.accepted || 0;
    const totalRec = pipelineSummary?.customer_project_received_meters || q.good || 0;
    const pendingQC = Math.max(0, totalRec - qcPass);
    return {
      line1: qcPass > 0 ? `QC Pass: ${Number(qcPass).toLocaleString('en-IN')} m` : 'QC Pass: —',
      line2: totalRec > 0 ? `Pending QC: ${Number(pendingQC).toLocaleString('en-IN')} m` : 'Inspection Pending',
    };
  }
  if (seq === 9) {
    const disp = q.dispatched || 0;
    const cust = pipelineSummary?.customer_meters || pipelineSummary?.required_meters || 0;
    return {
      line1: disp > 0 ? `Dispatched: ${Number(disp).toLocaleString('en-IN')} m` : 'Dispatch: —',
      line2: cust > 0 ? `Customer: ${Number(cust).toLocaleString('en-IN')} m` : 'Dispatch Pending',
    };
  }
  if (seq === 10) {
    const invAmt = q.invoicedAmount || 0;
    const paidAmt = q.paidAmount || 0;
    return {
      line1: invAmt > 0 ? `Invoiced: ₹${Number(invAmt).toLocaleString('en-IN')}` : 'Invoiced: —',
      line2: paidAmt > 0 ? `Paid: ₹${Number(paidAmt).toLocaleString('en-IN')}` : 'Payment Pending',
    };
  }
  if (seq === 11) {
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

export const STATIC_PIPELINE_STAGES = [
  { sequence: 1, name: 'Customer Requirement & Approval', department: 'Sales', branch: 'common', weight: 10, icon: 'ShoppingCart' },
  { sequence: 2, name: 'Grey Stock Check & Allocation', department: 'Inventory', branch: 'common', weight: 10, icon: 'Boxes' },
  { sequence: 3, name: 'Procurement (If Required)', department: 'Purchase', branch: 'branch_b', weight: 10, icon: 'ShoppingCart' },
  { sequence: 4, name: 'Processing Plan & Vendor Assignment', department: 'Job Work', branch: 'common', weight: 10, icon: 'ClipboardList' },
  { sequence: 5, name: 'Job Work Outward (Send to Vendor)', department: 'Job Work', branch: 'common', weight: 10, icon: 'Truck' },
  { sequence: 6, name: 'Processing (Dyeing)', department: 'Job Work', branch: 'common', weight: 15, icon: 'Cog' },
  { sequence: 7, name: 'Job Work Inward (Receive)', department: 'Job Work', branch: 'common', weight: 10, icon: 'ArrowDownToLine' },
  { sequence: 8, name: 'Quality Check & Stock Allocation', department: 'Quality Control', branch: 'common', weight: 10, icon: 'ShieldCheck' },
  { sequence: 9, name: 'Customer Dispatch', department: 'Dispatch', branch: 'common', weight: 10, icon: 'Boxes' },
  { sequence: 10, name: 'Invoice & Payment Collection', department: 'Accounts', branch: 'common', weight: 10, icon: 'IndianRupee' },
  { sequence: 11, name: 'Project Closure', department: 'Management', branch: 'common', weight: 5, icon: 'CheckCircle2' },
];

export function buildStaticPipelineStages(project) {
  if (!project) return [];
  const existingStages = project.stages || [];
  const summary = project.pipelineSummary || {};
  const isBranchA = summary.route_branch === 'BRANCH_A' || !summary.shortage_meters || Number(summary.shortage_meters) === 0;

  const baseStages = STATIC_PIPELINE_STAGES.map((def) => {
    const existing = existingStages.find((s) => {
      if (!s) return false;
      const nm = (s.name || '').trim().toLowerCase();
      if (nm === 'dyeing' || nm === 'vbvb') return false;
      return s.sequence === def.sequence || nm === def.name.trim().toLowerCase();
    });

    const isStage3Skipped = def.sequence === 3 && isBranchA;

    let status = 'Pending';
    let completionPct = 0;

    if (isStage3Skipped) {
      status = 'Not Required';
      completionPct = 0;
    } else if (existing && existing.status) {
      status = existing.status;
      completionPct = Number(existing.completionPct ?? (existing.status === 'Completed' ? 100 : 0));
    }

    const weight = isStage3Skipped ? 0 : (existing ? (existing.percentage ?? existing.weightPct ?? def.weight) : def.weight);

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

  const customStages = existingStages.filter((s) => {
    if (!s) return false;
    const nm = (s.name || '').trim().toLowerCase();
    if (nm === 'dyeing' || nm === 'vbvb') return false;
    return !STATIC_PIPELINE_STAGES.some(
      (def) => def.sequence === s.sequence || (s.name && s.name.trim().toLowerCase() === def.name.trim().toLowerCase())
    );
  });

  return [...baseStages, ...customStages].sort((a, b) => a.sequence - b.sequence);
}

/**
 * ConditionalStockBanner — diagnostic bar showing live grey stock eligibility,
 * shortage, and the active route branch (Branch A vs Branch B vs Partial).
 */
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
              ? 'Required grey fabric available. Vendor A stages (3–5) bypassed; routed directly to Vendor B.'
              : isPartial
              ? 'Partial stock available. Allocated in-stock fabric; shortage routed through Vendor A.'
              : 'Grey fabric in shortage. Vendor A Weaving & Procurement stages (3–5) active.'}
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

/**
 * StageStepper — horizontal Project Stage Pipeline with numbered stages,
 * connecting arrows, planned/actual dates, quantity summaries, status badges, and stage icons.
 * Matches OSCAR reference design.
 */
export function StageStepper({ stages, currentStageId }) {
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
            const pct = Math.round(stage.completionPct ?? computeStageCompletionPct(stage));

            const circleColor = isDone
              ? 'border-emerald-500 text-emerald-600 bg-white'
              : isNotReq
              ? 'border-sky-400 text-sky-600 bg-white'
              : isInProg
              ? stage.sequence === 5
                ? 'border-amber-500 text-amber-600 bg-white'
                : 'border-blue-500 text-blue-600 bg-white'
              : isDelayed
              ? 'border-rose-500 text-rose-600 bg-white'
              : 'border-slate-300 text-slate-400 bg-white';

            return (
              <li key={stage.id || stage.sequence} className="flex items-start">
                <div className="flex flex-col items-center w-28 shrink-0 px-1 text-center">
                  {/* Sequence Number Circle */}
                  <div className="flex items-center justify-center w-full relative">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${circleColor} ${
                        isCurrent ? 'ring-2 ring-blue-300' : ''
                      }`}
                    >
                      {stage.sequence}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="mt-2 text-slate-600 flex items-center justify-center h-6">
                    <StageIcon name={stage.name} department={stage.department} sequence={stage.sequence} />
                  </div>

                  {/* Stage Title */}
                  <p
                    className="mt-1.5 text-[11px] font-bold leading-tight text-slate-800 line-clamp-2 min-h-[28px]"
                    title={stage.name}
                  >
                    {stage.name}
                  </p>

                  {/* Percentage */}
                  <span className="mt-1 text-xs font-black text-slate-800">
                    {isNotReq ? '0%' : `${pct}%`}
                  </span>

                  {/* Planned Dates (2 lines) */}
                  <div className="mt-1 text-[10px] text-slate-500 leading-tight">
                    <div>{dateOnly(stage.startDateTime)}</div>
                    <div>{dateOnly(stage.expectedCompletionDateTime)}</div>
                  </div>

                  {/* Status Pill */}
                  <div className="mt-2 w-full flex justify-center">
                    <StageStatusPill status={stage.status} />
                  </div>
                </div>

                {/* Connecting arrow */}
                {idx < stages.length - 1 && (
                  <div className="flex items-center justify-center text-slate-300 font-light text-sm pt-1 px-1 shrink-0 select-none">
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

const QTY_COLS = [
  ['input', 'Input'],
  ['produced', 'Produced'],
  ['good', 'Good'],
  ['accepted', 'Accepted'],
  ['reserved', 'Reserved'],
  ['dispatched', 'Dispatched'],
];

/**
 * StageDetailsTable — exact table matching reference screenshot:
 * Headers: #, STAGE, WEIGHT, PLANNED DATE (START – END), ACTUAL DATE (START – END),
 * QUANTITY (M) [Input, Produced, Good, Accepted, Reserved, Dispatched],
 * STATUS, PROGRESS, REMARKS, ACTION.
 */
export function StageDetailsTable({ stages, currentStageId, actions }) {
  if (!stages || !stages.length) return null;

  const totalWeight = stages.reduce((acc, s) => acc + weightOf(s), 0);

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-xs font-bold text-slate-800">
          Stage Details <span className="font-medium text-slate-400">({stages.length} stages – {Math.round(totalWeight * 100) / 100}% total weight)</span>
        </h4>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 bg-slate-50/70">
              <th className="py-2.5 px-3 w-8">#</th>
              <th className="py-2.5 px-3 min-w-[190px]">Stage</th>
              <th className="py-2.5 px-3 text-center w-16">Weight</th>
              <th className="py-2.5 px-3 min-w-[150px]">Planned Date (Start – End)</th>
              <th className="py-2.5 px-3 min-w-[150px]">Actual Date (Start – End)</th>
              <th className="py-2.5 px-3 text-center" colSpan={QTY_COLS.length}>Quantity (M)</th>
              <th className="py-2.5 px-3 w-28">Status</th>
              <th className="py-2.5 px-3 w-28">Progress</th>
              <th className="py-2.5 px-3 min-w-[200px]">Remarks</th>
              <th className="py-2.5 px-3 text-center w-20">Action</th>
            </tr>
            <tr className="text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-white">
              <th colSpan={5} />
              {QTY_COLS.map(([key, label]) => (
                <th key={key} className="py-1 px-3 text-right font-medium text-slate-500">{label}</th>
              ))}
              <th colSpan={4} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stages.map((stage) => {
              const pct = Math.round(stage.completionPct ?? computeStageCompletionPct(stage));
              const isDone = stage.status === 'Completed';
              const isNotReq = stage.status === 'Not Required';
              const isInProg = stage.status === 'In Progress';
              const doc = stage.document;

              const plannedDateStr =
                stage.startDateTime && stage.expectedCompletionDateTime
                  ? `${dateOnly(stage.startDateTime)} – ${dateOnly(stage.expectedCompletionDateTime)}`
                  : stage.startDateTime
                  ? `${dateOnly(stage.startDateTime)} – —`
                  : '—';

              const actualDateStr =
                stage.actualStartDateTime && stage.actualCompletionDateTime
                  ? `${dateOnly(stage.actualStartDateTime)} – ${dateOnly(stage.actualCompletionDateTime)}`
                  : stage.actualStartDateTime
                  ? `${dateOnly(stage.actualStartDateTime)} – —`
                  : isDone && stage.startDateTime
                  ? `${dateOnly(stage.startDateTime)} – ${dateOnly(stage.expectedCompletionDateTime)}`
                  : '—';

              return (
                <tr
                  key={stage.id || stage.sequence}
                  className={`hover:bg-slate-50/60 ${isNotReq ? 'bg-slate-50/30 text-slate-400' : ''}`}
                >
                  <td className="py-2.5 px-3 font-semibold text-slate-600">
                    {stage.sequence}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                    <span className={isNotReq ? 'text-slate-400' : ''}>
                      {stage.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">
                    {weightOf(stage)}%
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                    {plannedDateStr}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                    {actualDateStr}
                  </td>
                  {QTY_COLS.map(([key]) => (
                    <td key={key} className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {qty(stage, key)}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} /> Completed
                      </span>
                    ) : isNotReq ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                        — Not Required
                      </span>
                    ) : isInProg ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        ● In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: isNotReq ? '#cbd5e1' : pct >= 100 ? '#10b981' : pct > 0 ? '#0284c7' : '#cbd5e1',
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-[240px] truncate" title={stage.remarks || '—'}>
                    {stage.remarks || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      {doc?.url ? (
                        <Link
                          to={doc.url}
                          className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={doc.label || 'View Document'}
                        >
                          <FileText size={14} />
                        </Link>
                      ) : (
                        <span className="p-1 text-slate-300" title="No Document">
                          <FileText size={14} />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => actions?.onStart?.(stage) || actions?.onManageTasks?.(stage)}
                        className="p-1 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                        title={`Edit ${stage.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => actions?.onHandoff?.(stage)}
                        className="p-1 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors cursor-pointer"
                        title={`View Details of ${stage.name}`}
                      >
                        <Eye size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StageDetailsTable;
