import CrmKpiCard from '../common/CrmKpiCard';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Users,
  DollarSign,
  Plus,
  Search,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  X,
  Info,
  User,
  FileText,
  FileCheck,
  Clock,
  CheckCircle2,
  MessageSquare,
  Trophy,
  XCircle,
  Send,
  RefreshCw,
  ShieldCheck,
  GitBranch,
  Layers
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { useCrmStore } from '../../../stores/crmStore';
import { isServerId } from '../../../services/resourceSync';

/**
 * Write a reordered / edited pipeline back. Rows the server has not seen are
 * created, changed rows are patched and removed rows are deleted, so a drag or
 * a rename is saved without the screen having to know about HTTP.
 */
function syncStages(key, next, previous) {
  const store = useCrmStore.getState();
  const before = new Map(previous.map((row) => [String(row.id), row]));
  const after = new Set(next.map((row) => String(row.id)));

  next.forEach((row, index) => {
    const withOrder = { ...row, order: index + 1 };
    const existing = before.get(String(row.id));
    if (!existing) {
      store.createRecord(key, withOrder).catch(warn);
    } else if (isServerId(row.id) && JSON.stringify({ ...existing, order: index + 1 }) !== JSON.stringify(withOrder)) {
      store.updateRecord(key, row.id, withOrder).catch(warn);
    }
  });

  previous.forEach((row) => {
    if (!after.has(String(row.id)) && isServerId(row.id)) {
      store.deleteRecord(key, row.id).catch(warn);
    }
  });
}

function warn(err) {
  console.warn('[CRM] stage not saved:', err?.message || err);
}

const BANNER_KEY = 'evenmore-crm-stages-banner-v1';

function LeadStageIcon({ icon, bg, fg }) {
  const size = 14;
  const style = { background: bg, color: fg };
  if (icon === 'file') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><FileText size={size} /></span>;
  if (icon === 'filecheck') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><FileCheck size={size} /></span>;
  if (icon === 'clock') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Clock size={size} /></span>;
  if (icon === 'check') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><CheckCircle2 size={size} /></span>;
  if (icon === 'chat') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><MessageSquare size={size} /></span>;
  if (icon === 'trophy') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Trophy size={size} /></span>;
  if (icon === 'lost') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><XCircle size={size} /></span>;
  if (icon === 'future') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Clock size={size} /></span>;
  return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><User size={size} /></span>;
}

function DealStageIcon({ icon, bg, fg }) {
  const size = 14;
  const style = { background: bg, color: fg };
  if (icon === 'send') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Send size={size} /></span>;
  if (icon === 'clock') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Clock size={size} /></span>;
  if (icon === 'refresh') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><RefreshCw size={size} /></span>;
  if (icon === 'lost') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><X size={size} /></span>;
  return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><FileText size={size} /></span>;
}

function StatusPill({ status, onToggle }) {
  const active = status === 'Active';
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Click to toggle status"
      className={active
        ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100'
        : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200'}
    >
      <span className={active ? 'w-1.5 h-1.5 rounded-full bg-green-600' : 'w-1.5 h-1.5 rounded-full bg-slate-400'} />
      {status}
    </button>
  );
}

