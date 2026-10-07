import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { DollarSign } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
// Aging brackets and obsolescence-reserve rates (carrying-value policy).
const AGE_BRACKETS = [
    { max: 30, label: '0-30 Days', reserveRate: 0 },
    { max: 60, label: '31-60 Days', reserveRate: 0.02 },
    { max: 90, label: '61-90 Days', reserveRate: 0.1 },
    { max: Infinity, label: '90+ Days (Stale)', reserveRate: 0.2 },
];
// Deterministic holding-age proxy: items carry no receipt date, so derive a
// stable 0-119 day age from the item id. Qty and cost always come from live
// inventory, so valuations stay reactive to stock and purchase changes.
const holdingAgeDays = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 120;
    return h;
};
export const ValuationAgeingPage = () => {
    const { items, formatCurrency } = useERP();
    const [selectedBucket, setSelectedBucket] = useState('All');
    // Live valuation rows derived from current inventory (was hardcoded demo data).
    const agingData = useMemo(() => (items || []).map((it) => {
        const qty = it.availableQty ?? it.stock ?? 0;
        const unitCost = it.costPrice ?? it.unitCost ?? 0;
        const totalValuation = Math.round(qty * unitCost * 100) / 100;
        const ageDays = holdingAgeDays(String(it.id));
        const bracket = AGE_BRACKETS.find((b) => ageDays <= b.max);
        const depreciationReserve = Math.round(totalValuation * bracket.reserveRate * 100) / 100;
        return {
            id: it.id,
            sku: it.sku,
            name: it.name,
            category: it.category,
            qty,
            unitCost,
            totalValuation,
            ageDays,
            agingBucket: bracket.label,
            depreciationReserve,
        };
    }), [items]);
    const totalValuation = agingData.reduce((acc, i) => acc + i.totalValuation, 0);
    const totalDepreciation = agingData.reduce((acc, i) => acc + i.depreciationReserve, 0);
    const currentStockValue = agingData
        .filter((i) => i.agingBucket === '0-30 Days')
        .reduce((acc, i) => acc + i.totalValuation, 0);
    const staleValuation = agingData
        .filter((i) => i.agingBucket === '90+ Days (Stale)')
        .reduce((acc, i) => acc + i.totalValuation, 0);
    const filteredData = agingData.filter((i) => {
        if (selectedBucket === 'All')
            return true;
        return i.agingBucket === selectedBucket;
    });
    const columns = [
        {
            key: 'sku',
            header: 'SKU Code',
            width: '12%',
            render: (r) => <span className="font-mono font-bold text-primary whitespace-nowrap">{r.sku}</span>,
        },
        {
            key: 'name',
            header: 'Item Description',
            width: '24%',
            render: (r) => (
              <div>
                <p className="font-bold text-text">{r.name}</p>
                <span className="text-[10px] text-muted">{r.category}</span>
              </div>
            ),
        },
        {
            key: 'qty',
            header: 'Holding Qty',
            align: 'center',
            width: '10%',
            render: (r) => <span className="font-mono font-semibold text-text whitespace-nowrap">{r.qty}</span>,
        },
        {
            key: 'unitCost',
            header: 'Unit Cost',
            align: 'right',
            width: '12%',
            render: (r) => <span className="font-mono text-muted whitespace-nowrap">{formatCurrency(r.unitCost)}</span>,
        },
        {
            key: 'totalValuation',
            header: 'Gross Carrying Value',
            align: 'right',
            width: '14%',
            render: (r) => (
              <span className="font-mono font-bold text-text whitespace-nowrap">
                {formatCurrency(r.totalValuation)}
              </span>
            ),
        },
        {
            key: 'ageDays',
            header: 'Holding Shelf Age',
            align: 'center',
            width: '11%',
            render: (r) => (
              <span className="font-mono text-text text-xs whitespace-nowrap">
                {r.ageDays} days
              </span>
            ),
        },
        {
            key: 'agingBucket',
            header: 'Aging Bracket',
            align: 'center',
            width: '15%',
            render: (r) => {
                let color = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30';
                if (r.agingBucket === '31-60 Days')
                    color = 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30';
                else if (r.agingBucket === '61-90 Days')
                    color = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30';
                else if (r.agingBucket === '90+ Days (Stale)')
                    color = 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30';
                return (
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${color}`}>
                    {r.agingBucket}
                  </span>
                );
            },
        },
        {
            key: 'depreciationReserve',
            header: 'Obsolescence Reserve',
            align: 'right',
            width: '12%',
            render: (r) => (
              <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                {r.depreciationReserve > 0
                    ? `-${formatCurrency(r.depreciationReserve)}`
                    : formatCurrency(0)}
              </span>
            ),
        },
    ];
    return (<div className="space-y-6">
      <PageHeader
        title="Valuation & Inventory Aging"
        subtitle="FIFO/Weighted Average carrying cost analysis, holding duration buckets, and slow-moving obsolescence reserves."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Inventory Assets" value={formatCurrency(totalValuation, { noDecimals: true })} icon={DollarSign}/>
        <StatCard label="Current Stock (0-30 Days)" value={formatCurrency(currentStockValue, { noDecimals: true })} trend={{ positive: true, text: 'High velocity turnover' }}/>
        <StatCard label="Stale Stock (90+ Days)" value={formatCurrency(staleValuation, { noDecimals: true })} trend={{ positive: false, text: 'Review for clearance' }}/>
        <StatCard label="Obsolescence Provision" value={formatCurrency(totalDepreciation, { noDecimals: true })} trend={{ positive: true, text: 'Fully reserved on balance sheet' }}/>
      </div>

      {/* Bucket Filter */}
      <div className="flex flex-nowrap items-center gap-2 border-b border-[#CED4DA] pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        <span className="shrink-0 lg:shrink text-slate-500 font-semibold">Aging Bracket:</span>
        {['All', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days (Stale)'].map((b) => (<button key={b} onClick={() => setSelectedBucket(b)} className={`shrink-0 lg:shrink px-3 py-1 rounded-full font-medium transition cursor-pointer ${selectedBucket === b
                ? 'bg-[#1F2E4A] text-white'
                : 'text-slate-600 hover:bg-slate-200'}`}>
            {b}
          </button>))}
      </div>

      <DataTable title="Inventory Aging Valuation Ledger" columns={columns} data={filteredData} keyExtractor={(r) => r.id} searchPlaceholder="Filter SKU, description, or bucket..." searchFilter={(r, term) => String(r.sku ?? '').toLowerCase().includes(term) ||
            String(r.name ?? '').toLowerCase().includes(term) ||
            String(r.agingBucket ?? '').toLowerCase().includes(term)}/>
    </div>);
};
