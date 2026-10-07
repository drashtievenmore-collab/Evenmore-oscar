import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, MoreHorizontal, Eye, ListChecks } from 'lucide-react';
import { useERP } from '../../../context/ERPContext';
import { dailyEntriesStore } from './dailyEntriesStore';
import PageHeader from '../../../components/ui/PageHeader';

const fmtM = (n) => `${Number(n || 0).toLocaleString('en-IN')} M`;
const fmtDate = (d) => d || '-';

function StatCard({ label, value, valueClass = 'text-[#17294e]', boxClass = 'bg-[#f4f6ff] border-[#e4e9f7]' }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${boxClass}`}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-[16px] font-extrabold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function ProductionCompletionVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { productionInstructions } = useERP();
  const entries = useSyncExternalStore(dailyEntriesStore.subscribe, dailyEntriesStore.get);
  const [showPI, setShowPI] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const piId = searchParams.get('pi');
  const pi =
    (piId && productionInstructions.find((p) => String(p.id) === String(piId))) ||
    productionInstructions[0] ||
    null;

  const piNumber = pi?.piNumber || '—';
  const piDate = pi?.date || pi?.startDate || '—';
  const vendor = pi?.vendor || '—';
  const fabric = pi?.fabric || '—';
  const processType = pi?.processType || '—';
  const assignedEmployee = pi?.assignedEmployee || '—';
  const orderQty = Number(pi?.assignedQty) || 0;
  const jobRate = Number(pi?.jobRate ?? pi?.agreedJobRate) || 0;
  const rejectedQty = Number(pi?.rejectedQty) || 0;

  const rows = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let cumulative = 0;
    return sorted.map((e) => {
      cumulative += Number(e.produced) || 0;
      const [y, m, d] = String(e.date || '').split('-');
      return {
        date: e.date,
        produced: Number(e.produced) || 0,
        by: e.by || '—',
        remarks: e.remarks || '-',
        displayDate: y && m && d ? `${d}-${m}-${y}` : e.date || '—',
        cumulative,
        balance: orderQty - cumulative,
      };
    });
  }, [entries, orderQty]);

  const totalProduced = rows.length ? rows[rows.length - 1].cumulative : 0;
  const acceptedQty = Math.max(0, totalProduced - rejectedQty);
  const shortage = (orderQty || 0) - acceptedQty;
  const hasData = Boolean(pi) && (rows.length > 0 || orderQty > 0);
  const statusLabel = pi?.status
    ? pi.status === 'Completed'
      ? 'Completed (Verification Pending)'
      : pi.status
    : '—';
  const jobRateLabel = jobRate > 0 ? `₹ ${jobRate.toFixed(2)} / M` : '—';

  const handlePrint = () => window.print();

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      {/* Title */}
      <PageHeader
        title="Production Completion & Verification"
        subtitle="Verify final production quantity and approve for Final Job Work PO."
      />

      {/* 1 — Summary card */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/pms/production-instructions')}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <h2 className="text-[14px] font-extrabold text-[#17294e]">Production Instruction Summary</h2>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
            {statusLabel}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPI(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Eye size={13} /> View PI
            </button>
            <button
              onClick={() => navigate('/pms/daily-production')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <ListChecks size={13} /> View Daily Production
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Printer size={13} /> Print
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg border border-[#e2eaf5] px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
                title="More"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl text-[12px]">
                    <button onClick={() => { setMenuOpen(false); navigate('/pms/daily-production'); }} className="block w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50">Add daily entry</button>
                    <button onClick={() => { setMenuOpen(false); handlePrint(); }} className="block w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50">Print summary</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* PI meta */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['PI No.', piNumber],
            ['PI Date', fmtDate(piDate)],
            ['Agency / Vendor', vendor],
            ['Fabric', fabric],
            ['Process Type', processType],
            ['Assigned Employee', assignedEmployee],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-medium text-slate-400">{k}</p>
              <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
            </div>
          ))}
        </div>

        {/* Stat boxes */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Order Quantity" value={hasData ? fmtM(orderQty) : '—'} valueClass="text-[#3b5bff]" boxClass="bg-[#eef1ff] border-[#dfe6ff]" />
          <StatCard label="Total Produced" value={hasData ? fmtM(totalProduced) : '—'} valueClass="text-emerald-600" boxClass="bg-[#eefaf1] border-[#d3efdd]" />
          <StatCard label="Rejected Qty" value={hasData ? fmtM(rejectedQty) : '—'} valueClass="text-rose-500" boxClass="bg-[#fdeef0] border-[#f8d3d8]" />
          <StatCard label="Accepted Qty" value={hasData ? fmtM(acceptedQty) : '—'} valueClass="text-[#3b5bff]" boxClass="bg-[#eef1ff] border-[#dfe6ff]" />
          <StatCard label="Shortage / Difference" value={hasData ? fmtM(shortage) : '—'} valueClass="text-[#9a6b1f]" boxClass="bg-[#fdf3e0] border-[#f5e0b8]" />
          <StatCard label="Agreed Job Rate" value={jobRateLabel} valueClass="text-[#7c3aed]" boxClass="bg-[#f3edff] border-[#e2d4ff]" />
        </div>
      </div>

      {/* 2 — Daily summary */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#2563eb] text-[11px] font-extrabold text-white">2</span>
          <h2 className="text-[13px] font-extrabold text-[#2563eb]">Daily Production Summary (Auto from Daily Production)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-center text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                {['#', 'Date', 'Produced Qty (M)', 'Cumulative Qty (M)', 'Balance Qty (M)', 'Entered By', 'Remarks'].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-50 text-slate-600 ${idx === rows.length - 1 ? 'bg-[#f2f7ff]' : ''}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2.5">{r.displayDate}</td>
                  <td className="px-4 py-2.5 font-semibold">{Number(r.produced).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">{Number(r.cumulative).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">{Number(r.balance).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 font-medium">{r.by}</td>
                  <td className="px-4 py-2.5">{r.remarks}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-slate-400">No production entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View PI modal */}
      {showPI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPI(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Production Instruction — {piNumber}</h3>
              <button onClick={() => setShowPI(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['PI Date', fmtDate(piDate)], ['Agency / Vendor', vendor], ['Fabric', fabric], ['Process Type', processType], ['Order Qty', hasData ? fmtM(orderQty) : '—'], ['Assigned', assignedEmployee], ['Job Rate', jobRateLabel], ['Status', pi?.status || '—']].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-bold uppercase text-slate-400">{k}</dt>
                  <dd className="mt-0.5 font-bold text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowPI(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
