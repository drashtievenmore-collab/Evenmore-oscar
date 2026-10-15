import React, { useState, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { DollarSign } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { api } from '../../services/api';

// Must match the backend's STOCK_AGE_BUCKETS (apps/inventory/views.py).
const BUCKETS = ['0-30', '31-60', '61-90', '91-180', '180+'];

const BUCKET_STYLE = {
    '0-30': 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    '31-60': 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
    '61-90': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    '91-180': 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
    '180+': 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
};

export const ValuationAgeingPage = () => {
    const { formatCurrency } = useERP();
    const [selectedBucket, setSelectedBucket] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [aggs, setAggs] = useState(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        // envelope() returns { results, count, aggregates }.
        api.get('/inventory/valuation/')
            .then((res) => {
                if (!active) return;
                setRows(Array.isArray(res?.results) ? res.results : []);
                setAggs(res?.aggregates || null);
            })
            .catch((err) => {
                if (!active) return;
                setRows([]);
                setAggs(null);
                setError(err?.message || 'Could not load valuation.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, []);

    const bucketValue = (label) => Number(aggs?.buckets?.find((b) => b.bucket === label)?.value || 0);
    const filteredData = selectedBucket === 'All' ? rows : rows.filter((r) => r.agingBucket === selectedBucket);

    const columns = [
        {
            key: 'sku',
            header: 'SKU Code',
            width: '12%',
            render: (r) => <span className="font-mono font-bold text-primary whitespace-nowrap">{r.sku}</span>,
        },
        {
            key: 'name',
            header: 'Item / Lot',
            width: '24%',
            render: (r) => (
              <div>
                <p className="font-bold text-text">{r.name}</p>
                <span className="text-[10px] text-muted">
                  {[r.category, r.lotNo, r.takaId].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            ),
        },
        {
            key: 'location',
            header: 'Location',
            width: '12%',
            render: (r) => <span className="text-xs text-text-secondary">{r.location || '—'}</span>,
        },
        {
            key: 'qty',
            header: 'Holding Qty',
            align: 'center',
            width: '10%',
            render: (r) => (
              <span className="font-mono font-semibold text-text whitespace-nowrap">
                {Number(r.qty).toLocaleString('en-IN')} {r.uom || ''}
              </span>
            ),
        },
        {
            key: 'unitCost',
            header: 'Unit Cost (WAC)',
            align: 'right',
            width: '11%',
            render: (r) => <span className="font-mono text-muted whitespace-nowrap">{formatCurrency(r.unitCost)}</span>,
        },
        {
            key: 'value',
            header: 'Carrying Value',
            align: 'right',
            width: '12%',
            render: (r) => <span className="font-mono font-bold text-text whitespace-nowrap">{formatCurrency(r.value)}</span>,
        },
        {
            key: 'ageDays',
            header: 'Age',
            align: 'center',
            width: '9%',
            render: (r) => (
              <span className="font-mono text-text text-xs whitespace-nowrap">
                {r.ageDays === null || r.ageDays === undefined ? '—' : `${r.ageDays} days`}
              </span>
            ),
        },
        {
            key: 'agingBucket',
            header: 'Ageing Bucket',
            align: 'center',
            width: '10%',
            render: (r) => (r.agingBucket ? (
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${BUCKET_STYLE[r.agingBucket] || ''}`}>
                {r.agingBucket} days
              </span>
            ) : <span className="text-xs text-muted">No inward date</span>),
        },
    ];

    return (<div className="space-y-6">
      <PageHeader
        title="Valuation & Inventory Ageing"
        subtitle="Weighted-average carrying value, aged from each lot/taka inward date (FIFO layers for stock not on takas)."
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Inventory Value" value={loading ? '…' : formatCurrency(aggs?.totalValuation || 0, { noDecimals: true })} icon={DollarSign}/>
        <StatCard label="0-30 Days" value={loading ? '…' : formatCurrency(bucketValue('0-30'), { noDecimals: true })}/>
        <StatCard label="31-90 Days" value={loading ? '…' : formatCurrency(bucketValue('31-60') + bucketValue('61-90'), { noDecimals: true })}/>
        <StatCard label="Over 90 Days" value={loading ? '…' : formatCurrency(aggs?.staleValuation || 0, { noDecimals: true })}/>
      </div>

      <div className="flex flex-nowrap items-center gap-2 border-b border-[#CED4DA] pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        <span className="shrink-0 lg:shrink text-slate-500 font-semibold">Ageing Bucket:</span>
        {['All', ...BUCKETS].map((b) => (<button key={b} onClick={() => setSelectedBucket(b)} className={`shrink-0 lg:shrink px-3 py-1 rounded-full font-medium transition cursor-pointer ${selectedBucket === b
                ? 'bg-[#1F2E4A] text-white'
                : 'text-slate-600 hover:bg-slate-200'}`}>
            {b === 'All' ? 'All' : `${b} days`}
          </button>))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#dce5f4] rounded-xl p-8 text-center text-sm text-slate-500">Loading valuation…</div>
      ) : (
        <DataTable title="Inventory Ageing Valuation" columns={columns} data={filteredData} keyExtractor={(r) => r.id} searchPlaceholder="Filter SKU, item, lot or location..." searchFilter={(r, term) => String(r.sku ?? '').toLowerCase().includes(term) ||
                String(r.name ?? '').toLowerCase().includes(term) ||
                String(r.lotNo ?? '').toLowerCase().includes(term) ||
                String(r.location ?? '').toLowerCase().includes(term)}/>
      )}
    </div>);
};
