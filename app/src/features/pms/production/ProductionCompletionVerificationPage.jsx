import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, TrendingUp, Clock, CheckCircle2, List } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import { dailyEntriesStore } from './dailyEntriesStore';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

const toDDMMYYYY = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

export default function ProductionCompletionVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { productionInstructions } = useERP();
  const entries = useSyncExternalStore(dailyEntriesStore.subscribe, dailyEntriesStore.get);
  const [verified, setVerified] = useState(false);

  const piId = searchParams.get('pi');
  const pi = (piId && productionInstructions.find((p) => String(p.id) === String(piId))) || productionInstructions[0] || null;

  const piNumber = pi?.piNumber || '—';
  const vendor = pi?.vendor || '—';
  const fabric = pi?.fabric || '—';
  const assignedQty = Number(pi?.assignedQty) || 0;
  const startDate = pi?.startDate || '';
  const expectedDate = pi?.expectedCompletionDate || '';

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
  const completed = assignedQty > 0 && balanceQty === 0 && totalProduced >= assignedQty;

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-medium text-slate-400">
        Dashboard <span className="mx-1">›</span> PMS <span className="mx-1">›</span> Production Completion &amp; Verification <span className="mx-1">›</span> <span className="text-slate-600 font-semibold">{piNumber}</span>
      </p>

      <div className="rounded-xl border border-[#e2eaf5] bg-white p-5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight text-[#17294e]">Production Completion &amp; Verification</h1>
            <p className="mt-1 text-[12px] text-slate-500">Verify total production against the instruction before generating Final Job Work PO.</p>
          </div>
          <button onClick={() => navigate('/pms/production-instructions')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50">
            <ArrowLeft size={14} /> Back to Instructions
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Left info */}
          <div className="text-[12px]">
            <p className="text-[10px] font-semibold uppercase text-slate-400">PI No.</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[15px] font-extrabold text-[#17294e]">{piNumber}</span>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{completed ? 'Completed' : 'Ready for Verification'}</span>
            </div>
            <div className="mt-3 space-y-1.5 text-slate-600">
              <p><span className="inline-block w-32 text-slate-400">Vendor:</span> <span className="font-semibold text-slate-700">{vendor}</span></p>
              <p><span className="inline-block w-32 text-slate-400">Fabric:</span> <span className="font-semibold text-slate-700">{fabric}</span></p>
              <p><span className="inline-block w-32 text-slate-400">Start Date:</span> <span className="font-semibold text-slate-700">{startDate || '—'}</span></p>
              <p><span className="inline-block w-32 text-slate-400">Expected Completion:</span> <span className="font-semibold text-slate-700">{expectedDate || '—'}</span></p>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-lg border border-[#e2eaf5] bg-[#f4f8ff] p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><FileText size={14} className="text-[#2563eb]" /> Ordered Quantity</div>
              <p className="mt-2 text-[20px] font-extrabold text-[#17294e]">{fmt(assignedQty)} m</p>
            </div>
            <div className="rounded-lg border border-[#e2eaf5] bg-[#f2fdf6] p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><TrendingUp size={14} className="text-emerald-500" /> Total Produced</div>
              <p className="mt-2 text-[20px] font-extrabold text-emerald-600">{fmt(totalProduced)} m</p>
            </div>
            <div className="rounded-lg border border-[#e2eaf5] bg-[#fff8e6] p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><Clock size={14} className="text-amber-500" /> Balance Quantity</div>
              <p className="mt-2 text-[20px] font-extrabold text-[#17294e]">{fmt(balanceQty)} m</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-[#f2fdf6] p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500"><CheckCircle2 size={14} className="text-emerald-500" /> Production Status</div>
              <p className="mt-2 text-[14px] font-extrabold text-emerald-600">{completed ? 'Production Completed' : 'In Progress'}</p>
              <p className="mt-1 text-[10.5px] text-slate-500">{completed ? 'Total produced quantity matches the ordered quantity.' : 'Total produced quantity does not yet match the ordered quantity.'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Entry summary */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-[14px] font-extrabold text-[#17294e]">Production Entry Summary</h2>
          <Link to="/pms/daily-production" className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[11px] font-bold text-[#2563eb] hover:bg-slate-50">
            <List size={13} /> View All Production Entries
          </Link>
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
                  <td className="px-4 py-3">{row.by || '-'}</td>
                  <td className="px-4 py-3">{row.remarks || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No production entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <h2 className="text-[14px] font-extrabold text-[#17294e]">Verification</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#eef4ff] p-4">
          <div className="flex items-start gap-2.5">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-1 h-4 w-4 accent-[#2563eb]" />
            <div>
              <p className="text-[12px] font-bold text-[#17294e]">Please verify the total produced quantity against the ordered quantity.</p>
              <p className="text-[11px] text-slate-500">Once verified, you can generate the Final Job Work PO for this production instruction.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setVerified(true)} className={`rounded-lg px-5 py-2.5 text-[12px] font-bold text-white ${verified ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-[#2563eb] hover:bg-[#1d4ed8]'}`}>
              ✓ Verify Quantity
            </button>
            <button disabled={!verified} className={`rounded-lg px-5 py-2.5 text-[12px] font-bold ${verified ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]' : 'cursor-not-allowed bg-slate-200 text-slate-400'}`}>
              Generate Final Job Work PO
            </button>
          </div>
        </div>
        {!verified && <p className="mt-2 text-right text-[11px] text-slate-400">Will be enabled after verification</p>}
      </div>
    </div>
  );
}
