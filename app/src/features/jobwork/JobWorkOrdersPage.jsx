import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, ArrowDownToLine, Hourglass, IndianRupee, User, Users } from 'lucide-react';
import { loadJWOs, loadJWOsAsync, saveJWOs, nextJWONumber, jwoKpis, inr, numIN, toDDMMYYYY } from './jobWorkOrdersStore';
import PageHeader from '../../components/ui/PageHeader';

const statusPill = (s) =>
  s === 'Completed'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'In-Process'
      ? 'bg-rose-50 text-rose-500 border-rose-200'
      : 'bg-amber-50 text-amber-600 border-amber-200';

export default function JobWorkOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(loadJWOs);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');

  // Backend-first: pull from GET /jobwork/orders/ when logged in, cache to localStorage.
  useEffect(() => {
    let live = true;
    loadJWOsAsync().then((rows) => {
      if (live && Array.isArray(rows)) setOrders(rows);
    });
    return () => { live = false; };
  }, []);

  const totals = useMemo(() => {
    const t = { ordered: 0, outward: 0, inward: 0, pending: 0, amount: 0 };
    orders.forEach((o) => {
      const k = jwoKpis(o);
      t.ordered += k.totalOrdered;
      t.outward += k.totalOutward;
      t.inward += k.totalInward;
      t.pending += k.pending;
      t.amount += k.totalAmount;
    });
    return t;
  }, [orders]);

  const rows = useMemo(
    () =>
      orders.filter((o) => {
        if (status !== 'All' && o.status !== status) return false;
        if (!q) return true;
        const s = `${o.jwoNo} ${o.vendor} ${o.process}`.toLowerCase();
        return s.includes(q.toLowerCase());
      }),
    [orders, q, status],
  );

  const handleCreate = () => {
    const jwoNo = nextJWONumber(orders);
    const fresh = {
      id: `jwo-${Date.now()}`,
      jwoNo,
      process: 'Dyeing',
      vendor: 'Vendor B',
      orderDate: new Date().toISOString().slice(0, 10),
      plannedQty: 1000,
      rate: 8,
      totalAmount: 8000,
      expectedCompletion: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
      status: 'In-Process',
      materials: [
        {
          id: `m-${Date.now()}`,
          fabricItem: 'Cotton Fabric',
          fabricQuality: 'GSM 120',
          shade: 'Navy Blue',
          lotNo: 'LOT-001',
          qty: 1000,
          rate: 8,
          amount: 8000,
        },
      ],
      outwards: [],
      inwards: [],
      remarks: '',
    };
    // Save locally and open immediately so the button never hangs on the network.
    const next = [fresh, ...orders];
    setOrders(next);
    try { saveJWOs(next); } catch { /* ignore */ }
    navigate(`/job-work/orders/${fresh.id}`);
    // Sync to backend in the background (server owns the JWO number).
    // On success the server row has a new id — replace the URL so a
    // refresh still finds the order instead of "not found".
    import('../../services/jobWorkSync').then(({ pushCreateJWO, isJobWorkBackendEnabled }) => {
      if (!isJobWorkBackendEnabled()) return;
      pushCreateJWO(fresh).then((saved) => {
        if (saved) {
          setOrders((prev) => {
            const merged = prev.map((o) => (o.id === fresh.id ? saved : o));
            try { saveJWOs(merged); } catch { /* ignore */ }
            return merged;
          });
          navigate(`/job-work/orders/${saved.id}`, { replace: true });
        }
      }).catch(() => { /* offline — local copy already saved */ });
    });
  };

  const kpiCards = [
    { icon: User, label: 'Total Ordered', value: `${numIN(totals.ordered)} M`, tileBg: '#e9f1fd', iconBg: '#d6e6fd', iconColor: '#2563eb' },
    { icon: Users, label: 'Total Outward', value: `${numIN(totals.outward)} M`, tileBg: '#f1eafd', iconBg: '#e2d4fb', iconColor: '#7c3aed' },
    { icon: ArrowDownToLine, label: 'Total Inward', value: `${numIN(totals.inward)} M`, tileBg: '#e7f6ec', iconBg: '#cdeed8', iconColor: '#16a34a' },
    { icon: Hourglass, label: 'Pending Quantity', value: `${numIN(totals.pending)} M`, tileBg: '#fdf3e0', iconBg: '#fbe3b8', iconColor: '#d97706' },
    { icon: IndianRupee, label: 'Total Amount', value: inr(totals.amount), tileBg: '#fdeef1', iconBg: '#fad9e0', iconColor: '#e11d48' },
  ];

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Job Work Orders"
        subtitle="Manage job work orders assigned to external processors."
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Job Work / Processing' },
          { label: 'Job Work Orders' },
        ]}
        actions={
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
          >
            <Plus size={14} /> Create Job Work Order
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((c) => (
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
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search JWO / vendor / process…"
            className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-blue-400"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none"
          >
            {['All', 'In-Process', 'Completed', 'Draft'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['JWO No.', 'Date', 'Vendor', 'Process', 'Quantity (M)', 'Received (M)', 'Pending (M)', 'Rate (₹/M)', 'Amount (₹)', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${i >= 4 && i <= 8 ? 'text-right' : ''} ${i === 9 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o, idx) => {
                const k = jwoKpis(o);
                return (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="font-mono font-bold text-blue-600 hover:underline">
                        {o.jwoNo}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{toDDMMYYYY(o.orderDate)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{o.vendor}</td>
                    <td className="px-3 py-2.5 text-slate-600">{o.process}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(k.totalOrdered)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(k.totalInward)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">{numIN(k.pending)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(o.rate || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">{numIN(k.totalAmount)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(o.status)}`}>{o.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Add">
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-slate-50/80 font-bold">
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-slate-700">Total</td>
                  <td colSpan={3} className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.ordered)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.inward)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.pending)}</td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.amount)}</td>
                  <td colSpan={2} className="px-3 py-2.5"></td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-extrabold text-[#17294e]">No records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">Create a job work order to get started.</p>
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
