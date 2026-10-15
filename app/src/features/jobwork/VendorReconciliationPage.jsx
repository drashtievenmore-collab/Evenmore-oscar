import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Hourglass,
  Pencil,
  Send,
  ClipboardList,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { numIN } from './jobWorkOrdersStore';
import PageHeader from '../../components/ui/PageHeader';

const statusPill = (s) =>
  s === 'Reconciled'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'Mismatch'
      ? 'bg-rose-50 text-rose-500 border-rose-200'
      : 'bg-amber-50 text-amber-600 border-amber-200';

const StatusIcon = ({ status }) =>
  status === 'Reconciled' ? <CheckCircle2 size={12} /> : status === 'Mismatch' ? <AlertTriangle size={12} /> : <Clock size={12} />;

export default function VendorReconciliationPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fJwo, setFJwo] = useState('All');
  const [fVendor, setFVendor] = useState('All');
  const [fProcess, setFProcess] = useState('All');
  const [fFabric, setFFabric] = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.get('/jobwork/orders/vendor-reconciliation/')
      .then((res) => {
        if (!live) return;
        const list = Array.isArray(res) ? res : res?.results || [];
        setRows(list);
        setError(null);
      })
      .catch((err) => {
        if (!live) return;
        setError(err.message || 'Failed to load vendor reconciliation');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, []);

  const jwoNos = useMemo(() => ['All', ...new Set(rows.map((r) => r.jwoNo).filter(Boolean))], [rows]);
  const vendors = useMemo(() => ['All', ...new Set(rows.map((r) => r.vendor).filter(Boolean))], [rows]);
  const processes = useMemo(() => ['All', ...new Set(rows.map((r) => r.process).filter(Boolean))], [rows]);
  const fabrics = useMemo(() => ['All', ...new Set(rows.map((r) => r.fabricItem).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (fJwo !== 'All' && r.jwoNo !== fJwo) return false;
    if (fVendor !== 'All' && r.vendor !== fVendor) return false;
    if (fProcess !== 'All' && r.process !== fProcess) return false;
    if (fFabric !== 'All' && r.fabricItem !== fFabric) return false;
    if (fStatus !== 'All' && r.status !== fStatus) return false;
    if (fFrom && (!r.orderDate || r.orderDate < fFrom)) return false;
    if (fTo && (!r.orderDate || r.orderDate > fTo)) return false;
    return true;
  }), [rows, fJwo, fVendor, fProcess, fFabric, fStatus, fFrom, fTo]);

  const totals = useMemo(() => {
    const t = { count: 0, outward: 0, inward: 0, accepted: 0, rejected: 0, pending: 0 };
    filtered.forEach((r) => {
      t.count += 1;
      t.outward += r.totalOutward;
      t.inward += r.totalInward;
      t.accepted += r.acceptedQty;
      t.rejected += r.rejectedQty;
      t.pending += r.pendingQty;
    });
    return t;
  }, [filtered]);

  const summaryCards = [
    { icon: ClipboardList, label: 'Total JWO', value: `${totals.count}`, tileBg: '#e9f1fd', iconBg: '#d6e6fd', iconColor: '#2563eb' },
    { icon: Send, label: 'Total Outward Quantity', value: `${numIN(totals.outward)} M`, tileBg: '#f1eafd', iconBg: '#e2d4fb', iconColor: '#7c3aed' },
    { icon: ArrowDownToLine, label: 'Total Inward Quantity', value: `${numIN(totals.inward)} M`, tileBg: '#e7f6ec', iconBg: '#cdeed8', iconColor: '#16a34a' },
    { icon: CheckCircle2, label: 'Total Accepted Quantity', value: `${numIN(totals.accepted)} M`, tileBg: '#eff6ff', iconBg: '#dbeafe', iconColor: '#2563eb' },
    { icon: XCircle, label: 'Total Rejected Quantity', value: `${numIN(totals.rejected)} M`, tileBg: '#fdeef1', iconBg: '#fad9e0', iconColor: '#e11d48' },
    { icon: Hourglass, label: 'Total Pending Quantity', value: `${numIN(totals.pending)} M`, tileBg: '#fdf3e0', iconBg: '#fbe3b8', iconColor: '#d97706' },
  ];

  const selectCls = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none';
  const labelCls = 'text-[11px] font-semibold text-slate-400';

  const openJWO = (r) => navigate(`/job-work/orders/${r.jwoId}`);

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Vendor Reconciliation"
        subtitle="Reconcile material sent, received, and balance per vendor."
      />

      {/* Summary cards — all derived from the rows below */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-xl p-3" style={{ background: c.tileBg }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: c.iconBg, color: c.iconColor }}>
                <c.icon size={17} />
              </span>
              <span className="text-[11.5px] font-semibold leading-tight text-slate-600">{c.label}</span>
            </div>
            <div className="mt-2 text-[17px] font-extrabold tracking-tight text-[#17294e]">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="block">
            <span className={labelCls}>JWO No.</span>
            <select value={fJwo} onChange={(e) => setFJwo(e.target.value)} className={selectCls}>
              {jwoNos.map((v) => <option key={v} value={v}>{v === 'All' ? 'All JWO' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Vendor / Processor</span>
            <select value={fVendor} onChange={(e) => setFVendor(e.target.value)} className={selectCls}>
              {vendors.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Vendors' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Process</span>
            <select value={fProcess} onChange={(e) => setFProcess(e.target.value)} className={selectCls}>
              {processes.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Processes' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Fabric Item</span>
            <select value={fFabric} onChange={(e) => setFFabric(e.target.value)} className={selectCls}>
              {fabrics.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Fabric' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Status</span>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
              {['All', 'Pending', 'Mismatch', 'Reconciled'].map((v) => (
                <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>From Date</span>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <label className="block">
            <span className={labelCls}>To Date</span>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[1560px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['JWO No.', 'Vendor / Processor', 'Process', 'Fabric Item', 'Fabric Quality', 'Shade / Colour', 'Total Outward Qty (M)', 'Total Inward Qty (M)', 'Accepted Qty (M)', 'Rejected Qty (M)', 'Pending Qty (M)', 'Difference (M)', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${(i >= 6 && i <= 11) ? 'text-right' : ''} ${i === 12 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={r.jwoId} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openJWO(r)} className="font-mono font-bold text-blue-600 hover:underline">{r.jwoNo}</button>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{r.vendor || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.process || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricItem || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricQuality || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.shade || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{numIN(r.totalOutward)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{numIN(r.totalInward)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(r.acceptedQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(r.rejectedQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{numIN(r.pendingQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{numIN(r.difference)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(r.status)}`}>
                      <StatusIcon status={r.status} />{r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="View reconciliation details">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Remarks / verification on JWO">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Supporting documents on JWO">
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-slate-500">
                    Loading vendor reconciliation...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-extrabold text-[#17294e]">No reconciliation records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">
                      {rows.length === 0
                        ? 'Rows appear here automatically once material is sent out on a Job Work Order.'
                        : 'Try clearing the filters above.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
