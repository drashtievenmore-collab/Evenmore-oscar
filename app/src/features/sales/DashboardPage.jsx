import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import {
  BarChart3, Banknote, ShoppingCart, Settings, Truck, FileText,
  Landmark, Database, Package, TrendingUp, TrendingDown,
  Factory, ShieldCheck, Users, TriangleAlert, ArrowRight, ChevronDown,
  Layers, ClipboardList, Cog, Boxes, RotateCcw,
} from 'lucide-react';

const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const dayKey = (v) => String(v || '').slice(0, 10);
const isoOf = (d) => d.toISOString().slice(0, 10);
const pctChange = (cur, prev) => {
  if (!prev) return prev === 0 && cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

function Donut({ pct, size = 128, stroke = 13, color = '#22c55e', track = '#e6ecf4', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, pct, vs, tileBg, iconBg, iconColor }) {
  const up = pct >= 0;
  return (
    <div className="rounded-xl p-3" style={{ background: tileBg }}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: iconBg, color: iconColor }}>
          <Icon size={17} />
        </span>
        <span className="text-[11.5px] font-semibold leading-tight text-slate-600">{label}</span>
      </div>
      <div className="mt-2 text-[17px] font-extrabold tracking-tight text-[#17294e]">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] font-bold">
        {up
          ? <TrendingUp size={13} className="text-emerald-600" />
          : <TrendingDown size={13} className="text-rose-500" />}
        <span className={up ? 'text-emerald-600' : 'text-rose-500'}>
          {up ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
        </span>
      </div>
      <div className="mt-0.5 text-[10.5px] font-medium text-slate-500">vs. {vs}</div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, linkTo, linkLabel = 'View Details', children, className = '', iconColor = '#2563eb' }) {
  return (
    <section className={`rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#17294e]">
          <Icon size={16} style={{ color: iconColor }} />
          {title}
        </h3>
        {linkTo && (
          <Link to={linkTo} className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2563eb] hover:underline">
            {linkLabel} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export const DashboardPage = () => {
  const {
    invoices = [], paymentIns = [], purchaseBills = [], deliveryChallans = [],
    expenses = [], items = [], faultyParts = [], bankAccounts = [],
    calculateItemStock, customers = [], vendorBills = [], productionInstructions = [],
  } = useERP();
  const [period, setPeriod] = useState('today');

  const [jobWorkOrders, setJobWorkOrders] = useState([]);
  const [qcList, setQcList] = useState([]);

  useEffect(() => {
    let active = true;
    api.get('/jobwork/orders/', { query: { limit: 200 } })
      .then((res) => {
        if (active) setJobWorkOrders(Array.isArray(res) ? res : res?.results || []);
      })
      .catch(() => {});
    api.get('/inventory/qc/disposition/')
      .then((res) => {
        if (active) setQcList(res?.inspections || res?.data?.inspections || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const now = new Date();
  const todayStr = isoOf(now);
  const yStr = isoOf(new Date(now.getTime() - 86400000));
  const d2Str = isoOf(new Date(now.getTime() - 2 * 86400000));
  const cur = period === 'today' ? todayStr : yStr;
  const prev = period === 'today' ? yStr : d2Str;

  const sumOn = (rows, day, pick) => (rows || [])
    .filter((r) => dayKey(r.date || r.docDate || r.paymentDate || r.orderDate || r.createdAt) === day)
    .reduce((a, r) => a + (Number(pick(r)) || 0), 0);

  const jwoAmt = (j) => Number(j.totalAmount ?? (Number(j.plannedQty || 0) * Number(j.rate || 0))) || 0;
  const freightAmt = (d) => Number(d.freightCharges || d.freight || 0);

  // Live business position figures
  const salesCur = sumOn(invoices, cur, (i) => i.total ?? i.amount);
  const salesPrev = sumOn(invoices, prev, (i) => i.total ?? i.amount);

  const collCur = sumOn(paymentIns, cur, (p) => p.amount);
  const collPrev = sumOn(paymentIns, prev, (p) => p.amount);

  const purchCur = sumOn(purchaseBills, cur, (b) => b.total ?? b.amount);
  const purchPrev = sumOn(purchaseBills, prev, (b) => b.total ?? b.amount);

  const jwCur = sumOn(jobWorkOrders, cur, jwoAmt);
  const jwPrev = sumOn(jobWorkOrders, prev, jwoAmt);

  const transCur = sumOn(deliveryChallans, cur, freightAmt) + sumOn(invoices, cur, freightAmt);
  const transPrev = sumOn(deliveryChallans, prev, freightAmt) + sumOn(invoices, prev, freightAmt);

  const expAmt = (e) => Number(e.amount ?? e.total ?? 0);
  const otherCur = sumOn(expenses, cur, expAmt);
  const otherPrev = sumOn(expenses, prev, expAmt);

  const sales = { today: salesCur, prev: salesPrev };
  const collection = { today: collCur, prev: collPrev };
  const purchase = { today: purchCur, prev: purchPrev };
  const jobWork = { today: jwCur, prev: jwPrev };
  const transport = { today: transCur, prev: transPrev };
  const other = { today: otherCur, prev: otherPrev };

  // Real COGS calculation from invoices on cur and prev days
  const calcInvoiceCogs = (invList, day) => (invList || [])
    .filter((i) => dayKey(i.date || i.docDate || i.createdAt) === day && (i.status || '') !== 'Cancelled')
    .reduce((acc, inv) => {
      const lines = inv.lineItems || inv.items || [];
      const lineCost = lines.reduce((s, line) => {
        const item = items.find((it) => it.id === line.itemId || it.sku === line.itemSku || it.sku === line.sku);
        const unitCost = Number(line.costPrice ?? line.unitCost ?? item?.costPrice ?? 0);
        return s + (Number(line.qty || 0) * unitCost);
      }, 0);
      return acc + lineCost;
    }, 0);

  const curCogs = calcInvoiceCogs(invoices, cur);
  const prevCogs = calcInvoiceCogs(invoices, prev);
  const curGrossProfit = salesCur - curCogs;
  const prevGrossProfit = salesPrev - prevCogs;
  const profit = { today: curGrossProfit, prev: prevGrossProfit };

  const bankBalance = (bankAccounts || []).reduce((a, b) => a + (Number(b.balance ?? b.currentBalance) || 0), 0);
  const stockValue = (items || []).reduce((a, it) => {
    try {
      const calc = typeof calculateItemStock === 'function' ? calculateItemStock(it.id) : null;
      const onHand = calc ? (calc.onHand ?? calc.available ?? 0) : (it.availableQty ?? it.stock ?? 0);
      return a + (Number(it.costPrice ?? it.unitCost) || 0) * onHand;
    } catch { return a; }
  }, 0);

  const unpaid = (invoices || []).filter((i) => (i.status || 'Unpaid') !== 'Paid' && (i.status || '') !== 'Cancelled');
  const unpaidTotal = unpaid.reduce((s, i) => s + (Number(i.total ?? i.amount ?? i.balanceDue ?? 0) || 0), 0);
  const unpaidBills = (purchaseBills || []).filter((b) => (b.status || 'Unpaid') !== 'Paid' && (b.status || '') !== 'Cancelled');
  const unpaidBillsTotal = unpaidBills.reduce((s, b) => s + (Number(b.total ?? b.amount ?? b.balanceDue ?? 0) || 0), 0);

  const funds = bankBalance;
  const workingCapital = Math.max(0, (bankBalance + unpaidTotal + stockValue) - unpaidBillsTotal);
  const stock = Math.round(stockValue);

  /* last 7 days sales & collection, oldest → newest */
  const last7 = Array.from({ length: 7 }, (_, i) => isoOf(new Date(now.getTime() - (6 - i) * 86400000)));
  const sales7 = last7.map((d) => sumOn(invoices, d, (x) => x.total ?? x.amount) / 100000);
  const coll7 = last7.map((d) => sumOn(paymentIns, d, (x) => x.amount) / 100000);
  const maxLakh = Math.max(10, ...sales7, ...coll7);
  const dayLabel = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  };

  /* receivable ageing from real unpaid invoices */
  const buckets = [0, 0, 0, 0, 0];
  unpaid.forEach((i) => {
    const due = new Date(dayKey(i.dueDate || i.date || todayStr));
    const age = Math.max(0, Math.round((now - due) / 86400000));
    const idx = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : age <= 120 ? 3 : 4;
    buckets[idx] += Number(i.balanceDue ?? i.total ?? i.amount ?? 0) || 0;
  });
  const bucketTotal = buckets.reduce((a, b) => a + b, 0);
  const ageing = [
    { label: '0 – 30 Days', amount: Math.round(buckets[0]), pct: bucketTotal > 0 ? Math.round((buckets[0] / bucketTotal) * 100) : 0 },
    { label: '31 – 60 Days', amount: Math.round(buckets[1]), pct: bucketTotal > 0 ? Math.round((buckets[1] / bucketTotal) * 100) : 0 },
    { label: '61 – 90 Days', amount: Math.round(buckets[2]), pct: bucketTotal > 0 ? Math.round((buckets[2] / bucketTotal) * 100) : 0 },
    { label: '91 – 120 Days', amount: Math.round(buckets[3]), pct: bucketTotal > 0 ? Math.round((buckets[3] / bucketTotal) * 100) : 0 },
    { label: '120+ Days', amount: Math.round(buckets[4]), pct: bucketTotal > 0 ? Math.round((buckets[4] / bucketTotal) * 100) : 0 },
  ];

  // Dynamic Production & Job Work stats
  const totalPlannedMeters = (productionInstructions || []).reduce((s, p) => s + (Number(p.assignedQty ?? p.orderMeter ?? 0) || 0), 0)
    + (jobWorkOrders || []).reduce((s, j) => s + (Number(j.plannedQty || 0)), 0);
  const totalProducedMeters = (productionInstructions || []).reduce((s, p) => s + (Number(p.producedQty || 0)), 0)
    + (jobWorkOrders || []).reduce((s, j) => s + ((j.inwards || []).reduce((si, inw) => si + (Number(inw.accepted ?? inw.qty ?? 0)), 0)), 0);
  const totalPendingMeters = Math.max(0, totalPlannedMeters - totalProducedMeters);
  const prodCompletionPct = totalPlannedMeters > 0 ? Math.min(100, Math.round((totalProducedMeters / totalPlannedMeters) * 100)) : 0;

  // Process breakdown from active Job Work Orders
  const jwByProcess = useMemo(() => {
    const map = {};
    (jobWorkOrders || []).forEach((j) => {
      const p = j.process || 'Other';
      const outQty = (j.outwards || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);
      const inwQty = (j.inwards || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
      const pend = Math.max(0, outQty - inwQty);
      map[p] = (map[p] || 0) + pend;
    });
    return Object.entries(map).map(([process, qty]) => ({ process, qty }));
  }, [jobWorkOrders]);

  // Inventory Position breakdown
  const inventoryPosition = useMemo(() => {
    const greyItems = items.filter((it) => /grey|greige/i.test(it.name || it.category || ''));
    const greyVal = greyItems.reduce((s, it) => s + (Number(it.costPrice || 0) * (it.availableQty ?? 0)), 0);
    const greyMtr = greyItems.reduce((s, it) => s + Number(it.availableQty || 0), 0);

    const wipOrders = (jobWorkOrders || []).filter((j) => (j.status || '') === 'In-Process');
    const wipMtr = wipOrders.reduce((s, j) => {
      const out = (j.outwards || []).reduce((so, o) => so + Number(o.qty || 0), 0);
      const inw = (j.inwards || []).reduce((si, i) => si + Number(i.qty || 0), 0);
      return s + Math.max(0, out - inw);
    }, 0);
    const wipVal = wipOrders.reduce((s, j) => s + Number(j.totalAmount || 0), 0);

    const holdItems = qcList.filter((q) => Number(q.holdQty || 0) > 0);
    const holdMtr = holdItems.reduce((s, q) => s + Number(q.holdQty || 0), 0);
    const holdVal = holdMtr * 45;

    const finItems = items.filter((it) => it.itemKind === 'Fabric' || /finish|dyed|print/i.test(it.name || it.category || ''));
    const finVal = finItems.reduce((s, it) => s + (Number(it.costPrice || 0) * (it.availableQty ?? 0)), 0);
    const finMtr = finItems.reduce((s, it) => s + Number(it.availableQty || 0), 0);

    const repMtr = qcList.reduce((s, q) => s + Number(q.reprocessQty || 0), 0);
    const repVal = repMtr * 35;

    return [
      { icon: Layers, tint: '#e8f1fd', fg: '#2563eb', l: 'Grey Stock', v: inr(greyVal), s: `${Math.round(greyMtr).toLocaleString('en-IN')} mtr` },
      { icon: ClipboardList, tint: '#e7f6ec', fg: '#16a34a', l: 'External WIP', v: inr(wipVal), s: `${Math.round(wipMtr).toLocaleString('en-IN')} mtr` },
      { icon: Cog, tint: '#fdf3e0', fg: '#d97706', l: 'QC Hold', v: inr(holdVal), s: `${Math.round(holdMtr).toLocaleString('en-IN')} mtr` },
      { icon: Boxes, tint: '#e7f6ef', fg: '#0d9488', l: 'Finished Stock', v: inr(finVal), s: `${Math.round(finMtr).toLocaleString('en-IN')} mtr` },
      { icon: RotateCcw, tint: '#fdeeee', fg: '#ef4444', l: 'Reprocess', v: inr(repVal), s: `${Math.round(repMtr).toLocaleString('en-IN')} mtr` },
    ];
  }, [items, jobWorkOrders, qcList]);

  // QC & Wastage stats
  const qcStats = useMemo(() => {
    const received = qcList.reduce((s, q) => s + Number(q.inspectedQty ?? q.receivedQty ?? 0), 0);
    const good = qcList.reduce((s, q) => s + Number(q.goodQty ?? 0), 0);
    const reprocess = qcList.reduce((s, q) => s + Number(q.reprocessQty ?? 0), 0);
    const reject = qcList.reduce((s, q) => s + Number(q.rejectedQty ?? 0), 0);
    const loss = Math.max(0, received - good - reprocess);
    const yieldPct = received > 0 ? ((good / received) * 100).toFixed(1) : '100.0';
    const lossPct = received > 0 ? ((loss / received) * 100).toFixed(1) : '0.0';
    return { received, good, reprocess, reject, loss, yieldPct, lossPct };
  }, [qcList]);

  // Real Attention counts
  const overdueCount = unpaid.filter((i) => new Date(dayKey(i.dueDate || i.date)) < new Date(todayStr)).length;
  const delayedJwCount = (jobWorkOrders || []).filter((j) => (j.status || '') === 'In-Process' && j.expectedCompletion && j.expectedCompletion < todayStr).length;
  const highWastageCount = qcList.filter((q) => Number(q.rejectedQty || 0) > 0).length;
  const reprocessLotsCount = qcList.filter((q) => Number(q.reprocessQty || 0) > 0).length + (faultyParts || []).filter((f) => f.status === 'Reported').length;
  const creditExceededCount = (customers || []).filter((c) => Number(c.creditLimit) > 0 && Number(c.balance || 0) > Number(c.creditLimit)).length;
  const mismatchBillCount = (vendorBills || []).filter((b) => b.matchingStatus === 'Mismatch' || b.status === 'Pending Verification').length;
  const lowCount = (items || []).filter((it) => {
    try {
      const c = typeof calculateItemStock === 'function' ? calculateItemStock(it.id) : null;
      const av = c ? c.available : (it.availableQty ?? 0);
      return av <= (it.reorderLevel || 5);
    } catch { return false; }
  }).length;
  const missingProdCount = (productionInstructions || []).filter((p) => p.status === 'In Progress' && !p.producedQty).length;

  const attention = [
    { label: 'Production updates missing', count: missingProdCount },
    { label: 'Job works delayed', count: delayedJwCount },
    { label: 'High wastage lots', count: highWastageCount },
    { label: 'QC lots require reprocess', count: reprocessLotsCount },
    { label: 'Customers exceeded credit limit', count: creditExceededCount },
    { label: 'Overdue receivables', count: overdueCount },
    { label: "Vendor invoices don't match", count: mismatchBillCount },
    { label: 'Finished lots are slow-moving', count: lowCount },
  ];

  const kpis = [
    { icon: BarChart3, label: "Today's Sales", v: sales, tileBg: '#e9f1fd', iconBg: '#d9e8fd', iconColor: '#2563eb' },
    { icon: Banknote, label: 'Collection', v: collection, tileBg: '#e7f6ec', iconBg: '#d3efdb', iconColor: '#16a34a' },
    { icon: ShoppingCart, label: 'Purchase', v: purchase, tileBg: '#fdeeee', iconBg: '#fbdcdc', iconColor: '#ef4444' },
    { icon: Settings, label: 'Job Work Expense', v: jobWork, tileBg: '#efe9fd', iconBg: '#ddd0fa', iconColor: '#7c3aed' },
    { icon: Truck, label: 'Transport', v: transport, tileBg: '#fdf3e0', iconBg: '#fbe5bd', iconColor: '#d97706' },
    { icon: FileText, label: 'Other Expense', v: other, tileBg: '#e7f6ef', iconBg: '#d2efe0', iconColor: '#0d9488' },
  ];

  return (
    <div className="-m-3 md:-m-5 bg-[#edf3fc] p-3 md:p-5 space-y-3 min-h-[calc(100vh-62px)]">
      {/* header — clean white bar with perfectly blended fabric accent */}
      <div className="relative overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <img
          src="/guide/febric.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[300px] object-cover object-center sm:block md:w-[380px]"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[300px] bg-gradient-to-r from-white via-white/55 to-transparent sm:block md:w-[380px]" />
        <div className="relative flex flex-wrap items-start justify-between gap-3 p-4">
          <div>
            <h1 className="text-[21px] font-extrabold tracking-tight text-[#17294e]">Good Morning, Admin 👋</h1>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Here&apos;s today&apos;s real-time business position for Oscar Textile.</p>
          </div>
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none rounded-lg border border-[#dce5f4] bg-white py-2 pl-3.5 pr-9 text-[12.5px] font-semibold text-slate-700 shadow-xs outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* today's business position */}
      <section className="rounded-xl border border-[#e2eaf5] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <h2 className="mb-3 px-0.5 text-[13px] font-extrabold text-[#17294e]">Today&apos;s Business Position</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((k) => (
            <KpiTile
              key={k.label} icon={k.icon} label={k.label}
              value={inr(k.v.today)} pct={pctChange(k.v.today, k.v.prev)}
              vs={inr(k.v.prev)} tileBg={k.tileBg} iconBg={k.iconBg} iconColor={k.iconColor}
            />
          ))}
        </div>
      </section>

      {/* funds row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Landmark, label: 'Funds Position', value: inr(funds), sub: 'Available Cash & Bank', bg: '#e8f1fd', fg: '#2563eb' },
          { icon: Database, label: 'Working Capital', value: inr(workingCapital), sub: 'Current Assets − Current Liab.', bg: '#e7f6ef', fg: '#0d9488' },
          { icon: Package, label: 'Stock Value', value: inr(stock), sub: 'Total Inventory Value', bg: '#e7f6ec', fg: '#16a34a' },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: c.bg, color: c.fg }}>
              <c.icon size={21} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500">{c.label}</p>
              <p className="truncate text-[18px] font-extrabold tracking-tight text-[#17294e]">{c.value}</p>
              <p className="text-[11px] text-slate-400">{c.sub}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#efe9fd] text-violet-600">
            <BarChart3 size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-500">Gross Profit (Today)</p>
            <p className="truncate text-[18px] font-extrabold tracking-tight text-[#17294e]">{inr(profit.today)}</p>
          </div>
          <div className="text-right text-[11px] font-bold">
            <span className="flex items-center justify-end gap-0.5 text-emerald-600">
              <TrendingUp size={12} /> {Math.abs(pctChange(profit.today, profit.prev)).toFixed(1)}%
            </span>
            <span className="font-medium text-slate-400">vs. {inr(profit.prev)}</span>
          </div>
        </div>
      </div>

      {/* production / inventory / qc */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SectionCard icon={Factory} title="Production & Job Work" linkTo="/pms">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <Donut pct={prodCompletionPct}>
                <strong className="text-[21px] font-extrabold text-[#17294e]">{prodCompletionPct}%</strong>
              </Donut>
              <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">Production<br />Completion</p>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-[12px] font-medium text-slate-600">
              {[
                ['Planned', `${Math.round(totalPlannedMeters).toLocaleString('en-IN')} m`, '#2563eb'],
                ['Produced', `${Math.round(totalProducedMeters).toLocaleString('en-IN')} m`, '#22c55e'],
                ['Pending', `${Math.round(totalPendingMeters).toLocaleString('en-IN')} m`, '#f59e0b'],
              ].map(([l, v, c]) => (
                <li key={l} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
                  <span className="font-bold text-slate-800">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[12px] font-bold text-slate-700">Job Work (In Process)</p>
            {jwByProcess.length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1">No active job work orders in process.</p>
            ) : (
              <ul className="space-y-1.5 text-[12px] font-medium text-slate-600">
                {jwByProcess.slice(0, 4).map(({ process, qty }, idx) => {
                  const colors = ['#2563eb', '#22c55e', '#f59e0b', '#7c3aed'];
                  return (
                    <li key={process} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <i className="h-2 w-2 rounded-full" style={{ background: colors[idx % colors.length] }} />
                        {process}
                      </span>
                      <span className="font-bold text-slate-800">{Math.round(qty).toLocaleString('en-IN')} m</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={Package} title="Inventory Position (Value)" linkTo="/inventory/stock-position">
          <ul className="divide-y divide-slate-100">
            {inventoryPosition.map((r) => (
              <li key={r.l}>
                <Link to="/inventory/stock-position" className="group flex items-center gap-3 py-[9px]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: r.tint, color: r.fg }}>
                    <r.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold text-slate-700">{r.l}</span>
                    <span className="block text-[11px] text-slate-400">{r.s}</span>
                  </span>
                  <span className="text-[13px] font-extrabold text-[#17294e]">{r.v}</span>
                  <ArrowRight size={13} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="QC & Wastage (Inspection Summary)" linkTo="/inventory/faulty-parts">
          <div className="flex items-center gap-4">
            <Donut pct={Number(qcStats.yieldPct) || 100}>
              <strong className="text-[18px] font-extrabold text-[#17294e]">{qcStats.yieldPct}%</strong>
              <span className="text-[10.5px] font-medium text-slate-500">Good Yield</span>
            </Donut>
            <ul className="min-w-0 flex-1 space-y-1.5 text-[12px] font-medium text-slate-600">
              {[
                ['Received', `${Math.round(qcStats.received).toLocaleString('en-IN')} m`],
                ['Good', `${Math.round(qcStats.good).toLocaleString('en-IN')} m`],
                ['Reprocess', `${Math.round(qcStats.reprocess).toLocaleString('en-IN')} m`],
                ['Reject', `${Math.round(qcStats.reject).toLocaleString('en-IN')} m`],
                ['Loss', `${Math.round(qcStats.loss).toLocaleString('en-IN')} m`],
              ].map(([l, v]) => (
                <li key={l} className="flex items-center justify-between gap-2">
                  <span>{l}</span><span className="font-bold text-slate-800">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#dc2626]">
            <TriangleAlert size={14} /> {qcStats.lossPct}% Process Loss
          </div>
        </SectionCard>
      </div>

      {/* sales chart / ageing / attention */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SectionCard icon={BarChart3} title="Sales & Collection (Last 7 Days)" linkTo="/sales/invoices">
          <div className="mb-2 flex items-center gap-4 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#2563eb]" />Sales</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#34d399]" />Collection</span>
          </div>
          <div className="flex gap-1.5">
            <div className="flex w-7 flex-col justify-between py-0.5 text-right text-[9px] font-semibold text-slate-400">
              {[maxLakh, Math.round(maxLakh * 0.75), Math.round(maxLakh * 0.5), Math.round(maxLakh * 0.25), 0].map((t) => <span key={t}>{t}</span>)}
            </div>
            <div className="relative flex-1">
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-t border-dashed border-slate-100" />)}
              </div>
              <div className="relative flex h-40 items-end gap-1.5">
                {sales7.map((s, i) => {
                  const c = coll7[i] || 0;
                  const h = (v) => `${Math.max(2, (v / maxLakh) * 100)}%`;
                  return (
                    <div key={last7[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div className="flex w-full max-w-[46px] flex-1 items-end justify-center gap-1">
                        <div className="w-1/2 rounded-t-[4px] bg-[#2563eb]" style={{ height: h(s) }} title={`Sales ₹${s.toFixed(2)}L`} />
                        <div className="w-1/2 rounded-t-[4px] bg-[#34d399]" style={{ height: h(c) }} title={`Collection ₹${c.toFixed(2)}L`} />
                      </div>
                      <span className="text-[8.5px] font-semibold text-slate-400">{dayLabel(last7[i])}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-slate-400">₹ in Lakhs</p>
        </SectionCard>

        <SectionCard icon={Users} title="Customer Receivable Ageing" linkTo="/sales/invoices">
          {bucketTotal === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No outstanding receivables. All invoices are settled.
            </div>
          ) : (
            <ul className="space-y-3 pt-1">
              {ageing.map((b, i) => {
                const colors = ['#22c55e', '#38bdf6', '#facc15', '#fb923c', '#f87171'];
                return (
                  <li key={b.label} className="flex items-center gap-2 text-[12px]">
                    <span className="w-[84px] shrink-0 font-medium text-slate-500">{b.label}</span>
                    <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#eef2f7]">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(b.pct > 0 ? 6 : 0, b.pct))}%`, background: colors[i % colors.length] }} />
                    </span>
                    <span className="w-[84px] shrink-0 text-right font-extrabold text-[#17294e]">{inr(b.amount)}</span>
                    <span className="w-[40px] shrink-0 text-right text-[11px] font-semibold text-slate-400">({b.pct}%)</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <section className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#dc2626]">
              <TriangleAlert size={16} /> Attention Required
            </h3>
            <Link to="/reports" className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2563eb] hover:underline">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {attention.map((a) => (
              <li key={a.label} className="flex items-center gap-2 py-[6.5px] text-[12.5px] font-medium text-slate-600">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#fdeeee] text-[#dc2626]">
                  <TriangleAlert size={11} />
                </span>
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                <span className={`font-extrabold ${a.count > 0 ? 'text-[#dc2626]' : 'text-slate-400'}`}>{a.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
