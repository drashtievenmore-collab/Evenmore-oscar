import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Printer, MoreHorizontal, Eye, ListChecks,
  ClipboardList, Package, XCircle, CheckCircle2, AlertTriangle,
  IndianRupee, Check, X,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { api } from '../../../services/api';

const fmtM = (n) => `${Number(n || 0).toLocaleString('en-IN')} M`;
const fmtDate = (d) => d || '-';

export default function ProductionCompletionVerificationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [instructions, setInstructions] = useState([]);
  const [completionData, setCompletionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showPI, setShowPI] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [rejectedQtyInput, setRejectedQtyInput] = useState('0');
  const [verifyReasonInput, setVerifyReasonInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const piIdParam = searchParams.get('pi');

  // Load instructions list
  useEffect(() => {
    let live = true;
    api.get('/production/instructions/')
      .then((res) => {
        if (!live) return;
        const list = Array.isArray(res) ? res : res?.results || [];
        setInstructions(list);
        if (!piIdParam && list.length > 0) {
          setSearchParams({ pi: String(list[0].id) });
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [piIdParam, setSearchParams]);

  const activePiId = piIdParam || (instructions[0]?.id ? String(instructions[0].id) : null);

  const loadCompletionData = (id) => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/production/instructions/${id}/completion/`)
      .then((data) => {
        setCompletionData(data);
      })
      .catch(() => {
        setCompletionData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (activePiId) {
      loadCompletionData(activePiId);
    }
  }, [activePiId]);

  const piNumber = completionData?.piNo || instructions.find((p) => String(p.id) === String(activePiId))?.instructionNumber || '—';
  const piDate = completionData?.piDate || '—';
  const vendor = completionData?.agency || '—';
  const fabric = completionData?.fabric || '—';
  const processType = completionData?.processType || '—';
  const assignedEmployee = completionData?.assignedEmployee || '—';
  const orderQty = Number(completionData?.orderQty) || 0;
  const totalProduced = Number(completionData?.totalProduced) || 0;
  const rejectedQty = Number(completionData?.rejectedQty) || 0;
  const acceptedQty = Number(completionData?.acceptedQty) || 0;
  const shortage = Number(completionData?.shortageQty) || 0;
  const jobRate = Number(completionData?.jobRate) || 0;
  const finalAmount = Number(completionData?.finalAmount) || 0;
  const status = completionData?.status || 'In Progress';

  const rows = useMemo(() => {
    return (completionData?.dailySummary || []).map((r) => {
      const parts = String(r.date || '').slice(0, 10).split('-');
      const displayDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : r.date || '—';
      return {
        ...r,
        displayDate,
      };
    });
  }, [completionData]);

  const hasData = Boolean(completionData) && (rows.length > 0 || orderQty > 0);
  const statusLabel = status === 'Completed'
    ? 'Completed (Verification Pending)'
    : status;
  const jobRateLabel = jobRate > 0 ? `₹ ${jobRate.toFixed(2)} / M` : '—';

  const handlePrint = () => window.print();

  const handleComplete = async () => {
    if (!activePiId) return;
    if (!window.confirm('Mark this instruction as Completed (pending verification)?')) return;
    try {
      await api.post(`/production/instructions/${activePiId}/complete/`);
      loadCompletionData(activePiId);
    } catch (err) {
      alert(err.message || 'Failed to complete instruction');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!activePiId) return;
    if (!verifyReasonInput.trim()) {
      alert('Verification reason or remarks is required.');
      return;
    }
    setVerifying(true);
    try {
      await api.post(`/production/instructions/${activePiId}/verify/`, {
        reason: verifyReasonInput.trim(),
        rejectedQty: Number(rejectedQtyInput) || 0,
      });
      setShowVerifyModal(false);
      setVerifyReasonInput('');
      setRejectedQtyInput('0');
      loadCompletionData(activePiId);
    } catch (err) {
      alert(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      {/* Title */}
      <PageHeader
        title="Production Completion & Verification"
        subtitle="Verify final production quantity and approve for Final Job Work PO."
        actions={
          instructions.length > 1 && (
            <select
              value={activePiId || ''}
              onChange={(e) => setSearchParams({ pi: e.target.value })}
              className="rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none"
            >
              {instructions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.instructionNumber || p.piNumber || `PI-${p.id}`} - {p.agencyName || p.vendor || 'Agency'}
                </option>
              ))}
            </select>
          )
        }
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
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
            status === 'Verified'
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
              : status === 'Completed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'border-blue-200 bg-blue-50 text-blue-600'
          }`}>
            {statusLabel}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {status === 'In Progress' && (
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 hover:bg-amber-100"
              >
                Mark Complete
              </button>
            )}
            {status !== 'Verified' && (
              <button
                onClick={() => {
                  setRejectedQtyInput(String(rejectedQty || 0));
                  setShowVerifyModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
              >
                <Check size={14} /> Verify & Approve
              </button>
            )}
            <button
              onClick={() => setShowPI(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Eye size={13} /> View PI
            </button>
            <button
              onClick={() => navigate(`/pms/daily-production?pi=${encodeURIComponent(activePiId || '')}`)}
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
                    <button onClick={() => { setMenuOpen(false); navigate(`/pms/daily-production?pi=${encodeURIComponent(activePiId || '')}`); }} className="block w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50">Add daily entry</button>
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
          <KpiCard label="Order Quantity" value={hasData ? fmtM(orderQty) : '—'} icon={ClipboardList} tone="blue" />
          <KpiCard label="Total Produced" value={hasData ? fmtM(totalProduced) : '—'} icon={Package} tone="emerald" />
          <KpiCard label="Rejected Qty" value={hasData ? fmtM(rejectedQty) : '—'} icon={XCircle} tone="rose" />
          <KpiCard label="Accepted Qty" value={hasData ? fmtM(acceptedQty) : '—'} icon={CheckCircle2} tone="blue" />
          <KpiCard label="Shortage / Difference" value={hasData ? fmtM(shortage) : '—'} icon={AlertTriangle} tone="amber" />
          <KpiCard label="Agreed Job Rate" value={jobRateLabel} icon={IndianRupee} tone="purple" />
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
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-slate-400">Loading production summary...</td>
                </tr>
              )}
              {!loading && rows.map((r, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-50 text-slate-600 ${idx === rows.length - 1 ? 'bg-[#f2f7ff]' : ''}`}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2.5">{r.displayDate}</td>
                  <td className="px-4 py-2.5 font-semibold">{Number(r.produced).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">{Number(r.cumulative).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">{Number(r.balance).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 font-medium">{r.enteredBy || r.by}</td>
                  <td className="px-4 py-2.5">{r.remarks}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-slate-400">No production entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verify & Approve Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleVerify} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Approve & Verify Production</h3>
              <button type="button" onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">Total Produced Quantity</label>
                <input
                  type="text"
                  readOnly
                  value={`${Number(totalProduced).toLocaleString('en-IN')} M`}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">Rejected Quantity (M)</label>
                <input
                  type="number"
                  min="0"
                  max={totalProduced}
                  value={rejectedQtyInput}
                  onChange={(e) => setRejectedQtyInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-[10.5px] text-slate-400">
                  Accepted quantity will be {Math.max(0, totalProduced - (Number(rejectedQtyInput) || 0)).toLocaleString('en-IN')} M.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">Verification Reason / Remarks *</label>
                <textarea
                  required
                  rows={3}
                  value={verifyReasonInput}
                  onChange={(e) => setVerifyReasonInput(e.target.value)}
                  placeholder="e.g. Quality and meters cross-checked and approved."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Approve & Verify'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View PI modal */}
      {showPI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPI(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Production Instruction — {piNumber}</h3>
              <button onClick={() => setShowPI(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['PI Date', fmtDate(piDate)], ['Agency / Vendor', vendor], ['Fabric', fabric], ['Process Type', processType], ['Order Qty', hasData ? fmtM(orderQty) : '—'], ['Assigned', assignedEmployee], ['Job Rate', jobRateLabel], ['Status', status]].map(([k, v]) => (
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
