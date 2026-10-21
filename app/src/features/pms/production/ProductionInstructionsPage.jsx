import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../../context/ERPContext';
import { Button } from '../../../components/ui/Button';
import {
  Plus, ClipboardList, X, Search, Clock, CheckCircle2, Package, Layers,
  Maximize2, Minimize2, Eye, Pencil, AlertTriangle,
} from 'lucide-react';
import { toISODate } from '../../../utils/dateUtils';
import PageHeader from '../../../components/ui/PageHeader';
import TablePagination from '../../../components/ui/TablePagination';
import KpiCard from '../../../components/ui/KpiCard';
import { api } from '../../../services/api';
import {
  PRODUCTION_STATUSES, ACTIVE_STATUSES, statusPill, canApprove, canStart,
  canEditInstruction, errorText, fmtNum, listOf,
} from './productionStatus';

const PROCESS_TYPES = ['Dyeing', 'Processing', 'Printing'];
const LIST_QUERY = { page_size: 200 };

const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function normalizeInstruction(item) {
  if (!item) return item;
  return {
    ...item,
    id: String(item.id),
    piNumber: item.instructionNumber || '',
    date: item.piDate || '',
    vendor: item.agencyName || '',
    fabric: item.fabric || '',
    processType: item.processType || '',
    assignedQty: numOrNull(item.orderMeter),
    producedQty: numOrNull(item.totalProduced ?? item.cumulative),
    balance: numOrNull(item.balance),
    startDate: item.expectedStartDate || '',
    assignedEmployee: item.employeeName || '',
    employeeId: item.employeeId ? String(item.employeeId) : '',
    status: item.status || '',
    remarks: item.notes || '',
    agreedJobRate: numOrNull(item.agreedJobRate),
  };
}

