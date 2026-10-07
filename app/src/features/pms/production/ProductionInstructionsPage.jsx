import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../../context/ERPContext';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Button } from '../../../components/ui/Button';
import {
  Plus, ClipboardList, X, Search, Clock, CheckCircle2, Package, Layers,
  Maximize2, Minimize2, ChevronDown, Eye, Pencil,
} from 'lucide-react';
import { toISODate } from '../../../utils/dateUtils';
import PageHeader from '../../../components/ui/PageHeader';

const STATUS_PILL = {
  'In Progress': 'bg-blue-50 text-blue-600 border-blue-200',
  Running: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Partially Completed': 'bg-amber-50 text-amber-600 border-amber-200',
  Pending: 'bg-amber-50 text-amber-600 border-amber-200',
  Draft: 'bg-amber-50 text-amber-600 border-amber-200',
  Cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
};

const PROCESS_TYPES = ['Dyeing', 'Processing', 'Printing'];
const PI_STATUSES = ['Pending', 'In Progress', 'Running', 'Partially Completed', 'Completed', 'Cancelled'];

export default function ProductionInstructionsPage() {
  const {
    productionInstructions, addProductionInstruction, updateProductionInstructionStatus,
    updateProductionInstruction, deleteProductionInstruction, purchaseOrders, formatCurrency, formatDateDDMMYYYY,
    getCurrentDateFormatted, getCurrentISODate, addDaysISO,
  } = useERP();
  const navigate = useNavigate();

  const [showAddModal, setShowAddModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Create form state
  const [poId, setPoId] = useState('');
  const [piDate, setPiDate] = useState(() => getCurrentISODate());
  const [expectedCompletion, setExpectedCompletion] = useState(() => addDaysISO(getCurrentISODate(), 14));
  const [assignedQty, setAssignedQty] = useState('');
  const [startDate, setStartDate] = useState(() => getCurrentISODate());
  const [piStatus, setPiStatus] = useState('In Progress');
  const [processType, setProcessType] = useState('Dyeing');
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [remarks, setRemarks] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  // View / Edit state
  const [viewingPi, setViewingPi] = useState(null);
  const [editingPi, setEditingPi] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editExpected, setEditExpected] = useState('');
  const [editStatus, setEditStatus] = useState('In Progress');
  const [editProcessType, setEditProcessType] = useState('Dyeing');
  const [editEmployee, setEditEmployee] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const openEdit = (pi) => {
    setEditingPi(pi);
    setEditQty(String(pi.assignedQty ?? ''));
    setEditStart(toISODate(pi.startDate) || '');
    setEditExpected(toISODate(pi.expectedCompletionDate) || '');
    setEditStatus(pi.status || 'In Progress');
    setEditProcessType(pi.processType || 'Dyeing');
    setEditEmployee(pi.assignedEmployee || '');
    setEditRemarks(pi.remarks || '');
    setOpenMenuId(null);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!(Number(editQty) > 0)) { alert('Assigned Qty (Meter) is required.'); return; }
    if (!editStart) { alert('Start Date is required.'); return; }
    if (!editExpected) { alert('Expected Completion Date is required.'); return; }
    updateProductionInstruction(editingPi.id, {
      assignedQty: editQty,
      startDate: formatDateDDMMYYYY(editStart),
      expectedCompletionDate: formatDateDDMMYYYY(editExpected),
      status: editStatus,
      processType: editProcessType,
      assignedEmployee: editEmployee,
      remarks: editRemarks,
    });
    setEditingPi(null);
  };

  const selectedPo = useMemo(() => purchaseOrders.find((p) => p.id === poId) || null, [purchaseOrders, poId]);
  const poLines = (po) => po?.items || po?.lineItems || [];
  const poQty = (po) => poLines(po).reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const poFabric = (po) => poLines(po)[0]?.name || '—';

  const getProduced = (pi) => (pi.status === 'Completed' ? pi.assignedQty : Number(pi.producedQty) || 0);
  const getBalance = (pi) => Math.max(0, (Number(pi.assignedQty) || 0) - getProduced(pi));

  const totalInstructions = productionInstructions.length;
  const inProgressCount = productionInstructions.filter((p) => p.status === 'In Progress').length;
  const completedCount = productionInstructions.filter((p) => p.status === 'Completed').length;
  const pendingCount = productionInstructions.filter((p) => p.status === 'Pending' || p.status === 'Draft').length;

  const vendors = useMemo(() => [...new Set(productionInstructions.map((p) => p.vendor).filter(Boolean))], [productionInstructions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productionInstructions.filter((p) => {
      if (q && !`${p.piNumber} ${p.poNumber} ${p.vendor} ${p.fabric}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (vendorFilter !== 'All' && p.vendor !== vendorFilter) return false;
      if (dateFrom || dateTo) {
        const parts = String(p.date || '').split('-');
        const iso = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : null;
        if (iso && dateFrom && iso < dateFrom) return false;
        if (iso && dateTo && iso > dateTo) return false;
      }
      return true;
    });
  }, [productionInstructions, query, statusFilter, vendorFilter, dateFrom, dateTo]);

  const handleSelectPo = (id) => {
    setPoId(id);
    const po = purchaseOrders.find((p) => p.id === id);
    if (po) setAssignedQty(String(poQty(po) || ''));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!poId) { alert('Purchase Order is required.'); return; }
    if (!piDate) { alert('Date is required.'); return; }
    if (!expectedCompletion) { alert('Expected Completion Date is required.'); return; }
    if (!startDate) { alert('Start Date is required.'); return; }
    if (!(Number(assignedQty) > 0)) { alert('Assigned Qty (Meter) is required.'); return; }
    addProductionInstruction({
      poId: selectedPo.id,
      poNumber: selectedPo.poNumber,
      vendorId: selectedPo.vendorId,
      vendor: selectedPo.vendor,
      fabric: poFabric(selectedPo),
      fabricSku: poLines(selectedPo)[0]?.sku || '',
      processType,
      assignedEmployee,
      assignedQty,
      date: formatDateDDMMYYYY(piDate),
      startDate: formatDateDDMMYYYY(startDate),
      expectedCompletionDate: formatDateDDMMYYYY(expectedCompletion),
      status: piStatus,
      remarks,
    });
    setPoId(''); setPiDate(getCurrentISODate());
    setExpectedCompletion(addDaysISO(getCurrentISODate(), 14));
    setAssignedQty(''); setStartDate(getCurrentISODate()); setPiStatus('In Progress');
    setProcessType('Dyeing'); setAssignedEmployee(''); setRemarks('');
    setShowAddModal(false); setIsFullscreen(false);
  };


  return (
    <div className="-m-3 md:-m-5 bg-[#edf3fc] p-3 md:p-5 space-y-4 min-h-[calc(100vh-62px)]">
      <PageHeader
        title="Production Instructions"
        subtitle="Create and manage production instructions for external agencies."
        actions={
          <Button icon={Plus} onClick={() => { setShowAddModal(true); setIsFullscreen(false); }} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
            Create Production Instruction
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ClipboardList, value: totalInstructions, label: 'Total Instructions', bg: '#e8f1fd', c: '#2563eb' },
          { icon: Clock, value: inProgressCount, label: 'In Progress', bg: '#fdf3e0', c: '#d97706' },
          { icon: CheckCircle2, value: completedCount, label: 'Completed', bg: '#e6f7ef', c: '#059669' },
          { icon: Layers, value: pendingCount, label: 'Pending', bg: '#f3e8ff', c: '#7c3aed' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: k.bg, color: k.c }}><k.icon size={19} /></span>
              <div>
                <p className="text-[15px] font-extrabold tracking-tight text-[#17294e]">{k.value}</p>
                <p className="text-[11px] font-medium text-slate-500">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3.5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PI No., vendor, fabric..." className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-blue-400" />
          </div>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
            <option value="All">All Agencies</option>
            {vendors.map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
            <option value="All">All Status</option>
            {PI_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-2">
            <span className="text-[12px] text-slate-400">Start Date</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-[12px] text-slate-600 outline-none" title="Start date from" />
          </div>
          <span className="text-slate-400 text-[11px]">to</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-2">
            <span className="text-[12px] text-slate-400">End Date</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-[12px] text-slate-600 outline-none" title="End date to" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['PI No.', 'PI Date', 'Agency/Vendor', 'Fabric', 'Process Type', 'Order Qty (M)', 'Produced Qty (M)', 'Balance Qty (M)', 'Start Date', 'Expected Completion', 'Assigned Employee', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${i >= 5 && i <= 7 ? 'text-right' : ''} ${i === 11 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pi, idx) => (
                <tr key={pi.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button onClick={() => navigate(`/pms/production-completion?pi=${encodeURIComponent(pi.id)}`)} className="font-mono font-bold text-blue-600 hover:underline" title="Open Production Completion & Verification">{pi.piNumber}</button>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.date}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">{pi.vendor}</td>
                  <td className="px-3 py-2.5 text-slate-600 font-medium whitespace-nowrap">{pi.fabric}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap">{pi.processType || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">{Number(pi.assignedQty).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">{getProduced(pi).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">{getBalance(pi).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.startDate}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.expectedCompletionDate}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{pi.assignedEmployee || '—'}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${STATUS_PILL[pi.status] || STATUS_PILL.Draft}`}>{pi.status}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <button onClick={() => setViewingPi(pi)} className="p-2 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(pi)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === pi.id ? null : pi.id)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors" title="More actions">
                          <span className="text-[14px] font-bold leading-none tracking-widest">...</span>
                        </button>
                        {openMenuId === pi.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                              <button onClick={() => { setOpenMenuId(null); setViewingPi(pi); }} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">View details</button>
                              <button onClick={() => openEdit(pi)} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                              <button onClick={() => { setOpenMenuId(null); navigate(`/pms/production-completion?pi=${encodeURIComponent(pi.id)}`); }} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">Open completion</button>
                              <button onClick={() => { setOpenMenuId(null); deleteProductionInstruction(pi.id); }} className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500"><ClipboardList size={20} /></div>
                    <p className="mt-3 text-[13px] font-extrabold text-[#17294e]">No records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">Create a production instruction from a Purchase Order.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${isFullscreen ? 'w-full h-full rounded-none p-4 sm:p-8' : 'max-w-3xl w-full rounded-2xl p-4 sm:p-6 max-h-[95vh] sm:max-h-[92vh]'} text-xs`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#1F2E4A]">Create Production Instruction</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Create a new production instruction from a Purchase Order.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition" title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}>
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button type="button" onClick={() => { setShowAddModal(false); setIsFullscreen(false); }} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <h4 className="flex items-center gap-2 text-[13px] font-extrabold text-[#17294e]"><ClipboardList size={15} className="text-blue-500" /> Basic Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">PI Number</label>
                    <input type="text" readOnly value="Auto-Generate" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium cursor-not-allowed" />
                    <p className="text-[10px] text-slate-400 mt-1">PI number will be generated automatically on save.</p>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date *</label>
                    <input type="date" required value={piDate} onChange={(e) => setPiDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Expected Completion Date *</label>
                    <input type="date" required value={expectedCompletion} onChange={(e) => setExpectedCompletion(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Order *</label>
                  <select required value={poId} onChange={(e) => handleSelectPo(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">Select Purchase Order...</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.poNumber} ({formatDateDDMMYYYY(po.date)}) - {po.vendor} - {poQty(po).toLocaleString('en-IN')} M</option>
                    ))}
                  </select>
                  {selectedPo && (
                    <div className="mt-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>Vendor: {selectedPo.vendor}</span>
                        <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">PO Value: {formatCurrency(selectedPo.amount ?? selectedPo.total ?? 0)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                        <span>PO Date: <strong>{formatDateDDMMYYYY(selectedPo.date)}</strong></span>
                        <span>Expected: <strong>{formatDateDDMMYYYY(selectedPo.expectedDate)}</strong></span>
                        <span>Status: <strong>{selectedPo.status}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-4">
                <h4 className="flex items-center gap-2 text-[13px] font-extrabold text-[#17294e]"><Package size={15} className="text-blue-500" /> Production Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fabric</label>
                    <input type="text" readOnly value={selectedPo ? poFabric(selectedPo) : ''} placeholder="Select a Purchase Order first" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Qty (Meter) *</label>
                    <input type="number" min="0" required value={assignedQty} onChange={(e) => setAssignedQty(e.target.value)} placeholder="40000" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Process Type *</label>
                    <select required value={processType} onChange={(e) => setProcessType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                      {PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Employee</label>
                    <input type="text" value={assignedEmployee} onChange={(e) => setAssignedEmployee(e.target.value)} placeholder="e.g. Rahul" maxLength={100} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">UOM</label>
                    <input type="text" readOnly value="Meter" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
                    <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status *</label>
                    <select value={piStatus} onChange={(e) => setPiStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                      {['Pending', 'In Progress', 'Completed'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remark (Optional)</label>
                    <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Special instructions, production notes, etc." maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => { setShowAddModal(false); setIsFullscreen(false); }} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm">Save Production Instruction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingPi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" onClick={() => setViewingPi(null)}>
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 sm:p-6 max-w-lg w-full text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Production Instruction Details</h3>
              <button type="button" onClick={() => setViewingPi(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['PI Number', viewingPi.piNumber],
                ['PO Number', viewingPi.poNumber],
                ['Date', viewingPi.date],
                ['Vendor', viewingPi.vendor],
                ['Fabric', viewingPi.fabric],
                ['Process Type', viewingPi.processType || '—'],
                ['Assigned Employee', viewingPi.assignedEmployee || '—'],
                ['Assigned Qty (M)', Number(viewingPi.assignedQty).toLocaleString('en-IN')],
                ['Produced (M)', getProduced(viewingPi).toLocaleString('en-IN')],
                ['Balance (M)', getBalance(viewingPi).toLocaleString('en-IN')],
                ['Start Date', viewingPi.startDate],
                ['Expected Completion', viewingPi.expectedCompletionDate],
                ['Status', viewingPi.status],
                ['Remarks', viewingPi.remarks || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-0.5 text-[12px] font-semibold text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
              <button type="button" onClick={() => setViewingPi(null)} className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {editingPi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" onClick={() => setEditingPi(null)}>
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 sm:p-6 max-w-lg w-full text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#1F2E4A]">Edit Production Instruction</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{editingPi.piNumber} · {editingPi.poNumber} · {editingPi.vendor}</p>
              </div>
              <button type="button" onClick={() => setEditingPi(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Qty (Meter) *</label>
                  <input type="number" min="0" required value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status *</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    {PI_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Process Type</label>
                  <select value={editProcessType} onChange={(e) => setEditProcessType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    {PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Employee</label>
                  <input type="text" value={editEmployee} onChange={(e) => setEditEmployee(e.target.value)} placeholder="e.g. Rahul" maxLength={100} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input type="date" required value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Completion Date *</label>
                  <input type="date" required value={editExpected} onChange={(e) => setEditExpected(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Remark (Optional)</label>
                  <input type="text" value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingPi(null)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
