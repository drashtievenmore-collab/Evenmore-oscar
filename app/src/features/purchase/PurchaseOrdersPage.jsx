import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import {
  Plus, ClipboardList, Send, ArrowRight, X, Copy, Printer, DollarSign,
  Clock, CheckCircle2, Package, Maximize2, Minimize2, Trash2, Ban, MapPin,
  ShoppingCart, FileText, Search, Filter, MoreVertical, Info, ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineItemEditor } from '../../components/common/LineItemEditor';
import { DocumentTimeline } from '../../components/common/DocumentTimeline';
import { RelatedDocumentsCard } from '../../components/common/RelatedDocumentsCard';
import { PrintPurchaseOrderModal } from '../../components/common/PrintPurchaseOrderModal';

const purchaseOrderGuide = {
    title: 'Purchase Orders',
    subtitle: 'Supplier procurement contracts driving inventory replenishment and vendor billing.',
    purpose: 'A Purchase Order (PO) is an official commercial document issued by your business to an external supplier, committing to buy specified quantities of goods at negotiated prices. It serves as the baseline for warehouse goods intake and 3-way matching.',
    keyTerms: [
        { term: 'Purchase Order (PO)', definition: 'A legally binding procurement contract sent to a vendor before goods are shipped.' },
        { term: 'Vendor Lead Time', definition: 'The expected days between issuing the PO and receiving physical delivery at the warehouse dock.' },
        { term: 'PO to Bill Conversion', definition: 'Converts the verified order into a vendor invoice and automatically increases warehouse inventory on-hand.' },
    ],
    tips: [
        'Use the Clone button on frequent supplier orders to duplicate items into a new draft in 1 click.',
        'Once goods arrive at the dock, click "Create Bill" to post inventory intake and record Accounts Payable.',
    ],
    workflow: ['Auto-Generated / Draft PO', 'Issued to Vendor', 'Goods Intake & Vendor Bill', '3-Way Match Verified', 'Disbursement Settlement'],
};

/* Wave footer for KPI cards — same soft wave as reference */
function Wave({ color }) {
  return (
    <svg viewBox="0 0 300 34" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 h-[30px] w-full">
      <path d="M0 22 C 40 8, 70 30, 110 20 S 180 6, 220 18 S 270 28, 300 16 L300 34 L0 34 Z" fill={color} opacity="0.55" />
      <path d="M0 26 C 50 16, 90 32, 140 24 S 210 14, 260 24 S 290 28, 300 22 L300 34 L0 34 Z" fill={color} opacity="0.8" />
    </svg>
  );
}

function Kpi({ icon: Icon, value, label, trend, iconBg, iconColor, wave, arrowBg, arrowColor }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e2eaf5] bg-white p-4 pb-9 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: iconBg, color: iconColor }}>
            <Icon size={19} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-[#17294e]">{value}</p>
            <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
            {trend && <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600"><span className="inline-block">↗</span> {trend}</p>}
          </div>
        </div>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border" style={{ background: arrowBg, borderColor: '#e2eaf5', color: arrowColor }}>
          <ArrowRight size={12} />
        </span>
      </div>
      <Wave color={wave} />
    </div>
  );
}

const DEMO_RECENT = [
  { po: 'PO-2024-001', supplier: 'Shree Textiles', date: '12 Mar 2024', exp: '20 Mar 2024', status: 'Draft', value: '₹2,45,000' },
  { po: 'PO-2024-002', supplier: 'Jay Fabric Mills', date: '10 Mar 2024', exp: '18 Mar 2024', status: 'Confirmed', value: '₹5,80,000' },
  { po: 'PO-2024-003', supplier: 'Kailash Fabrics', date: '08 Mar 2024', exp: '15 Mar 2024', status: 'In Transit', value: '₹3,20,000' },
  { po: 'PO-2024-004', supplier: 'Om Synthetics', date: '05 Mar 2024', exp: '12 Mar 2024', status: 'Received', value: '₹1,75,000' },
  { po: 'PO-2024-005', supplier: 'Aarav Weaves', date: '01 Mar 2024', exp: '08 Mar 2024', status: 'Billed', value: '₹4,10,000' },
];

