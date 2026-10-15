import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import PageHeader from '../../../components/ui/PageHeader';
import { api } from '../../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

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
    piNumber: item.instructionNumber || item.instruction_number || item.piNumber || `PI-${item.id}`,
    date: item.piDate || item.pi_date || item.date || '',
    vendor: item.agencyName || item.agency_name || item.vendor || '',
    fabric: item.fabric || '',
    processType: item.processType || item.process_type || '',
    assignedQty: Number(item.orderMeter ?? item.order_meter ?? item.assignedQty ?? 0),
    startDate: item.startDate || item.piDate || item.pi_date || '',
    expectedDate: item.expectedCompletionDate || item.expected_completion_date || '',
    employeeId: item.employeeId || item.employee_id || item.employee || '',
    status: item.status || 'Draft',
  };
}

function normalizeEntry(e) {
  if (!e) return null;
  return {
    id: String(e.id),
    date: e.entryDate || e.entry_date || e.date || '',
    produced: Number(e.meters ?? e.produced ?? 0),
    by: e.employeeName || e.employee_name || e.by || '—',
    remarks: e.remarks || '',
    employeeId: e.enteredByEmployeeId || e.entered_by_employee_id || e.employeeId || '',
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
    Promise.all([
      api.get('/production/instructions/').catch(() => ({ results: [] })),
      api.get('/hrms/employees/').catch(() => ({ results: [] })),
    ])
      .then(([piRes, empRes]) => {
        if (!live) return;
        const piList = (Array.isArray(piRes) ? piRes : piRes?.results || []).map(normalizeInstruction).filter(Boolean);
        setInstructions(piList);
        const empList = Array.isArray(empRes) ? empRes : empRes?.results || [];
        setEmployees(empList);

        if (!selectedPiId && piList.length > 0) {
          setSelectedPiId(piList[0].id);
        }
      })
      .catch((err) => {
        if (live) setError(err.message || 'Failed to load instructions');
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => { live = false; };
  }, []);

  const pi = useMemo(
    () => instructions.find((p) => String(p.id) === String(selectedPiId)) || instructions[0] || null,
    [instructions, selectedPiId],
  );

  const piNumber = pi?.piNumber || '—';
  const vendor = pi?.vendor || '—';
  const fabric = pi?.fabric || '—';
  const assignedQty = Number(pi?.assignedQty) || 0;
  const startDate = pi?.startDate || '';
  const expectedDate = pi?.expectedDate || '';
  const status = pi?.status || '';

  // Load daily entries when selected PI changes
  useEffect(() => {
    if (!pi?.id) {
      setEntries([]);
      return;
    }
    let live = true;
    setEntriesLoading(true);
    api.get('/production/daily-entries/', { query: { instructionId: pi.id } })
      .then((res) => {
        if (!live) return;
        const list = (Array.isArray(res) ? res : res?.results || []).map(normalizeEntry).filter(Boolean);
        setEntries(list);
      })
      .catch(() => {
        if (live) setEntries([]);
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
      return { ...e, cumulative, balance: Math.max(0, assignedQty - cumulative) };
    });
  }, [entries, assignedQty]);

  const totalProduced = rows.length ? rows[rows.length - 1].cumulative : 0;
  const balanceQty = Math.max(0, assignedQty - totalProduced);

  const openAdd = () => {
    setEditing(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormQty('');
    setFormRemarks('');
    setFormEmployeeId(pi?.employeeId || (employees[0]?.id ? String(employees[0].id) : ''));
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormDate(row.date ? String(row.date).slice(0, 10) : '');
    setFormQty(String(row.produced));
    setFormRemarks(row.remarks || '');
    setFormEmployeeId(row.employeeId || pi?.employeeId || '');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formDate) { alert('Date is required.'); return; }
    if (!(Number(formQty) > 0)) { alert('Produced quantity must be greater than 0.'); return; }
    if (!pi?.id) { alert('Select a Production Instruction first.'); return; }

    const empId = formEmployeeId || pi.employeeId || employees[0]?.id;

    try {
      if (editing) {
        const payload = {
          entryDate: formDate,
          meters: Number(formQty),
          remarks: formRemarks,
        };
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
    } catch (err) {
      alert(err.message || 'Failed to save daily entry');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.delete(`/production/daily-entries/${id}/`);
      setEntries((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete entry');
    }
  };

  const infoCards = [
    { label: 'PI No.', value: piNumber, extra: status ? <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{status}</span> : null },
    { label: 'Vendor', value: vendor },
    { label: 'Fabric', value: fabric },
    { label: 'Assigned Quantity', value: `${fmt(assignedQty)} m` },
    { label: 'Total Produced', value: `${fmt(totalProduced)} m`, highlight: 'bg-[#eef4ff] border-[#cfe0ff]', valueClass: 'text-[#2563eb]' },
    { label: 'Balance Quantity', value: `${fmt(balanceQty)} m`, highlight: 'bg-[#fff8e6] border-[#fde9b8]', valueClass: 'text-[#17294e]' },
    { label: 'Start Date', value: startDate || '—' },
    { label: 'Expected Completion', value: expectedDate || '—' },
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
            {instructions.length > 1 && (
              <select
                value={selectedPiId}
                onChange={(e) => {
                  setSelectedPiId(e.target.value);
                  setSearchParams({ pi: e.target.value });
                }}
                className="rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none"
              >
                {instructions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.piNumber} - {p.vendor}
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
          <Button icon={Plus} onClick={openAdd} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
            Add Daily Entry
          </Button>
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
                  <td className="px-4 py-3">{fmt(row.balance)}</td>
                  <td className="px-4 py-3">{row.by}</td>
                  <td className="px-4 py-3">{row.remarks || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(row)} className="text-slate-400 hover:text-[#2563eb]" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(row.id)} className="text-rose-400 hover:text-rose-600" title="Delete"><Trash2 size={14} /></button>
                    </div>
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
              {!entriesLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No entries yet. Click "Add Daily Entry" to record production.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  {employees.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.name} ({em.employeeCode || em.employee_code || 'EMP'})
                    </option>
                  ))}
                </select>
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

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-[#e2eaf5] px-5 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="rounded-lg bg-[#2563eb] px-6 py-2.5 text-[13px] font-bold text-white hover:bg-[#1d4ed8]">{editing ? 'Update' : 'Save Entry'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
