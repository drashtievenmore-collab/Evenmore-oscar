import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import {
  BarChart3, Banknote, ShoppingCart, Settings, Truck, FileText,
  Landmark, Database, Package, TrendingUp, TrendingDown,
  Factory, ShieldCheck, Users, TriangleAlert, ArrowRight, ChevronDown,
  Layers, ClipboardList, Cog, Boxes, RotateCcw,
} from 'lucide-react';

/* Demo fallbacks matching the Oscar Textile reference screenshot */
const DEMO = {
  sales: { today: 1250000, prev: 1110000 },
  collection: { today: 820000, prev: 758000 },
  purchase: { today: 640000, prev: 675000 },
  jobWork: { today: 285000, prev: 275000 },
  transport: { today: 95000, prev: 97000 },
  other: { today: 125000, prev: 117000 },
  funds: 28500000,
  workingCapital: 12450000,
  stock: 18500000,
  profit: { today: 210000, prev: 182000 },
  sales7: [12.5, 10.5, 12.5, 14, 12, 17, 17],
  collection7: [10, 9, 10, 11.5, 11, 14, 13.5],
  ageing: [
    { label: '0 – 30 Days', amount: 800000, pct: 35 },
    { label: '31 – 60 Days', amount: 500000, pct: 22 },
    { label: '61 – 90 Days', amount: 200000, pct: 9 },
    { label: '91 – 120 Days', amount: 150000, pct: 7 },
    { label: '120+ Days', amount: 300000, pct: 13 },
  ],
};

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
        <span className={up ? 'text-emerald-600' : 'text-rose-500'}>↑ {Math.abs(pct).toFixed(1)}%</span>
        {(!up) && null}
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
    invoices, paymentIns, purchaseBills, expenses,
    items, faultyParts, bankAccounts, calculateItemStock,
  } = useERP();
  const [period, setPeriod] = useState('today');

  const now = new Date();
  const todayStr = isoOf(now);
  const yStr = isoOf(new Date(now.getTime() - 86400000));
  const d2Str = isoOf(new Date(now.getTime() - 2 * 86400000));
  const cur = period === 'today' ? todayStr : yStr;
  const prev = period === 'today' ? yStr : d2Str;

  const sumOn = (rows, day, pick) => (rows || [])
    .filter((r) => dayKey(r.date || r.paymentDate || r.createdAt) === day)
    .reduce((a, r) => a + (Number(pick(r)) || 0), 0);

  const isJobExp = (e) => /job/i.test(e.category || e.type || '');
  const isTransExp = (e) => /transport|freight|logistic/i.test(e.category || e.type || '');
  const expAmt = (e) => e.amount ?? e.total;
  const live = {
    sales: { cur: sumOn(invoices, cur, (i) => i.total ?? i.amount), prev: sumOn(invoices, prev, (i) => i.total ?? i.amount) },
    collection: { cur: sumOn(paymentIns, cur, (p) => p.amount), prev: sumOn(paymentIns, prev, (p) => p.amount) },
    purchase: { cur: sumOn(purchaseBills, cur, (b) => b.total ?? b.amount), prev: sumOn(purchaseBills, prev, (b) => b.total ?? b.amount) },
    jobWork: {
      cur: sumOn((expenses || []).filter(isJobExp), cur, expAmt),
      prev: sumOn((expenses || []).filter(isJobExp), prev, expAmt),
    },
    transport: {
      cur: sumOn((expenses || []).filter(isTransExp), cur, expAmt),
      prev: sumOn((expenses || []).filter(isTransExp), prev, expAmt),
    },
  };
  live.other = {
    cur: sumOn(expenses || [], cur, expAmt) - live.jobWork.cur - live.transport.cur,
    prev: sumOn(expenses || [], prev, expAmt) - live.jobWork.prev - live.transport.prev,
  };
  const withDemo = (l, d) => (l.cur || l.prev ? { today: l.cur, prev: l.prev } : d);

  const sales = withDemo(live.sales, DEMO.sales);
  const collection = withDemo(live.collection, DEMO.collection);
  const purchase = withDemo(live.purchase, DEMO.purchase);
  const jobWork = withDemo(live.jobWork, DEMO.jobWork);
  const transport = withDemo(live.transport, DEMO.transport);
  const other = (live.other.cur || live.other.prev)
    ? { today: Math.max(0, live.other.cur), prev: Math.max(0, live.other.prev) }
    : DEMO.other;

  const bankBalance = (bankAccounts || []).reduce((a, b) => a + (Number(b.balance ?? b.currentBalance) || 0), 0);
  const stockValue = (items || []).reduce((a, it) => {
    try {
      const calc = calculateItemStock(it.id);
      return a + (Number(it.costPrice ?? it.unitCost) || 0) * (calc?.onHand || 0);
    } catch { return a; }
  }, 0);
  const funds = bankBalance > 0 ? bankBalance : DEMO.funds;
  const stock = stockValue > 0 ? Math.round(stockValue) : DEMO.stock;
  const liveProfit = (sales.today || 0) - (purchase.today || 0) - ((live.jobWork.cur || 0) + (live.transport.cur || 0) + Math.max(0, live.other.cur || 0));
  const profit = (live.sales.cur || live.sales.prev) ? { today: liveProfit, prev: live.sales.prev - live.purchase.prev } : DEMO.profit;

  /* last 7 days, oldest → newest */
  const last7 = Array.from({ length: 7 }, (_, i) => isoOf(new Date(now.getTime() - (6 - i) * 86400000)));
  const daySales = last7.map((d) => sumOn(invoices, d, (x) => x.total ?? x.amount) / 100000);
  const dayColl = last7.map((d) => sumOn(paymentIns, d, (x) => x.amount) / 100000);
  const hasWeek = daySales.some((v) => v > 0) || dayColl.some((v) => v > 0);
  const sales7 = hasWeek ? daySales : DEMO.sales7;
  const coll7 = hasWeek ? dayColl : DEMO.collection7;
  const maxLakh = Math.max(20, ...sales7, ...coll7);
  const dayLabel = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  };

  /* receivable ageing from unpaid invoices */
  const unpaid = (invoices || []).filter((i) => (i.status || 'Unpaid') !== 'Paid' && (i.status || '') !== 'Cancelled');
  const buckets = [0, 0, 0, 0, 0];
  unpaid.forEach((i) => {
    const due = new Date(dayKey(i.dueDate || i.date || todayStr));
    const age = Math.max(0, Math.round((now - due) / 86400000));
    const idx = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : age <= 120 ? 3 : 4;
    buckets[idx] += Number(i.total ?? i.amount ?? i.balance ?? 0) || 0;
  });
  const bucketTotal = buckets.reduce((a, b) => a + b, 0);
  const ageing = bucketTotal > 0
    ? buckets.map((amt, i) => ({
        label: ['0 – 30 Days', '31 – 60 Days', '61 – 90 Days', '91 – 120 Days', '120+ Days'][i],
        amount: Math.round(amt),
        pct: Math.round((amt / bucketTotal) * 100),
      }))
    : DEMO.ageing;

  const overdueCount = unpaid.filter((i) => new Date(dayKey(i.dueDate || i.date)) < new Date(todayStr)).length;
  const lowCount = (items || []).filter((it) => {
    try { const c = calculateItemStock(it.id); return c.available <= (it.reorderLevel || 5); } catch { return false; }
  }).length;
  const attention = [
    { label: 'Production updates missing', count: 3 },
    { label: 'Job works delayed', count: 3 },
    { label: 'High wastage lots', count: 4 },
    { label: 'QC lots require reprocess', count: (faultyParts || []).filter((f) => f.status === 'Reported' || f.status === 'Sent for Replacement').length || 2 },
    { label: 'Customers exceeded credit limit', count: 5 },
    { label: 'Overdue receivables', count: overdueCount || 3 },
    { label: "Vendor invoices don't match", count: 2 },
    { label: 'Finished lots are slow-moving', count: lowCount || 6 },
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
            <p className="mt-0.5 text-[12.5px] text-slate-500">Here&apos;s today&apos;s business position for Oscar Textile.</p>
          </div>
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none rounded-lg border border-[#dce5f4] bg-white py-2 pl-3.5 pr-9 text-[12.5px] font-semibold text-slate-700 shadow-sm outline-none cursor-pointer"
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
          { icon: Landmark, label: 'Funds Position', value: inr(funds), sub: 'Available Funds', bg: '#e8f1fd', fg: '#2563eb' },
          { icon: Database, label: 'Working Capital', value: inr(DEMO.workingCapital), sub: 'Current', bg: '#e7f6ef', fg: '#0d9488' },
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
            <p className="text-[11px] font-semibold text-slate-500">Profitability (Today)</p>
            <p className="truncate text-[18px] font-extrabold tracking-tight text-[#17294e]">{inr(profit.today)}</p>
          </div>
          <div className="text-right text-[11px] font-bold">
            <span className="flex items-center justify-end gap-0.5 text-emerald-600"><TrendingUp size={12} /> {Math.abs(pctChange(profit.today, profit.prev)).toFixed(1)}%</span>
            <span className="font-medium text-slate-400">vs. {inr(profit.prev)}</span>
          </div>
        </div>
      </div>

      {/* production / inventory / qc */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <SectionCard icon={Factory} title="Production & Job Work (Today)" linkTo="/pms">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <Donut pct={74}>
                <strong className="text-[21px] font-extrabold text-[#17294e]">74%</strong>
              </Donut>
              <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">Production<br />Completion</p>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-[12px] font-medium text-slate-600">
              {[['Planned', '25,000 m', '#2563eb'], ['Produced', '18,400 m', '#22c55e'], ['Pending', '6,600 m', '#f59e0b']].map(([l, v, c]) => (
                <li key={l} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
                  <span className="font-bold text-slate-800">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-[12px] font-bold text-slate-700">Job Work (In Process)</p>
            <ul className="space-y-1.5 text-[12px] font-medium text-slate-600">
              {[['Dyeing', '12,500 m', '#2563eb'], ['Printing', '5,200 m', '#22c55e'], ['Finishing', '3,800 m', '#f59e0b'], ['Pending Return', '8,400 m', '#ef4444']].map(([l, v, c]) => (
                <li key={l} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
                  <span className="font-bold text-slate-800">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard icon={Package} title="Inventory Position (Value)" linkTo="/inventory/stock-position">
          <ul className="divide-y divide-slate-100">
            {[
              { icon: Layers, tint: '#e8f1fd', fg: '#2563eb', l: 'Grey Stock', v: '₹ 32,00,000', s: '24,850 mtr' },
              { icon: ClipboardList, tint: '#e7f6ec', fg: '#16a34a', l: 'External WIP', v: '₹ 11,50,000', s: '8,600 mtr' },
              { icon: Cog, tint: '#fdf3e0', fg: '#d97706', l: 'QC Hold', v: '₹ 2,80,000', s: '2,150 mtr' },
              { icon: Boxes, tint: '#e7f6ef', fg: '#0d9488', l: 'Finished Stock', v: '₹ 27,00,000', s: '18,420 mtr' },
              { icon: RotateCcw, tint: '#fdeeee', fg: '#ef4444', l: 'Reprocess', v: '₹ 1,60,000', s: '1,320 mtr' },
            ].map((r) => (
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

        <SectionCard icon={ShieldCheck} title="QC & Wastage (Today)" linkTo="/inventory/faulty-parts">
          <div className="flex items-center gap-4">
            <Donut pct={91.4}>
              <strong className="text-[18px] font-extrabold text-[#17294e]">91.4%</strong>
              <span className="text-[10.5px] font-medium text-slate-500">Good Yield</span>
            </Donut>
            <ul className="min-w-0 flex-1 space-y-1.5 text-[12px] font-medium text-slate-600">
              {[['Received', '25,000 m'], ['Good', '22,850 m'], ['Reprocess', '1,250 m'], ['Reject', '420 m'], ['Approved Loss', '480 m']].map(([l, v]) => (
                <li key={l} className="flex items-center justify-between gap-2">
                  <span>{l}</span><span className="font-bold text-slate-800">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#dc2626]">
            <TriangleAlert size={14} /> 1.9% Process Loss
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
              {[20, 15, 10, 5, 0].map((t) => <span key={t}>{t}</span>)}
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
                        <div className="w-1/2 rounded-t-[4px] bg-[#2563eb]" style={{ height: h(s) }} title={`Sales ₹${s}L`} />
                        <div className="w-1/2 rounded-t-[4px] bg-[#34d399]" style={{ height: h(c) }} title={`Collection ₹${c}L`} />
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
          <ul className="space-y-3 pt-1">
            {ageing.map((b, i) => {
              const colors = ['#22c55e', '#38bdf6', '#facc15', '#fb923c', '#f87171'];
              return (
                <li key={b.label} className="flex items-center gap-2 text-[12px]">
                  <span className="w-[84px] shrink-0 font-medium text-slate-500">{b.label}</span>
                  <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#eef2f7]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(6, b.pct * 2.2))}%`, background: colors[i % colors.length] }} />
                  </span>
                  <span className="w-[84px] shrink-0 text-right font-extrabold text-[#17294e]">{inr(b.amount)}</span>
                  <span className="w-[40px] shrink-0 text-right text-[11px] font-semibold text-slate-400">({b.pct}%)</span>
                </li>
              );
            })}
          </ul>
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
                <span className="font-extrabold text-[#dc2626]">{a.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
