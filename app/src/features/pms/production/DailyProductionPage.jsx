import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import PageHeader from '../../../components/ui/PageHeader';
import { api } from '../../../services/api';
import { statusPill, isLockedStatus, errorText, fmtNum, listOf } from './productionStatus';

const fmt = fmtNum;
const LIST_QUERY = { page_size: 200 };
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

const toDDMMYYYY = (iso) => {
  if (!iso) return '-';
  const parts = String(iso).slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return iso;
};

function normalizeInstruction(item) {
  if (!item) return null;
  return {
    ...item,
    id: String(item.id),
    piNumber: item.instructionNumber || '',
    date: item.piDate || '',
    vendor: item.agencyName || '',
    fabric: item.fabric || '',
    processType: item.processType || '',
    assignedQty: numOrNull(item.orderMeter),
    totalProduced: numOrNull(item.totalProduced ?? item.cumulative),
    balance: numOrNull(item.balance),
    startDate: item.expectedStartDate || '',
    employeeId: item.employeeId ? String(item.employeeId) : '',
    status: item.status || '',
  };
}

function normalizeEntry(e) {
  if (!e) return null;
  return {
    id: String(e.id),
    date: e.entryDate || '',
    produced: Number(e.meters),
    by: e.employeeName || '—',
    remarks: e.remarks || '',
    employeeId: e.enteredByEmployeeId ? String(e.enteredByEmployeeId) : '',
  };
}