const STATUS_PILL = {
  Draft: 'bg-amber-50 text-amber-600 border-amber-200',
  Confirmed: 'bg-blue-50 text-blue-600 border-blue-200',
  'In Transit': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Received: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Billed: 'bg-sky-50 text-sky-600 border-sky-200',
};

export const PurchaseOrdersPage = () => {
    const navigate = useNavigate();
    const { purchaseOrders, vendors, addPurchaseOrder, updatePurchaseOrderStatus, cancelPurchaseOrder, deletePurchaseOrder, getPoBilledStatus, convertPurchaseOrderToBill, purchaseBills, paymentOuts, formatCurrency, formatDateDDMMYYYY, getCurrentDateFormatted, getCurrentISODate, addDaysISO } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedPo, setSelectedPo] = useState(null);
    const [printPoTarget, setPrintPoTarget] = useState(null);
    const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
    const [expectedDate, setExpectedDate] = useState(() => addDaysISO(getCurrentISODate(), 10));
    const [lineItems, setLineItems] = useState([]);
    const [query, setQuery] = useState('');
    const [statusMonth, setStatusMonth] = useState('This Month');

    const handleOpenCreateModal = () => {
        setSelectedVendorId(vendors[0]?.id || '');
        setExpectedDate(addDaysISO(getCurrentISODate(), 10));
        setLineItems([]);
        setIsFullscreen(false);
        setShowAddModal(true);
    };

    const handleCloseCreateModal = () => {
        setShowAddModal(false);
        setSelectedVendorId(vendors[0]?.id || '');
        setExpectedDate(addDaysISO(getCurrentISODate(), 10));
        setLineItems([]);
        setIsFullscreen(false);
    };

    const handleClonePo = (po) => {
        setSelectedVendorId(po.vendorId || vendors[0]?.id || '');
        setExpectedDate(po.expectedDate || addDaysISO(getCurrentISODate(), 10));
        setLineItems((po.items || []).map((it) => ({
            ...it,
            id: `li-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        })));
        setIsFullscreen(false);
        setShowAddModal(true);
    };
    const handleCreate = (e) => {
        e.preventDefault();
        const vend = vendors.find((v) => v.id === selectedVendorId) || vendors[0];
        const totalAmt = lineItems.reduce((acc, it) => acc + (it.amount || it.qty * it.rate), 0);
        addPurchaseOrder({
            vendorId: vend?.id,
            vendor: vend?.name || 'Direct Vendor',
            amount: totalAmt > 0 ? totalAmt : 0,
            date: getCurrentDateFormatted(),
            expectedDate: expectedDate || addDaysISO(getCurrentISODate(), 10),
            status: 'Draft',
            items: lineItems,
        });
        handleCloseCreateModal();
    };
    const issuePo = (id) => {
        updatePurchaseOrderStatus(id, 'Issued');
    };
    const handleConvertToBill = (poId) => {
        convertPurchaseOrderToBill(poId);
        navigate('/purchase/bills');
    };
    const getPoTimelineSteps = (po) => {
        const isIssued = po.status !== 'Draft';
        const poStatusInfo = getPoBilledStatus(po.id);
        const linkedBills = poStatusInfo.activeBills || [];
        const isBilled = poStatusInfo.totalBilledQty > 0;
        const latestBill = linkedBills[0];
        const isPaid = latestBill?.status === 'Paid';
        return [
            {
                label: 'Purchase Order',
                docNumber: po.poNumber,
                date: formatDateDDMMYYYY(po.date),
                amount: po.amount,
                status: isIssued ? 'completed' : 'current',
            },
            {
                label: poStatusInfo.status === 'Partially Billed' ? 'Partial Intake & Bill' : 'Supplier Receipt & Bill',
                docNumber: latestBill?.billNumber,
                amount: latestBill?.total || latestBill?.amount,
                status: isBilled ? 'completed' : isIssued ? 'current' : 'pending',
            },
            {
                label: 'Disbursement Payment',
                status: isPaid ? 'completed' : isBilled ? 'current' : 'pending',
            },
        ];
    };
    const getPoRelatedDocs = (po) => {
        const docs = [];
        const poStatusInfo = getPoBilledStatus(po.id);
        (poStatusInfo.activeBills || []).forEach((linkedBill) => {
            docs.push({
                type: 'Purchase Bill',
                number: linkedBill.billNumber,
                amount: linkedBill.total || linkedBill.amount,
                date: formatDateDDMMYYYY(linkedBill.date || linkedBill.billDate),
                status: linkedBill.status,
            });
            const relatedPayments = paymentOuts.filter((p) => p.billId === linkedBill.id || p.billNumber === linkedBill.billNumber);
            relatedPayments.forEach((p) => {
                docs.push({
                    type: 'Payment',
                    number: p.voucherNumber,
                    amount: p.amount,
                    date: formatDateDDMMYYYY(p.date),
                    status: 'Paid',
                });
            });
        });
        return docs;
    };

    const totalPoValue = purchaseOrders.reduce((sum, p) => sum + (p.amount ?? p.total ?? 0), 0);
    const activePoCount = purchaseOrders.filter(p => p.status === 'Issued' || p.status === 'Pending').length;
    const draftPoCount = purchaseOrders.filter(p => p.status === 'Draft').length;
    const receivedPoCount = purchaseOrders.filter(p => p.status === 'Received' || p.status === 'Billed').length;

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return purchaseOrders;
      return purchaseOrders.filter((p) =>
        String(p.poNumber ?? '').toLowerCase().includes(q) || String(p.vendor ?? '').toLowerCase().includes(q));
    }, [purchaseOrders, query]);

    const statusCounts = useMemo(() => {
      if (purchaseOrders.length) {
        const c = { Draft: 0, Confirmed: 0, 'In Transit': 0, Received: 0, Billed: 0 };
        purchaseOrders.forEach((p) => {
          const info = getPoBilledStatus(p.id);
          const s = info.status === 'Issued' ? 'Confirmed' : info.status;
          if (c[s] !== undefined) c[s] += 1;
          else if (p.status === 'Draft') c.Draft += 1;
        });
        return c;
      }
      return { Draft: 16, Confirmed: 36, 'In Transit': 19, Received: 26, Billed: 11 };
    }, [purchaseOrders]);

    const recentRows = useMemo(() => {
      if (purchaseOrders.length) {
        return [...purchaseOrders].slice(-5).reverse().map((p) => ({
          id: p.id,
          po: p.poNumber,
          supplier: p.vendor,
          date: formatDateDDMMYYYY(p.date),
          exp: formatDateDDMMYYYY(p.expectedDate),
          status: (() => { const s = getPoBilledStatus(p.id).status; return s === 'Issued' ? 'Confirmed' : s; })(),
          value: formatCurrency(p.amount ?? p.total ?? 0),
          raw: p,
        }));
      }
      return DEMO_RECENT;
    }, [purchaseOrders]);

    const maxBar = Math.max(1, ...Object.values(statusCounts));
    const barDefs = [
      { k: 'Draft', color: '#93c5fd' },
      { k: 'Confirmed', color: '#3b82f6' },
      { k: 'In Transit', color: '#fbbf24' },
      { k: 'Received', color: '#34d399' },
      { k: 'Billed', color: '#8b5cf6' },
    ];

    const renderRowActions = (p) => {
      const poStatusInfo = getPoBilledStatus(p.id);
      const isCancelled = p.status === 'Cancelled';
      const isFullyBilled = poStatusInfo.status === 'Billed';
      const hasRemaining = poStatusInfo.totalRemainingQty > 0;
      return (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <button onClick={() => setPrintPoTarget(p)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Print Official Purchase Order">
            <Printer size={13}/>
          </button>
          <button onClick={() => handleClonePo(p)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Clone / Reorder this Purchase Order">
            <Copy size={13}/>
          </button>
          {p.status === 'Draft' && (
            <button type="button" onClick={() => deletePurchaseOrder(p.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Draft PO">
              <Trash2 size={13} />
            </button>
          )}
          {p.status === 'Draft' ? (
            <button onClick={() => issuePo(p.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors whitespace-nowrap inline-flex items-center gap-1">
              <Send size={11}/> Issue PO
            </button>
          ) : isCancelled ? (
            <span className="text-xs text-rose-600 font-semibold inline-flex items-center gap-1"><Ban size={11}/> Cancelled</span>
          ) : isFullyBilled ? (
            <span className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-1"><CheckCircle2 size={11}/> Fully Billed</span>
          ) : (
            <div className="flex items-center gap-1">
              {poStatusInfo.totalBilledQty <= 0 && (
                <button onClick={() => cancelPurchaseOrder(p.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Cancel Purchase Order">
                  <Ban size={13}/>
                </button>
              )}
              {hasRemaining && (
                <button onClick={() => handleConvertToBill(p.id)} className="text-xs text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 justify-end whitespace-nowrap">
                  {poStatusInfo.status === 'Partially Billed' ? `Bill Remaining (${poStatusInfo.totalRemainingQty})` : 'Create Bill'} <ArrowRight size={11}/>
                </button>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
    <div className="-m-3 md:-m-5 bg-[#edf3fc] p-3 md:p-5 space-y-4 min-h-[calc(100vh-62px)]">
      {/* breadcrumb */}
      <p className="text-[11px] font-medium text-slate-400">Dashboard <span className="mx-1">›</span> Purchase <span className="mx-1">›</span> <span className="text-slate-600 font-semibold">Orders</span></p>

      {/* header — same clean bar type as dashboard, perfectly blended fabric */}
      <div className="relative overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <img
          src="/guide/febric.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[300px] object-cover object-center sm:block md:w-[380px]"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[300px] bg-gradient-to-r from-white via-white/55 to-transparent sm:block md:w-[380px]" />
        <div className="relative flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="min-w-0 max-w-[640px]">
            <h1 className="flex items-center gap-1.5 text-[20px] font-extrabold tracking-tight text-[#17294e]">
              Purchase Orders Management
              <Info size={15} className="text-blue-500" />
            </h1>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">Issue procurement orders to suppliers for stock intake, manage component line items, and seamlessly convert to vendor bills.</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreateModal} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
            Create Purchase Order
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ShoppingCart} value={totalPoValue ? formatCurrency(totalPoValue) : '₹0.00'} label="Committed Procurement" trend="0%" iconBg="#e8f1fd" iconColor="#2563eb" wave="#cfe3fd" arrowBg="#f2f7ff" arrowColor="#2563eb" />
        <Kpi icon={FileText} value={`${activePoCount} Orders`} label="Active Orders In-Flight" trend="Awaiting dock arrival" iconBg="#e8f1fd" iconColor="#2563eb" wave="#c9ecdf" arrowBg="#f2f7ff" arrowColor="#2563eb" />
        <Kpi icon={Clock} value={`${draftPoCount} Drafts`} label="Draft Orders" trend="" iconBg="#fdf3e0" iconColor="#d97706" wave="#fbe5bd" arrowBg="#fff8ec" arrowColor="#d97706" />
        <Kpi icon={Package} value={`${receivedPoCount} Received`} label="Fulfilled & Billed" trend="Inventory updated" iconBg="#e8f1fd" iconColor="#2563eb" wave="#dcd6fb" arrowBg="#f2f7ff" arrowColor="#2563eb" />
      </div>

      {/* supplier table */}
      <div className="overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3.5">
          <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Supplier Purchase Orders</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PO # or vendor..." className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-blue-400" />
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Filter size={14} /></button>
            <button className="grid h-9 w-6 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"><MoreVertical size={15} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                {['PO Number', 'Supplier / Vendor', 'PO Date', 'Expected Delivery', 'Total Order Value', 'Fulfillment Status', 'Actions / Intake'].map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 ${i >= 4 ? 'text-right' : ''} ${i === 5 ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const info = getPoBilledStatus(p.id);
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5"><button onClick={() => setSelectedPo(p)} className="flex items-center gap-1.5 font-mono font-bold text-blue-600 hover:underline whitespace-nowrap"><ClipboardList size={13} className="text-slate-400" /> {p.poNumber}</button></td>
                    <td className="px-4 py-2.5 font-bold text-slate-700">{p.vendor}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(p.date)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(p.expectedDate)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{formatCurrency(p.amount ?? p.total ?? 0)}</td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge status={info.status} /></td>
                    <td className="px-4 py-2.5">{renderRowActions(p)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500"><FileText size={20} /></div>
                    <p className="mt-3 text-[13px] font-extrabold text-[#17294e]">No records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">There are no records matching your current filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* bottom row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Order Status Overview</h3>
            <div className="relative">
              <select value={statusMonth} onChange={(e) => setStatusMonth(e.target.value)} className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-[11.5px] font-semibold text-slate-600 outline-none">
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Quarter</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="flex w-7 flex-col justify-between py-1 text-right text-[9px] font-semibold text-slate-400">
              {[40, 30, 20, 10, 0].map((t) => <span key={t}>{t}</span>)}
            </div>
            <div className="relative flex-1">
              <div className="absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-t border-slate-100" />)}</div>
              <div className="relative flex h-44 items-end justify-around gap-2 px-2">
                {barDefs.map((b) => (
                  <div key={b.k} className="flex h-full w-12 flex-col items-center justify-end gap-1.5">
                    <div className="w-10 rounded-t-[4px]" style={{ height: `${Math.max(4, (statusCounts[b.k] / maxBar) * 100)}%`, background: b.color }} />
                    <span className="text-[10px] font-medium text-slate-500">{b.k}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] xl:col-span-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Recent Purchase Orders</h3>
            <button className="text-[11px] font-bold text-blue-600 hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                  {['PO Number', 'Supplier', 'PO Date', 'Expected Delivery', 'Status', 'Value', 'Actions'].map((h) => (
                    <th key={h} className="px-2 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentRows.map((r, i) => (
                  <tr key={r.id || r.po || i} className="hover:bg-slate-50/60">
                    <td className="px-2 py-2.5 font-mono text-[11.5px] font-bold text-blue-600">{r.po}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-600">{r.supplier}</td>
                    <td className="px-2 py-2.5 text-slate-500 whitespace-nowrap">{r.date}</td>
                    <td className="px-2 py-2.5 text-slate-500 whitespace-nowrap">{r.exp}</td>
                    <td className="px-2 py-2.5"><span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${STATUS_PILL[r.status] || STATUS_PILL.Draft}`}>{r.status}</span></td>
                    <td className="px-2 py-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">{r.value}</td>
                    <td className="px-2 py-2.5 text-center text-slate-400">•••</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create PO Modal */}
      {showAddModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isFullscreen ? 'w-full h-full rounded-none p-4 sm:p-8' : 'max-w-5xl w-full rounded-2xl p-4 sm:p-6 max-h-[95vh] sm:max-h-[92vh]'
          } text-xs`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Draft New Purchase Order</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition" title={isFullscreen ? "Exit Fullscreen" : "Maximize Fullscreen"}>
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button type="button" onClick={handleCloseCreateModal} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vendor / Supplier *</label>
                  <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.code}) - Terms: {v.paymentTerms}</option>
                    ))}
                  </select>
                  {(() => {
                    const vend = vendors.find(v => v.id === selectedVendorId) || vendors[0];
                    if (!vend) return null;
                    return (
                      <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>{vend.name}</span>
                          <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Terms: {vend.paymentTerms || 'Net 30'}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                          <span>POC: <strong>{vend.contactPerson || 'Vendor Rep'}</strong></span>
                          <span>Email: {vend.email}</span>
                          <span>Phone: {vend.phone}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Intake Date</label>
                  <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-2">Procurement Line Items</label>
                <LineItemEditor items={lineItems} onChange={setLineItems} type="purchase"/>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={handleCloseCreateModal} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm">Save & Issue Purchase Order</button>
              </div>
            </form>
          </div>
        </div>)}

      {/* PO Detail & Lifecycle Modal */}
      {selectedPo && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedPo.poNumber}</h3>
                <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">{selectedPo.vendor}</span>
                <StatusBadge status={selectedPo.status}/>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPrintPoTarget(selectedPo)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 shadow-xs">
                  <Printer size={13}/> Print Official PO
                </button>
                <button onClick={() => setSelectedPo(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18}/></button>
              </div>
            </div>
            <div className="space-y-6 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Supplier / Vendor</span>
                    <strong className="text-slate-900 text-sm block">{selectedPo.vendor}</strong>
                    <div className="text-slate-600 mt-1 flex items-start gap-1">
                      <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>{selectedPo.billingAddress?.line1 || 'Corporate Headquarters'}<br />{selectedPo.billingAddress?.city || 'Mumbai'}, {selectedPo.billingAddress?.state || 'Maharashtra'} - {selectedPo.billingAddress?.pincode || '400001'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Shipment & Delivery Terms</span>
                    <p className="text-slate-700">Expected Delivery: <strong>{formatDateDDMMYYYY(selectedPo.expectedDate)}</strong></p>
                    <p className="text-slate-700">PO Date: <strong>{formatDateDDMMYYYY(selectedPo.date)}</strong></p>
                    <p className="text-slate-700">Status: <strong className="text-slate-900">{selectedPo.status}</strong></p>
                  </div>
                </div>
              </div>
              <DocumentTimeline steps={getPoTimelineSteps(selectedPo)}/>
              <RelatedDocumentsCard documents={getPoRelatedDocs(selectedPo)}/>
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs">Procured Line Items ({selectedPo.items?.length || 0})</h4>
                <LineItemEditor items={selectedPo.items || []} onChange={() => { }} readOnly={true} type="purchase"/>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
              {(() => {
                const poInfo = getPoBilledStatus(selectedPo.id);
                return (
                  <>
                    <div className="font-mono text-xs space-y-0.5">
                      <div>PO Value: <strong className="text-slate-900">{formatCurrency(selectedPo.amount || selectedPo.total || 0)}</strong></div>
                      {poInfo.status === 'Partially Billed' && (
                        <div className="text-[11px] text-amber-700 font-sans font-semibold">Intake Progress: {poInfo.totalBilledQty}/{poInfo.totalOrderedQty} items received ({poInfo.totalRemainingQty} remaining)</div>
                      )}
                    </div>
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                      {selectedPo.status === 'Draft' && (
                        <button type="button" onClick={() => { deletePurchaseOrder(selectedPo.id); setSelectedPo(null); }} className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg font-bold flex items-center gap-1.5">
                          <Trash2 size={13} /> Delete Draft
                        </button>
                      )}
                      {selectedPo.status === 'Draft' && (<Button onClick={() => { issuePo(selectedPo.id); setSelectedPo(null); }}>Issue PO to Vendor</Button>)}
                      {selectedPo.status !== 'Draft' && selectedPo.status !== 'Cancelled' && poInfo.status !== 'Billed' && (
                        <>
                          {poInfo.totalBilledQty <= 0 && (
                            <button type="button" onClick={() => { cancelPurchaseOrder(selectedPo.id); setSelectedPo(null); }} className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg font-bold flex items-center gap-1.5">
                              <Ban size={13} /> Cancel PO
                            </button>
                          )}
                          {poInfo.totalRemainingQty > 0 && (
                            <Button onClick={() => { handleConvertToBill(selectedPo.id); setSelectedPo(null); }}>
                              {poInfo.status === 'Partially Billed' ? `Bill Remaining (${poInfo.totalRemainingQty})` : 'Convert to Vendor Bill & Intake Goods'}
                            </Button>
                          )}
                        </>
                      )}
                      {poInfo.status === 'Billed' && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Fully Billed & Received</span>
                      )}
                      {selectedPo.status === 'Cancelled' && (
                        <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 inline-flex items-center gap-1.5"><Ban size={13} /> Order Cancelled</span>
                      )}
                      <Button variant="outline" onClick={() => setSelectedPo(null)}>Close</Button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>)}

      <PrintPurchaseOrderModal isOpen={Boolean(printPoTarget)} onClose={() => setPrintPoTarget(null)} po={printPoTarget} />
    </div>);
};