export default function CRMSystemSetupPage() {
  // The two pipelines are server configuration (`/crm/stages/`, `/crm/deal-stages/`),
  // because the automation that creates stage tasks runs against them.
  const storeLeadStages = useCrmStore((s) => s.stages);
  const storeDealStages = useCrmStore((s) => s.dealStages);
  const [leadStages, setLeadStages] = useState([]);
  const [dealStages, setDealStages] = useState([]);

  useEffect(() => { setLeadStages(storeLeadStages); }, [storeLeadStages]);
  useEffect(() => { setDealStages(storeDealStages); }, [storeDealStages]);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadFilter, setLeadFilter] = useState('All');
  const [dealQuery, setDealQuery] = useState('');
  const [dealFilter, setDealFilter] = useState('All');
  const [showBanner, setShowBanner] = useState(() => {
    try {
      if (typeof localStorage === 'undefined') return true;
      return localStorage.getItem(BANNER_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  const [leadModal, setLeadModal] = useState(null);
  const [dealModal, setDealModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [showDifferenceModal, setShowDifferenceModal] = useState(false);
  const [dragLead, setDragLead] = useState(null);
  const [dragDeal, setDragDeal] = useState(null);

  const leadSyncedRef = useRef('');
  const dealSyncedRef = useRef('');

  // Edits are written back to the pipelines they came from.
  useEffect(() => {
    if (leadStages.length === 0) return;
    const key = JSON.stringify(leadStages);
    if (key === leadSyncedRef.current) return;
    leadSyncedRef.current = key;
    syncStages('stages', leadStages, storeLeadStages);
  }, [leadStages, storeLeadStages]);

  useEffect(() => {
    if (dealStages.length === 0) return;
    const key = JSON.stringify(dealStages);
    if (key === dealSyncedRef.current) return;
    dealSyncedRef.current = key;
    syncStages('dealStages', dealStages, storeDealStages);
  }, [dealStages, storeDealStages]);

  const leadActive = useMemo(() => leadStages.filter((s) => s.status === 'Active').length, [leadStages]);
  const leadInactive = leadStages.length - leadActive;
  const dealActive = useMemo(() => dealStages.filter((s) => s.status === 'Active').length, [dealStages]);
  const dealInactive = dealStages.length - dealActive;

  const visibleLeads = useMemo(() => {
    return leadStages.filter((s) => {
      if (leadFilter !== 'All' && s.status !== leadFilter) return false;
      if (leadQuery && !String(s.name ?? '').toLowerCase().includes(leadQuery.toLowerCase())) return false;
      return true;
    });
  }, [leadStages, leadQuery, leadFilter]);

  const visibleDeals = useMemo(() => {
    return dealStages.filter((s) => {
      if (dealFilter !== 'All' && s.status !== dealFilter) return false;
      if (dealQuery && !String(s.name ?? '').toLowerCase().includes(dealQuery.toLowerCase())) return false;
      return true;
    });
  }, [dealStages, dealQuery, dealFilter]);

  function hideBanner() {
    setShowBanner(false);
    try {
      localStorage.setItem(BANNER_KEY, 'hidden');
    } catch {
      return;
    }
  }

  function openAddLead() {
    setLeadModal({ id: null, name: '', status: 'Active' });
  }

  function openEditLead(stage) {
    setLeadModal({ id: stage.id, name: stage.name, status: stage.status });
  }

  function saveLeadModal() {
    const name = leadModal.name.trim();
    if (!name) return;
    if (leadModal.id) {
      setLeadStages((prev) => prev.map((s) => (s.id === leadModal.id ? { ...s, name, status: leadModal.status } : s)));
    } else {
      const item = { id: `ld-${Date.now()}`, name, status: leadModal.status, count: 0, icon: 'user', bg: '#e8f1ff', fg: '#2563eb' };
      setLeadStages((prev) => [...prev, item]);
    }
    setLeadModal(null);
  }

  function duplicateLead(id) {
    const found = leadStages.find((s) => s.id === id);
    if (!found) return;
    setLeadStages((prev) => [...prev, { ...found, id: `ld-${Date.now()}`, name: `${found.name} Copy`, count: 0 }]);
  }

  function openAddDeal() {
    setDealModal({ id: null, name: '', status: 'Active', pipeline: 'Sales' });
  }

  function openEditDeal(stage) {
    setDealModal({ id: stage.id, name: stage.name, status: stage.status, pipeline: stage.pipeline || 'Sales' });
  }

  function saveDealModal() {
    const name = dealModal.name.trim();
    if (!name) return;
    const pipeline = dealModal.pipeline.trim() || 'Sales';
    if (dealModal.id) {
      setDealStages((prev) => prev.map((s) => (s.id === dealModal.id ? { ...s, name, status: dealModal.status, pipeline } : s)));
    } else {
      const item = { id: `dl-${Date.now()}`, name, status: dealModal.status, count: 0, pipeline, icon: 'file', bg: '#eef2f7', fg: '#475569' };
      setDealStages((prev) => [...prev, item]);
    }
    setDealModal(null);
  }

  function duplicateDeal(id) {
    const found = dealStages.find((s) => s.id === id);
    if (!found) return;
    setDealStages((prev) => [...prev, { ...found, id: `dl-${Date.now()}`, name: `${found.name} Copy`, count: 0 }]);
  }

  function confirmDelete() {
    if (!deleteModal) return;
    if (deleteModal.type === 'lead') setLeadStages((prev) => prev.filter((s) => s.id !== deleteModal.id));
    if (deleteModal.type === 'deal') setDealStages((prev) => prev.filter((s) => s.id !== deleteModal.id));
    setDeleteModal(null);
  }

  function toggleLeadStatus(id) {
    setLeadStages((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' } : s)));
  }

  function toggleDealStatus(id) {
    setDealStages((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' } : s)));
  }

  function dropLead(targetIndex) {
    if (dragLead === null) return;
    setLeadStages((prev) => {
      const order = visibleLeads.map((s) => s.id);
      const fromId = order[dragLead];
      const toId = order[targetIndex];
      if (!fromId || !toId || fromId === toId) return prev;
      const fromIdx = prev.findIndex((s) => s.id === fromId);
      const toIdx = prev.findIndex((s) => s.id === toId);
      const next = [...prev];
      const moved = next.splice(fromIdx, 1)[0];
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragLead(null);
  }

  function dropDeal(targetIndex) {
    if (dragDeal === null) return;
    setDealStages((prev) => {
      const order = visibleDeals.map((s) => s.id);
      const fromId = order[dragDeal];
      const toId = order[targetIndex];
      if (!fromId || !toId || fromId === toId) return prev;
      const fromIdx = prev.findIndex((s) => s.id === fromId);
      const toIdx = prev.findIndex((s) => s.id === toId);
      const next = [...prev];
      const moved = next.splice(fromIdx, 1)[0];
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragDeal(null);
  }

  function scrollToPanel(id) {
    try {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      return;
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CRM System Setup"
        subtitle="Manage both Lead Stages and Deal Stages for your business process."
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'CRM', path: '/crm/leads' },
          { label: 'CRM System Setup' }
        ]}
      />

      {showBanner && (
        <div className="bg-[#eef6ff] border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-white border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Info size={15} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-blue-900">Understand the Difference</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Lead Stages are used to track and nurture potential leads. Deal Stages are used to track confirmed deals in the sales pipeline.</p>
            <button type="button" onClick={() => setShowDifferenceModal(true)} className="text-xs font-semibold text-blue-600 mt-1 hover:underline">Learn More</button>
          </div>
          <button type="button" onClick={hideBanner} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div id="lead-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Users size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] text-slate-800 leading-tight">Lead Stages</h3>
                <p className="text-xs text-slate-500 truncate">Manage stages for your lead follow-up process.</p>
              </div>
            </div>
            <button type="button" onClick={openAddLead} className="btn-primary shrink-0">
              <Plus size={14} /> Add Lead Stage
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 px-4">
            <CrmKpiCard label="Total Stages" value={leadStages.length} icon={Users} tone="blue" />
            <CrmKpiCard label="Active" value={leadActive} icon={ShieldCheck} tone="emerald" />
            <CrmKpiCard label="Inactive" value={leadInactive} icon={GitBranch} tone="rose" />
          </div>

          <div className="flex gap-2 px-4 mt-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Search lead stages..." className="w-full h-9 border border-slate-200 rounded-lg pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={leadFilter} onChange={(e) => setLeadFilter(e.target.value)} className="h-9 border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-600 outline-none bg-white">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-y border-slate-100">
                  <th className="py-2.5 pl-4 pr-1 font-semibold w-10"></th>
                  <th className="py-2.5 px-2 font-semibold w-8">#</th>
                  <th className="py-2.5 px-2 font-semibold">Stage Name</th>
                  <th className="py-2.5 px-2 font-semibold">Status</th>
                  <th className="py-2.5 px-2 font-semibold">Leads</th>
                  <th className="py-2.5 px-2 pr-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((s, idx) => (
                  <tr
                    key={s.id}
                    draggable
                    onDragStart={() => setDragLead(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropLead(idx)}
                    className="border-b border-slate-50 hover:bg-slate-50/70"
                  >
                    <td className="pl-4 pr-1 py-2.5 text-slate-300 cursor-grab"><GripVertical size={15} /></td>
                    <td className="px-2 py-2.5 text-slate-500 font-medium">{leadStages.findIndex((x) => x.id === s.id) + 1}</td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <LeadStageIcon icon={s.icon} bg={s.bg} fg={s.fg} />
                        {s.name}
                      </span>
                    </td>
                    <td className="px-2 py-2.5"><StatusPill status={s.status} onToggle={() => toggleLeadStatus(s.id)} /></td>
                    <td className="px-2 py-2.5 text-slate-600 font-medium">{s.count}</td>
                    <td className="px-2 pr-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <button type="button" onClick={() => openEditLead(s)} className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100" title="Edit"><Pencil size={13} /></button>
                        <button type="button" onClick={() => duplicateLead(s.id)} className="w-7 h-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200" title="Duplicate"><Copy size={13} /></button>
                        <button type="button" onClick={() => setDeleteModal({ type: 'lead', id: s.id, name: s.name })} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100" title="Delete"><Trash2 size={13} /></button>
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleLeads.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">No lead stages found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="h-3" />
        </div>

        <div id="deal-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <DollarSign size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] text-slate-800 leading-tight">Deal Stages</h3>
                <p className="text-xs text-slate-500 truncate">Manage stages for your sales pipeline process.</p>
              </div>
            </div>
            <button type="button" onClick={openAddDeal} className="btn-primary shrink-0">
              <Plus size={14} /> Add Deal Stage
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 px-4">
            <CrmKpiCard label="Total Stages" value={dealStages.length} icon={Layers} tone="blue" />
            <CrmKpiCard label="Active" value={dealActive} icon={ShieldCheck} tone="emerald" />
            <CrmKpiCard label="Inactive" value={dealInactive} icon={GitBranch} tone="rose" />
          </div>

          <div className="flex gap-2 px-4 mt-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={dealQuery} onChange={(e) => setDealQuery(e.target.value)} placeholder="Search deal stages..." className="w-full h-9 border border-slate-200 rounded-lg pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)} className="h-9 border border-slate-200 rounded-lg px-2.5 text-xs font-medium text-slate-600 outline-none bg-white">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-y border-slate-100">
                  <th className="py-2.5 pl-4 pr-1 font-semibold w-10"></th>
                  <th className="py-2.5 px-2 font-semibold w-8">#</th>
                  <th className="py-2.5 px-2 font-semibold">Stage Name</th>
                  <th className="py-2.5 px-2 font-semibold">Pipeline</th>
                  <th className="py-2.5 px-2 font-semibold">Status</th>
                  <th className="py-2.5 px-2 font-semibold">Deals</th>
                  <th className="py-2.5 px-2 pr-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeals.map((s, idx) => (
                  <tr
                    key={s.id}
                    draggable
                    onDragStart={() => setDragDeal(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropDeal(idx)}
                    className="border-b border-slate-50 hover:bg-slate-50/70"
                  >
                    <td className="pl-4 pr-1 py-2.5 text-slate-300 cursor-grab"><GripVertical size={15} /></td>
                    <td className="px-2 py-2.5 text-slate-500 font-medium">{dealStages.findIndex((x) => x.id === s.id) + 1}</td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <DealStageIcon icon={s.icon} bg={s.bg} fg={s.fg} />
                        {s.name}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-600">{s.pipeline || 'Sales'}</span>
                    </td>
                    <td className="px-2 py-2.5"><StatusPill status={s.status} onToggle={() => toggleDealStatus(s.id)} /></td>
                    <td className="px-2 py-2.5 text-slate-600 font-medium">{s.count}</td>
                    <td className="px-2 pr-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <button type="button" onClick={() => openEditDeal(s)} className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100" title="Edit"><Pencil size={13} /></button>
                        <button type="button" onClick={() => duplicateDeal(s.id)} className="w-7 h-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200" title="Duplicate"><Copy size={13} /></button>
                        <button type="button" onClick={() => setDeleteModal({ type: 'deal', id: s.id, name: s.name })} className="w-7 h-7 rounded-md bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100" title="Delete"><Trash2 size={13} /></button>
                      </span>
                    </td>
                  </tr>
                ))}
                {visibleDeals.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No deal stages found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showDifferenceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowDifferenceModal(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lead stages and deal stages difference">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Lead Stages vs Deal Stages</h2>
              <button type="button" onClick={() => setShowDifferenceModal(false)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-sm font-bold text-slate-800">Lead Stages</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Lead stages are used before a customer is confirmed. They track the journey from first contact, follow-up, qualification, demo, and negotiation until the lead is ready to convert.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Example: New Lead, Details Collected, Demo Pending, Negotiation
                </p>
              </div>

              <div className="rounded-lg border border-purple-100 bg-purple-50/60 p-4">
                <p className="text-sm font-bold text-slate-800">Deal Stages</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Deal stages are used after the opportunity becomes a real sales deal. They track quotation progress, proposal movement, revision, approval, win, or loss.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Example: Draft, Sent, Open, Revised, Won, Lost
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">Simple Difference</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Lead stages help manage possible customers. Deal stages help manage the actual business transaction after the opportunity is confirmed.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setShowDifferenceModal(false)} className="h-9 px-4 rounded-lg bg-[#1f6bff] text-white text-xs font-semibold hover:bg-blue-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {leadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setLeadModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{leadModal.id ? 'Edit Lead Stage' : 'Add Lead Stage'}</h2>
              <button type="button" onClick={() => setLeadModal(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16} /></button>
            </div>
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Stage Name *</label>
                <input value={leadModal.name} onChange={(e) => setLeadModal({ ...leadModal, name: e.target.value })} placeholder="e.g. New Lead" className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Status</label>
                <select value={leadModal.status} onChange={(e) => setLeadModal({ ...leadModal, status: e.target.value })} className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setLeadModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={saveLeadModal} className="h-9 px-4 rounded-lg bg-[#1f6bff] text-white text-xs font-semibold hover:bg-blue-700">Save Stage</button>
            </div>
          </div>
        </div>
      )}

      {dealModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setDealModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{dealModal.id ? 'Edit Deal Stage' : 'Add Deal Stage'}</h2>
              <button type="button" onClick={() => setDealModal(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16} /></button>
            </div>
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Stage Name *</label>
                <input value={dealModal.name} onChange={(e) => setDealModal({ ...dealModal, name: e.target.value })} placeholder="e.g. Proposal" className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Pipeline</label>
                  <input value={dealModal.pipeline} onChange={(e) => setDealModal({ ...dealModal, pipeline: e.target.value })} placeholder="Sales" className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Status</label>
                  <select value={dealModal.status} onChange={(e) => setDealModal({ ...dealModal, status: e.target.value })} className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none bg-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setDealModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={saveDealModal} className="h-9 px-4 rounded-lg bg-[#1f6bff] text-white text-xs font-semibold hover:bg-blue-700">Save Stage</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 border border-red-100 flex items-center justify-center"><Trash2 size={17} /></div>
            <h2 className="text-sm font-bold text-slate-800 mt-3">Delete {deleteModal.type === 'lead' ? 'Lead' : 'Deal'} Stage?</h2>
            <p className="text-xs text-slate-500 mt-1">Are you sure you want to delete <strong className="text-slate-700">{deleteModal.name}</strong>? This action is permanent.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setDeleteModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={confirmDelete} className="h-9 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