export default function DailyProductionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [instructions, setInstructions] = useState([]);
  const [selectedPiId, setSelectedPiId] = useState(() => searchParams.get('pi') || '');
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employeesError, setEmployeesError] = useState(null);
  const [entriesError, setEntriesError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formDate, setFormDate] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');

  // Load instructions and employees
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      api.get('/production/instructions/', { query: LIST_QUERY }),
      api.get('/hrms/employees/', { query: LIST_QUERY }),
    ])
      .then(([piRes, empRes]) => {
        if (!live) return;
        if (piRes.status === 'fulfilled') {
          const piList = listOf(piRes.value).map(normalizeInstruction).filter(Boolean);
          setInstructions(piList);
          setSelectedPiId((cur) => cur || (piList[0]?.id ?? ''));
        } else {
          setInstructions([]);
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
        if (live) setLoading(false);
      });

    return () => { live = false; };
  }, [reloadKey]);

  const pi = useMemo(
    () => instructions.find((p) => String(p.id) === String(selectedPiId)) || instructions[0] || null,
    [instructions, selectedPiId],
  );

  const piNumber = pi?.piNumber || '—';
  const vendor = pi?.vendor || '—';
  const fabric = pi?.fabric || '—';
  const assignedQty = Number(pi?.assignedQty) || 0;
  const startDate = pi?.startDate || '';
  const piDate = pi?.date || '';
  const status = pi?.status || '';
  // Server blocks daily entries on Draft and on Verified / PO Pending / PO Created / Closed.
  const isLocked = isLockedStatus(status);
  const isDraft = status === 'Draft';
  const canRecord = Boolean(pi) && !isLocked && !isDraft;

  // Re-read the instruction after an entry change: the server moves its status
  // (Approved → Running → Partially Completed / Completed) and totals.
  const refreshInstruction = async (id) => {
    try {
      const fresh = normalizeInstruction(await api.get(`/production/instructions/${id}/`));
      setInstructions((prev) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
    } catch (err) {
      setActionError(`Entry saved, but the instruction could not be refreshed: ${errorText(err)}`);
    }
  };

  // Load daily entries when selected PI changes
  useEffect(() => {
    if (!pi?.id) {
      setEntries([]);
      return;
    }
    let live = true;
    setEntriesLoading(true);
    setEntriesError(null);
    api.get('/production/daily-entries/', { query: { instructionId: pi.id, ...LIST_QUERY } })
      .then((res) => {
        if (!live) return;
        setEntries(listOf(res).map(normalizeEntry).filter(Boolean));
      })
      .catch((err) => {
        if (!live) return;
        setEntries([]);
        setEntriesError(errorText(err, 'Failed to load daily entries'));
      })
      .finally(() => {
        if (live) setEntriesLoading(false);
      });

    return () => { live = false; };
  }, [pi?.id]);

  const rows = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    let cumulative = 0;
    return sorted.map((e) => {
      cumulative += Number(e.produced) || 0;
      return { ...e, cumulative, balance: assignedQty - cumulative };
    });
  }, [entries, assignedQty]);

  // Totals come from the server (instruction.totalProduced / balance).
  const totalProduced = pi?.totalProduced ?? null;
  const balanceQty = pi?.balance ?? null;

  const openAdd = () => {
    if (!canRecord) return;
    setEditing(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormQty('');
    setFormRemarks('');
    setFormEmployeeId(pi?.employeeId || '');
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormDate(row.date ? String(row.date).slice(0, 10) : '');
    setFormQty(String(row.produced));
    setFormRemarks(row.remarks || '');
    setFormEmployeeId(row.employeeId || pi?.employeeId || '');
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!formDate) { setFormError('Date is required.'); return; }
    if (!(Number(formQty) > 0)) { setFormError('Produced quantity must be greater than 0.'); return; }
    if (!pi?.id) { setFormError('Select a Production Instruction first.'); return; }

    const empId = formEmployeeId;
    if (!editing && !empId) { setFormError('Select the employee who produced this entry.'); return; }

    setSaving(true);
    try {
      if (editing) {
        const payload = {
          entryDate: formDate,
          meters: Number(formQty),
          remarks: formRemarks,
        };
        if (empId) payload.enteredByEmployeeId = empId;
        const updated = await api.patch(`/production/daily-entries/${editing.id}/`, payload);
        const norm = normalizeEntry(updated);
        setEntries((prev) => prev.map((item) => (item.id === norm.id ? norm : item)));
      } else {
        const payload = {
          instructionId: pi.id,
          entryDate: formDate,
          meters: Number(formQty),
          enteredByEmployeeId: empId,
          remarks: formRemarks,
        };
        const created = await api.post('/production/daily-entries/', payload);
        const norm = normalizeEntry(created);
        setEntries((prev) => [...prev, norm]);
      }
      setShowModal(false);
      await refreshInstruction(pi.id);
    } catch (err) {
      setFormError(errorText(err, 'Failed to save daily entry'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    setActionError(null);
    try {
      await api.delete(`/production/daily-entries/${id}/`);
      setEntries((prev) => prev.filter((item) => item.id !== id));
      if (pi?.id) await refreshInstruction(pi.id);
    } catch (err) {
      setActionError(errorText(err, 'Failed to delete entry'));
    }
  };

  const handleQuickActivate = async () => {
    if (!pi?.id) return;
    setActivating(true);
    setActionError(null);
    try {
      if (pi.status === 'Draft') {
        await api.post(`/production/instructions/${pi.id}/approve/`);
      }
      await api.post(`/production/instructions/${pi.id}/start/`);
      await refreshInstruction(pi.id);
    } catch (err) {
      setActionError(`Could not activate instruction: ${errorText(err)}`);
    } finally {
      setActivating(false);
    }
  };

  const withUnit = (n) => (n === null || n === undefined ? '—' : `${fmt(n)} m`);

  const infoCards = [
    { label: 'PI No.', value: piNumber, extra: status ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusPill(status)}`}>{status}</span> : null },
    { label: 'Vendor', value: vendor },
    { label: 'Fabric', value: fabric },
    { label: 'Assigned Quantity', value: withUnit(pi?.assignedQty) },
    { label: 'Total Produced', value: withUnit(totalProduced), highlight: 'bg-[#eef4ff] border-[#cfe0ff]', valueClass: 'text-[#2563eb]' },
    { label: 'Balance Quantity', value: withUnit(balanceQty), highlight: 'bg-[#fff8e6] border-[#fde9b8]', valueClass: Number(balanceQty) < 0 ? 'text-rose-600' : 'text-[#17294e]' },
    { label: 'PI Date', value: toDDMMYYYY(piDate) },
    { label: 'Expected Start', value: toDDMMYYYY(startDate) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily Production Entry"
        subtitle={`Record daily production quantity received from ${vendor} against the Production Instruction.`}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS' },
          { label: 'Daily Production Entry' },
          { label: piNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {instructions.length > 0 && (
              <select
                value={pi?.id || ''}
                onChange={(e) => {
                  setSelectedPiId(e.target.value);
                  setSearchParams({ pi: e.target.value });
                  setActionError(null);
                }}
                className="rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none"
              >
                {instructions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.piNumber} - {p.vendor} ({p.status})
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => navigate('/pms/production-instructions')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Back to Instructions
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="rounded-md border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">Retry</button>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-700" title="Dismiss"><X size={14} /></button>
        </div>
      )}
      {loading && (
        <div className="rounded-xl border border-[#e2eaf5] bg-white px-4 py-8 text-center text-[12px] text-slate-500">Loading production instructions...</div>
      )}
      {!loading && !error && instructions.length === 0 && (
        <div className="rounded-xl border border-[#e2eaf5] bg-white px-4 py-10 text-center">
          <p className="text-[13px] font-extrabold text-[#17294e]">No production instructions yet</p>
          <p className="mt-1 text-[11.5px] text-slate-400">Create and approve a production instruction before recording daily production.</p>
        </div>
      )}
      {pi && isDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <span>This instruction is in Draft. Approve and start it to enable manual daily production entries.</span>
          </div>
          <button
            type="button"
            disabled={activating}
            onClick={handleQuickActivate}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {activating ? 'Activating…' : 'Approve & Start Now'}
          </button>
        </div>
      )}
      {pi && isLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-600">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>This instruction is {status}. Daily production is locked and can no longer be added, edited or deleted.</span>
        </div>
      )}

      {pi && (
      <>
      {/* Info cards */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {infoCards.map((c) => (
            <div key={c.label} className={`rounded-lg border p-3 ${c.highlight || 'border-[#e2eaf5] bg-white'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className={`text-[13px] font-extrabold ${c.valueClass || 'text-[#17294e]'}`}>{c.value}</p>
                {c.extra}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Entries table */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-[14px] font-extrabold text-[#17294e]">Daily Production Entries</h2>
          {canRecord && (
            <Button icon={Plus} onClick={openAdd} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
              Add Daily Entry
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-y border-[#eef2f9] bg-slate-50 text-slate-500">
                <th className="px-4 py-2.5 font-bold">#</th>
                <th className="px-4 py-2.5 font-bold">Date</th>
                <th className="px-4 py-2.5 font-bold">Produced (m)</th>
                <th className="px-4 py-2.5 font-bold">Cumulative (m)</th>
                <th className="px-4 py-2.5 font-bold">Balance (m)</th>
                <th className="px-4 py-2.5 font-bold">Entered By</th>
                <th className="px-4 py-2.5 font-bold">Remarks</th>
                <th className="px-4 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-[#f1f5fb] text-slate-600">
                  <td className="px-4 py-3 font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3">{toDDMMYYYY(row.date)}</td>
                  <td className="px-4 py-3">{fmt(row.produced)}</td>
                  <td className="px-4 py-3">{fmt(row.cumulative)}</td>
                  <td className={`px-4 py-3 ${row.balance < 0 ? 'text-rose-600' : ''}`}>{fmt(row.balance)}</td>
                  <td className="px-4 py-3">{row.by}</td>
                  <td className="px-4 py-3">{row.remarks || '-'}</td>
                  <td className="px-4 py-3">
                    {!canRecord ? (
                      <span className="text-slate-400">Locked</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(row)} className="text-slate-400 hover:text-[#2563eb]" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(row.id)} className="text-rose-400 hover:text-rose-600" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {entriesLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Loading daily entries...
                  </td>
                </tr>
              )}
              {!entriesLoading && entriesError && (
                <tr><td colSpan={8} className="px-4 py-8 text-center font-semibold text-rose-600">{entriesError}</td></tr>
              )}
              {!entriesLoading && !entriesError && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{canRecord ? 'No entries yet. Click "Add Daily Entry" to record production.' : 'No entries recorded.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleSave} className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-extrabold text-[#17294e]">{editing ? 'Edit Daily Entry' : 'Add Daily Entry'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">Production Instruction <span className="text-rose-500">*</span></span>
                <input
                  value={pi ? `${piNumber} (${vendor})` : ''}
                  readOnly
                  placeholder="—"
                  className="mt-1.5 w-full rounded-lg border border-[#e2eaf5] bg-slate-100 px-3 py-2.5 text-[13px] text-slate-500 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">Date <span className="text-rose-500">*</span></span>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e2eaf5] px-3 py-2.5 text-[13px] outline-none focus:border-[#2563eb]" />
              </label>
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">Produced Quantity (m) <span className="text-rose-500">*</span></span>
                <input type="number" min="0" value={formQty} placeholder="e.g. 6,000" onChange={(e) => setFormQty(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#e2eaf5] px-3 py-2.5 text-[13px] outline-none focus:border-[#2563eb]" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">Entered By Employee</span>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#e2eaf5] px-3 py-2.5 text-[13px] outline-none focus:border-[#2563eb]"
                >
                  <option value="">Select employee...</option>
                  {formEmployeeId && !employees.some((em) => String(em.id) === formEmployeeId) && (
                    <option value={formEmployeeId}>{editing?.by || pi?.employeeName || 'Assigned employee'}</option>
                  )}
                  {employees.map((em) => (
                    <option key={em.id} value={String(em.id)}>
                      {em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''}
                    </option>
                  ))}
                </select>
                {employeesError && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{employeesError}</p>}
              </label>
              <label className="block">
                <span className="text-[12px] font-bold text-slate-600">Remarks (Optional)</span>
                <textarea
                  rows={3}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                  className="mt-1.5 w-full rounded-lg border border-[#e2eaf5] px-3 py-2.5 text-[13px] outline-none focus:border-[#2563eb]"
                />
              </label>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{formError}</span>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-[#e2eaf5] px-5 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-[#2563eb] px-6 py-2.5 text-[13px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Update' : 'Save Entry'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
