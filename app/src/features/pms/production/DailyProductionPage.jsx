import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import { Button } from '../../../components/ui/Button';
import { dailyEntriesStore } from './dailyEntriesStore';
import PageHeader from '../../../components/ui/PageHeader';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

const toDDMMYYYY = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

export default function DailyProductionPage() {
  const navigate = useNavigate();
  const { productionInstructions } = useERP();

  // Use the first instruction as context. No mock/fallback data is used.
  const pi = productionInstructions[0] || null;
  const piNumber = pi?.piNumber || '—';
  const vendor = pi?.vendor || '—';
  const fabric = pi?.fabric || '—';
  const assignedQty = Number(pi?.assignedQty) || 0;
  const startDate = pi?.startDate || '';
  const expectedDate = pi?.expectedCompletionDate || '';
  const status = pi?.status || '';

  const entries = useSyncExternalStore(dailyEntriesStore.subscribe, dailyEntriesStore.get);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  // Backend-first: load this PI's entries from GET /jobwork/pi-entries/.
  useEffect(() => {
    dailyEntriesStore.load(pi?.id).catch(() => {});
  }, [pi?.id]);
  const [formDate, setFormDate] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formPhoto, setFormPhoto] = useState(null);

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
    setFormDate('');
    setFormQty('');
    setFormRemarks('');
    setFormPhoto(null);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormDate(row.date);
    setFormQty(String(row.produced));
    setFormRemarks(row.remarks || '');
    setFormPhoto(null);
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formDate) { alert('Date is required.'); return; }
    if (!(Number(formQty) > 0)) { alert('Produced quantity must be greater than 0.'); return; }
    let by = editing?.by || '';
    if (!by) {
      try {
        const u = JSON.parse(localStorage.getItem('evenmore_saved_user') || 'null');
        by = u?.name || u?.full_name || u?.username || '';
      } catch { by = ''; }
    }
    if (editing) {
      dailyEntriesStore.update(editing.id, { date: formDate, produced: Number(formQty), by, remarks: formRemarks, photo: formPhoto ? formPhoto.name : editing.photo });
    } else {
      dailyEntriesStore.add({ id: `e-${Date.now()}`, instructionId: pi?.id, piId: pi?.id, date: formDate, produced: Number(formQty), by, remarks: formRemarks, photo: formPhoto ? formPhoto.name : '' });
    }
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this entry?')) dailyEntriesStore.remove(id);
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
          <button
            onClick={() => navigate('/pms/production-instructions')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Back to Instructions
          </button>
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
                  <td className="px-4 py-3">{row.remarks || '-'}{row.photo && <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">📷 {row.photo}</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(row)} className="text-slate-400 hover:text-[#2563eb]" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(row.id)} className="text-rose-400 hover:text-rose-600" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
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
                <span className="text-[12px] font-bold text-slate-600">Remarks (Optional)</span>
                <textarea
                  rows={4}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                  className="mt-1.5 w-full rounded-lg border border-[#e2eaf5] px-3 py-2.5 text-[13px] outline-none focus:border-[#2563eb]"
                />
              </label>
              <div>
                <span className="text-[12px] font-bold text-slate-600">Photo / Proof (Optional)</span>
                <label className="mt-1.5 flex h-[104px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center hover:border-[#2563eb]">
                  <svg className="h-7 w-7 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v10m0-10l-3.5 3.5M12 4l3.5 3.5" />
                  </svg>
                  <span className="mt-1 text-[13px] font-bold text-[#2563eb]">{formPhoto ? formPhoto.name : 'Upload Photo'}</span>
                  <span className="text-[11px] text-slate-400">JPG, PNG (Max 5 MB)</span>
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > 5 * 1024 * 1024) { alert('File must be Max 5 MB.'); e.target.value = ''; setFormPhoto(null); return; }
                    setFormPhoto(f);
                  }} />
                </label>
              </div>
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