export default function ProductionInstructionsPage() {
  const {
    purchaseOrders, formatCurrency, formatDateDDMMYYYY,
    getCurrentISODate,
  } = useERP();
  const navigate = useNavigate();

  const [instructions, setInstructions] = useState([]);
  const [aggregates, setAggregates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeesError, setEmployeesError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create form state
  const [poId, setPoId] = useState('');
  const [piDate, setPiDate] = useState(() => getCurrentISODate());
  const [assignedQty, setAssignedQty] = useState('');
  const [startDate, setStartDate] = useState(() => getCurrentISODate());
  const [processType, setProcessType] = useState('Dyeing');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  // View / Edit state
  const [viewingPi, setViewingPi] = useState(null);
  const [editingPi, setEditingPi] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editProcessType, setEditProcessType] = useState('');
  const [editEmployee, setEditEmployee] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editError, setEditError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      api.get('/production/instructions/', { query: LIST_QUERY }),
      api.get('/hrms/employees/', { query: LIST_QUERY }),
    ])
      .then(([piRes, empRes]) => {
        if (piRes.status === 'fulfilled') {
          setInstructions(listOf(piRes.value).map(normalizeInstruction));
          setAggregates(piRes.value && !Array.isArray(piRes.value) ? piRes.value.aggregates || null : null);
        } else {
          setInstructions([]);
          setAggregates(null);
          setError(errorText(piRes.reason, 'Failed to load production instructions'));
        }
        if (empRes.status === 'fulfilled') {
          setEmployees(listOf(empRes.value));
          setEmployeesError(null);
        } else {
          setEmployees([]);
          setEmployeesError(errorText(empRes.reason, 'Failed to load employees'));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const replaceRow = (raw) => {
    const updated = normalizeInstruction(raw);
    setInstructions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setViewingPi((v) => (v && v.id === updated.id ? updated : v));
    return updated;
  };

  const runAction = async (pi, action, label) => {
    setActionError(null);
    setBusyId(pi.id);
    setOpenMenuId(null);
    try {
      const res = await api.post(`/production/instructions/${pi.id}/${action}/`);
      replaceRow(res);
    } catch (err) {
      setActionError(`${label} failed for ${pi.piNumber}: ${errorText(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (pi) => {
    if (!canEditInstruction(pi.status)) return;
    setEditingPi(pi);
    setEditQty(pi.assignedQty === null ? '' : String(pi.assignedQty));
    setEditStart(toISODate(pi.startDate) || '');
    setEditProcessType(pi.processType || '');
    setEditEmployee(pi.employeeId || '');
    setEditRemarks(pi.remarks || '');
    setEditError(null);
    setOpenMenuId(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!(Number(editQty) > 0)) { setEditError('Assigned Qty (Meter) is required.'); return; }
    if (!editEmployee) { setEditError('Assigned Employee is required.'); return; }
    setSaving(true);
    setEditError(null);
    try {
      const payload = {
        orderMeter: Number(editQty),
        processType: editProcessType || null,
        employeeId: editEmployee,
        expectedStartDate: editStart || null,
        notes: editRemarks,
      };
      const res = await api.patch(`/production/instructions/${editingPi.id}/`, payload);
      replaceRow(res);
      setEditingPi(null);
    } catch (err) {
      setEditError(errorText(err, 'Failed to update Production Instruction'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pi) => {
    if (!window.confirm(`Delete Production Instruction ${pi.piNumber}?`)) return;
    setActionError(null);
    try {
      await api.delete(`/production/instructions/${pi.id}/`);
      setInstructions((prev) => prev.filter((p) => p.id !== pi.id));
    } catch (err) {
      setActionError(`Delete failed for ${pi.piNumber}: ${errorText(err)}`);
    }
  };

  const selectedPo = useMemo(() => purchaseOrders.find((p) => p.id === poId) || null, [purchaseOrders, poId]);
  const poLines = (po) => po?.items || po?.lineItems || [];
  const poQty = (po) => poLines(po).reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const poFabric = (po) => poLines(po)[0]?.name || '';

  // Produced / balance come from the server (totalProduced / balance), never derived from status.
  const getProduced = (pi) => pi.producedQty;
  const getBalance = (pi) => pi.balance;

  // KPI tiles prefer the server's list aggregates (covers every row, not just the loaded page).
  const countBy = (statuses) => instructions.filter((p) => statuses.includes(p.status)).length;
  const totalInstructions = aggregates?.total ?? instructions.length;
  const inProgressCount = aggregates?.inProgress ?? countBy(ACTIVE_STATUSES);
  const completedCount = aggregates?.completed ?? countBy(['Completed']);
  const verifiedCount = aggregates?.verified ?? countBy(['Verified', 'PO Pending', 'PO Created']);

  const vendors = useMemo(() => [...new Set(instructions.map((p) => p.vendor).filter(Boolean))], [instructions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructions.filter((p) => {
      if (q && !`${p.piNumber} ${p.orderReference || ''} ${p.vendor} ${p.fabric}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (vendorFilter !== 'All' && p.vendor !== vendorFilter) return false;
      if (dateFrom || dateTo) {
        const iso = toISODate(p.date);
        if (!iso) return false;
        if (dateFrom && iso < dateFrom) return false;
        if (dateTo && iso > dateTo) return false;
      }
      return true;
    });
  }, [instructions, query, statusFilter, vendorFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, vendorFilter, dateFrom, dateTo]);

  const pagedInstructions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleSelectPo = (id) => {
    setPoId(id);
    const po = purchaseOrders.find((p) => p.id === id);
    if (po) setAssignedQty(String(poQty(po) || ''));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!poId || !selectedPo) { setFormError('Purchase Order is required.'); return; }
    if (!piDate) { setFormError('Date is required.'); return; }
    if (!(Number(assignedQty) > 0)) { setFormError('Assigned Qty (Meter) is required.'); return; }
    if (!assignedEmployeeId) { setFormError('Assigned Employee is required.'); return; }

    const payload = {
      agencyName: selectedPo.vendor,
      orderReference: selectedPo.poNumber,
      orderMeter: Number(assignedQty),
      piDate,
      expectedStartDate: startDate || null,
      fabric: poFabric(selectedPo) || null,
      processType,
      employeeId: assignedEmployeeId,
      notes: remarks || '',
    };
    if (Number(selectedPo.rate) > 0) payload.agreedJobRate = Number(selectedPo.rate);

    setSaving(true);
    try {
      const res = await api.post('/production/instructions/', payload);
      const newInst = normalizeInstruction(res);
      setInstructions((prev) => [newInst, ...prev]);
      setAggregates((a) => (a && typeof a.total === 'number' ? { ...a, total: a.total + 1 } : a));
      setShowAddModal(false);
      setIsFullscreen(false);
      setPoId('');
      setAssignedQty('');
      setRemarks('');
      setAssignedEmployeeId('');
    } catch (err) {
      setFormError(errorText(err, 'Failed to create Production Instruction'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-3 md:-m-5 bg-[#edf3fc] p-3 md:p-5 space-y-4 min-h-[calc(100vh-62px)]">
      <PageHeader
        title="Production Instructions"
        subtitle="Create and manage production instructions for external agencies."
        actions={
          <Button icon={Plus} onClick={() => { setShowAddModal(true); setIsFullscreen(false); setFormError(null); }} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
            Create Production Instruction
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={loadData} className="rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">Retry</button>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-700" title="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Instructions" value={loading ? '—' : fmtNum(totalInstructions)} icon={ClipboardList} tone="blue" />
        <KpiCard label="In Progress" value={loading ? '—' : fmtNum(inProgressCount)} icon={Clock} tone="amber" />
        <KpiCard label="Completed" value={loading ? '—' : fmtNum(completedCount)} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Verified / PO" value={loading ? '—' : fmtNum(verifiedCount)} icon={Layers} tone="purple" />
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
            {PRODUCTION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-2">
            <span className="text-[12px] text-slate-400">PI Date</span>
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
                {['PI No.', 'PI Date', 'Agency/Vendor', 'Fabric', 'Process Type', 'Order Qty (M)', 'Produced Qty (M)', 'Balance Qty (M)', 'Expected Start', 'Assigned Employee', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${i >= 5 && i <= 7 ? 'text-right' : ''} ${i === 10 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedInstructions.map((pi, idx) => (
                <tr key={pi.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button onClick={() => navigate(`/pms/production-completion?pi=${encodeURIComponent(pi.id)}`)} className="font-mono font-bold text-blue-600 hover:underline" title="Open Production Completion & Verification">{pi.piNumber}</button>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.date ? formatDateDDMMYYYY(pi.date) : '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">{pi.vendor}</td>
                  <td className="px-3 py-2.5 text-slate-600 font-medium whitespace-nowrap">{pi.fabric || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap">{pi.processType || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">{fmtNum(pi.assignedQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">{fmtNum(getProduced(pi))}</td>
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${Number(getBalance(pi)) < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{fmtNum(getBalance(pi))}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{pi.startDate ? formatDateDDMMYYYY(pi.startDate) : '—'}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{pi.assignedEmployee || '—'}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(pi.status)}`}>{pi.status || '—'}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      {canApprove(pi.status) && (
                        <button type="button" disabled={busyId === pi.id} onClick={() => runAction(pi, 'approve', 'Approve')} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50" title="Approve this instruction">
                          {busyId === pi.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      {canStart(pi.status) && (
                        <button type="button" disabled={busyId === pi.id} onClick={() => runAction(pi, 'start', 'Start')} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50" title="Start production (Running)">
                          {busyId === pi.id ? 'Starting…' : 'Start'}
                        </button>
                      )}
                      <button onClick={() => setViewingPi(pi)} className="p-2 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                        <Eye size={14} />
                      </button>
                      {canEditInstruction(pi.status) && (
                        <button onClick={() => openEdit(pi)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                      )}
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === pi.id ? null : pi.id)} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors" title="More actions">
                          <span className="text-[14px] font-bold leading-none tracking-widest">...</span>
                        </button>
                        {openMenuId === pi.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                              <button onClick={() => { setOpenMenuId(null); setViewingPi(pi); }} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">View details</button>
                              {canEditInstruction(pi.status) && (
                                <button onClick={() => openEdit(pi)} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                              )}
                              {canApprove(pi.status) && (
                                <button disabled={busyId === pi.id} onClick={() => runAction(pi, 'approve', 'Approve')} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50">Approve</button>
                              )}
                              {canStart(pi.status) && (
                                <button disabled={busyId === pi.id} onClick={() => runAction(pi, 'start', 'Start')} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Start production</button>
                              )}
                              <button onClick={() => { setOpenMenuId(null); navigate(`/pms/daily-production?pi=${encodeURIComponent(pi.id)}`); }} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">Daily production</button>
                              <button onClick={() => { setOpenMenuId(null); navigate(`/pms/production-completion?pi=${encodeURIComponent(pi.id)}`); }} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">Open completion</button>
                              {pi.status === 'Draft' && (
                                <button onClick={() => { setOpenMenuId(null); handleDelete(pi); }} className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-slate-500">
                    Loading production instructions...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500"><ClipboardList size={20} /></div>
                    <p className="mt-3 text-[13px] font-extrabold text-[#17294e]">{error ? 'Could not load instructions' : 'No records found'}</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">{error ? 'See the error above and retry.' : instructions.length ? 'No instructions match the current filters.' : 'Create a production instruction from a Purchase Order.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          />
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
                    <label className="block font-semibold text-slate-700 mb-1">Expected Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                </div>
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-700">
                  New instructions are saved as <strong>Draft</strong>. Approve and start them from the list before recording daily production.
                </p>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Order *</label>
                  <select required value={poId} onChange={(e) => handleSelectPo(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">{purchaseOrders.length ? 'Select Purchase Order...' : 'No purchase orders available'}</option>
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
                    <input type="text" readOnly value={selectedPo ? poFabric(selectedPo) || '—' : ''} placeholder="Select a Purchase Order first" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Qty (Meter) *</label>
                    <input type="number" min="0" step="any" required value={assignedQty} onChange={(e) => setAssignedQty(e.target.value)} placeholder="Meters" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Process Type *</label>
                    <select required value={processType} onChange={(e) => setProcessType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                      {PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Employee *</label>
                    <select
                      required
                      value={assignedEmployeeId}
                      onChange={(e) => setAssignedEmployeeId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    >
                      <option value="">Select Employee...</option>
                      {employees.map((em) => (
                        <option key={em.id} value={em.id}>
                          {em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''} - {em.status}
                        </option>
                      ))}
                    </select>
                    {employeesError && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{employeesError}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">UOM</label>
                    <input type="text" readOnly value="Meter" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remark (Optional)</label>
                    <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Special instructions, production notes, etc." maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{formError}</span>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => { setShowAddModal(false); setIsFullscreen(false); }} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Production Instruction'}</button>
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
                ['PI Number', viewingPi.piNumber || '—'],
                ['Order Reference', viewingPi.orderReference || '—'],
                ['PI Date', viewingPi.date ? formatDateDDMMYYYY(viewingPi.date) : '—'],
                ['Vendor', viewingPi.vendor || '—'],
                ['Fabric', viewingPi.fabric || '—'],
                ['Process Type', viewingPi.processType || '—'],
                ['Assigned Employee', viewingPi.assignedEmployee || '—'],
                ['Assigned Qty (M)', fmtNum(viewingPi.assignedQty)],
                ['Produced (M)', fmtNum(getProduced(viewingPi))],
                ['Balance (M)', fmtNum(getBalance(viewingPi))],
                ['Expected Start', viewingPi.startDate ? formatDateDDMMYYYY(viewingPi.startDate) : '—'],
                ['Status', viewingPi.status || '—'],
                ['Grey Lot', viewingPi.greyLotNo || '—'],
                ['Final PO', viewingPi.finalPoNumber || '—'],
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
                <p className="text-[11px] text-slate-400 mt-0.5">{editingPi.piNumber} · {editingPi.orderReference || '—'} · {editingPi.vendor} · <span className={`inline-block rounded-md border px-1.5 text-[10px] font-bold ${statusPill(editingPi.status)}`}>{editingPi.status}</span></p>
              </div>
              <button type="button" onClick={() => setEditingPi(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Qty (Meter) *</label>
                  <input type="number" min="0" step="any" required value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Process Type</label>
                  <select value={editProcessType} onChange={(e) => setEditProcessType(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    {!editProcessType && <option value="">Select process type...</option>}
                    {editProcessType && !PROCESS_TYPES.includes(editProcessType) && <option value={editProcessType}>{editProcessType}</option>}
                    {PROCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Employee *</label>
                  <select required value={editEmployee} onChange={(e) => setEditEmployee(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">Select Employee...</option>
                    {editEmployee && !employees.some((em) => String(em.id) === editEmployee) && (
                      <option value={editEmployee}>{editingPi.assignedEmployee || 'Current employee'}</option>
                    )}
                    {employees.map((em) => (
                      <option key={em.id} value={String(em.id)}>
                        {em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''} - {em.status}
                      </option>
                    ))}
                  </select>
                  {employeesError && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{employeesError}</p>}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Start Date</label>
                  <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Remark (Optional)</label>
                  <input type="text" value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
              </div>
              <p className="text-[10.5px] text-slate-400">Status changes only through Approve / Start / Complete / Verify actions.</p>
              {editError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{editError}</span>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditingPi(null)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
