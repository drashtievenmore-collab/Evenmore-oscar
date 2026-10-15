import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, ArrowDownToLine, Hourglass, IndianRupee, User, Users, X } from 'lucide-react';
import { loadJWOs, loadJWOsAsync, saveJWOs, nextJWONumber, jwoKpis, inr, numIN, toDDMMYYYY } from './jobWorkOrdersStore';
import { useERP } from '../../context/ERPContext';
import PageHeader from '../../components/ui/PageHeader';

const statusPill = (s) =>
  s === 'Completed'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'In-Process'
      ? 'bg-rose-50 text-rose-500 border-rose-200'
      : 'bg-amber-50 text-amber-600 border-amber-200';

const PROCESS_OPTIONS = [
  'Dyeing', 'Printing', 'Bleaching', 'Finishing',
  'Mercerizing', 'Heat Setting', 'Sanforizing', 'Embroidery',
];

export default function JobWorkOrdersPage() {
  const navigate = useNavigate();
  const { vendors = [], items = [] } = useERP();
  const [orders, setOrders] = useState(loadJWOs);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalVendor, setModalVendor] = useState('');
  const [modalProcess, setModalProcess] = useState('Dyeing');
  const [modalFabric, setModalFabric] = useState('');
  const [modalQuality, setModalQuality] = useState('');
  const [modalShade, setModalShade] = useState('');
  const [modalLotNo, setModalLotNo] = useState('');
  const [modalQty, setModalQty] = useState('');
  const [modalRate, setModalRate] = useState('');
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalExpected, setModalExpected] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [modalRemarks, setModalRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const openCreateModal = () => {
    setModalVendor(vendors[0]?.name || '');
    setModalProcess('Dyeing');
    setModalFabric(items[0]?.name || '');
    setModalQuality(items[0]?.fabricQuality || 'Cotton 60s');
    setModalShade(items[0]?.fabricColor || '');
    setModalLotNo('');
    setModalQty('');
    setModalRate('');
    setModalDate(new Date().toISOString().slice(0, 10));
    setModalExpected(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    setModalRemarks('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!modalVendor) { alert('Please select a vendor.'); return; }
    const plannedQty = Number(modalQty);
    const rate = Number(modalRate);
    if (!(plannedQty > 0)) { alert('Please enter a valid planned quantity.'); return; }
    if (!(rate >= 0)) { alert('Please enter a valid rate.'); return; }

    setIsSubmitting(true);
    const jwoNo = nextJWONumber(orders);
    const totalAmount = plannedQty * rate;
    const fresh = {
      id: `jwo-${Date.now()}`,
      jwoNo,
      process: modalProcess,
      vendor: modalVendor,
      orderDate: modalDate,
      plannedQty,
      rate,
      totalAmount,
      expectedCompletion: modalExpected,
      status: 'In-Process',
      materials: [
        {
          id: `m-${Date.now()}`,
          fabricItem: modalFabric || 'Fabric Item',
          fabricQuality: modalQuality,
          shade: modalShade,
          lotNo: modalLotNo,
          qty: plannedQty,
          rate,
          amount: totalAmount,
        },
      ],
      outwards: [],
      inwards: [],
      remarks: modalRemarks,
    };

    const next = [fresh, ...orders];
    setOrders(next);
    try { saveJWOs(next); } catch { /* ignore */ }
    setShowCreateModal(false);
    setIsSubmitting(false);

    try {
      const { pushCreateJWO, isJobWorkBackendEnabled } = await import('../../services/jobWorkSync');
      if (isJobWorkBackendEnabled()) {
        const saved = await pushCreateJWO(fresh);
        if (saved) {
          const merged = next.map((o) => (o.id === fresh.id ? saved : o));
          setOrders(merged);
          try { saveJWOs(merged); } catch { /* ignore */ }
          navigate(`/job-work/orders/${saved.id}`);
          return;
        }
      }
    } catch { /* offline — navigate with local id */ }
    navigate(`/job-work/orders/${fresh.id}`);
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
          { label: 'PMS', path: '/pms' },
          { label: 'Job Work / Processing' },
          { label: 'Job Work Orders' },
        ]}
        actions={
          <button
            onClick={openCreateModal}
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
            <option value="All">All Statuses</option>
            <option value="In-Process">In-Process</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">JWO No</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Process</th>
                <th className="px-3 py-2.5">Vendor</th>
                <th className="px-3 py-2.5 text-right">Ordered (M)</th>
                <th className="px-3 py-2.5 text-right">Inward (M)</th>
                <th className="px-3 py-2.5 text-right">Pending (M)</th>
                <th className="px-3 py-2.5 text-right">Rate</th>
                <th className="px-3 py-2.5 text-right">Total Amount</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {rows.map((o, idx) => {
                const k = jwoKpis(o);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3 py-2.5 text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-[#17294e]">
                      <button
                        onClick={() => navigate(`/job-work/orders/${o.id}`)}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {o.jwoNo}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{toDDMMYYYY(o.orderDate)}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{o.process}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{o.vendor}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium">{numIN(k.totalOrdered)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-emerald-600">{numIN(k.totalInward)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">{numIN(k.pending)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">₹{Number(o.rate || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#17294e]">{inr(k.totalAmount)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPill(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil size={14} />
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

      {/* Create JWO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Create Job Work Order</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vendor / Processor *</label>
                  <select
                    required
                    value={modalVendor}
                    onChange={(e) => setModalVendor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Process Type *</label>
                  <select
                    required
                    value={modalProcess}
                    onChange={(e) => setModalProcess(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
                  >
                    {PROCESS_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fabric Item *</label>
                  <select
                    value={modalFabric}
                    onChange={(e) => {
                      const sel = items.find((it) => it.name === e.target.value);
                      setModalFabric(e.target.value);
                      if (sel?.fabricQuality) setModalQuality(sel.fabricQuality);
                      if (sel?.fabricColor) setModalShade(sel.fabricColor);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Fabric Item</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.name}>{it.sku ? `${it.sku} — ` : ''}{it.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fabric Quality</label>
                  <input
                    type="text"
                    value={modalQuality}
                    onChange={(e) => setModalQuality(e.target.value)}
                    placeholder="e.g. Cotton 60s, GSM 120"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Shade / Color</label>
                  <input
                    type="text"
                    value={modalShade}
                    onChange={(e) => setModalShade(e.target.value)}
                    placeholder="e.g. Navy Blue"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Grey Lot No.</label>
                  <input
                    type="text"
                    value={modalLotNo}
                    onChange={(e) => setModalLotNo(e.target.value)}
                    placeholder="e.g. LOT-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Planned Quantity (m) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    placeholder="e.g. 1000"
                    value={modalQty}
                    onChange={(e) => setModalQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Rate (₹ / m) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 8.50"
                    value={modalRate}
                    onChange={(e) => setModalRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Order Date</label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={modalExpected}
                    onChange={(e) => setModalExpected(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Remarks / Special Instructions</label>
                  <input
                    type="text"
                    value={modalRemarks}
                    onChange={(e) => setModalRemarks(e.target.value)}
                    placeholder="e.g. Ensure even shade across all takas"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">
                  Total Value: <strong>₹{((Number(modalQty) || 0) * (Number(modalRate) || 0)).toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
