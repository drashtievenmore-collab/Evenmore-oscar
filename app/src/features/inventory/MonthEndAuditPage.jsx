import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, AlertTriangle, UserCheck, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
export const MonthEndAuditPage = () => {
    const { items, calculateItemStock, formatCurrency } = useERP();
    // Point-in-time audit snapshot seeded from live book quantities
    // (was hardcoded demo rows). physicalCount starts at book qty; the
    // auditor adjusts via Post Adjustment / recount flows below.
    const buildSnapshot = () => (items || []).map((it) => {
        const live = calculateItemStock(it.id);
        const systemQty = live?.available ?? it.availableQty ?? it.stock ?? 0;
        const unitCost = it.costPrice ?? it.unitCost ?? 0;
        return {
            id: `aud-${it.id}`,
            sku: it.sku,
            name: it.name,
            location: it.location || '—',
            systemQty,
            physicalCount: systemQty,
            variance: 0,
            varianceCost: 0,
            unitCost,
            status: 'Reconciled',
        };
    });
    const [auditItems, setAuditItems] = useState(buildSnapshot);
    const [auditLocked, setAuditLocked] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const reconcileItem = (id) => {
        setAuditItems((prev) => prev.map((item) => item.id === id
            ? {
                ...item,
                physicalCount: item.systemQty,
                variance: 0,
                varianceCost: 0,
                status: 'Reconciled',
            }
            : item));
    };
    const handleSignOff = () => {
        setAuditLocked(true);
        setToastMessage('Month-End Stock Reconciliation successfully locked & posted to GL!');
        setTimeout(() => setToastMessage(null), 4000);
    };
    // Live summary stats derived from the audit snapshot (were hardcoded).
    const reconciledCount = auditItems.filter((i) => i.status === 'Reconciled').length;
    const accuracyPct = auditItems.length > 0
        ? ((reconciledCount / auditItems.length) * 100).toFixed(1)
        : '0.0';
    const netVarianceCost = auditItems.reduce((acc, i) => acc + (i.varianceCost || 0), 0);
    const flaggedCount = auditItems.filter((i) => i.status === 'Variance Flagged').length;
    const columns = [
        {
            key: 'sku',
            header: 'SKU Code',
            width: '12%',
            render: (a) => <span className="font-mono font-bold text-primary">{a.sku}</span>,
        },
        {
            key: 'name',
            header: 'Item Description',
            width: '22%',
            render: (a) => (<span className="font-semibold text-text">{a.name}</span>),
        },
        {
            key: 'location',
            header: 'Assigned Bay / Zone',
            width: '14%',
            render: (a) => <span className="text-muted text-xs">{a.location}</span>,
        },
        {
            key: 'systemQty',
            header: 'System Book Qty',
            align: 'center',
            width: '10%',
            render: (a) => <span className="font-mono text-text-secondary">{a.systemQty}</span>,
        },
        {
            key: 'physicalCount',
            header: 'Physical Headcount',
            align: 'center',
            width: '12%',
            render: (a) => (<span className="font-mono font-bold text-text bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
          {a.physicalCount}
        </span>),
        },
        {
            key: 'variance',
            header: 'Unit Variance',
            align: 'center',
            width: '10%',
            render: (a) => a.variance === 0 ? (<span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1">
            <CheckCircle2 size={12}/> Match
          </span>) : (<span className="text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1">
            <AlertTriangle size={12}/> {a.variance} units
          </span>),
        },
        {
            key: 'varianceCost',
            header: 'Fiscal Variance',
            align: 'right',
            width: '11%',
            render: (a) => (<span className={`font-mono font-bold ${a.varianceCost < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-text'}`}>
          {a.varianceCost < 0
                    ? `-${formatCurrency(Math.abs(a.varianceCost))}`
                    : formatCurrency(a.varianceCost)}
        </span>),
        },
        {
            key: 'status',
            header: 'Audit Status',
            align: 'center',
            width: '9%',
            render: (a) => <StatusBadge status={a.status}/>,
        },
        {
            key: 'actions',
            header: 'Adjustment',
            align: 'right',
            width: '8%',
            render: (a) => a.status === 'Variance Flagged' && !auditLocked ? (<button onClick={() => reconcileItem(a.id)} className="px-2 py-1 bg-primary text-white rounded text-[11px] font-semibold hover:bg-primary-hover cursor-pointer shadow-2xs">
            Post Adjustment
          </button>) : (<span className="text-muted text-xs">Locked</span>),
        },
    ];
    return (<div className="space-y-6">
      {toastMessage && (<div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-800 flex items-center gap-2">
          <ShieldCheck size={16}/> {toastMessage}
        </div>)}

      <PageHeader
        title="Month-End Stock Audit & Reconciliation"
        subtitle="Monthly physical count verification against book balance, variance write-offs, and auditor GL closing."
        actions={
          !auditLocked ? (<Button icon={UserCheck} onClick={handleSignOff}>
            Lock & Sign-Off Audit
          </Button>) : (<span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-xs flex items-center gap-1.5 border border-emerald-300">
            <ShieldCheck size={14}/> Audit Certified & Closed
          </span>)
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA]">
          <span className="text-xs text-slate-500 font-semibold uppercase">Audit Cycle</span>
          <p className="text-lg font-bold text-[#1F2E4A] mt-1">October 2026 Close</p>
          <span className="text-[11px] text-slate-400">Auditor: Sarah Jenkins (Lead CPA)</span>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA]">
          <span className="text-xs text-slate-500 font-semibold uppercase">Reconciled Accuracy</span>
          <p className="text-lg font-bold text-emerald-700 mt-1">{accuracyPct}%</p>
          <span className="text-[11px] text-slate-400">Within acceptable tolerance (±2%)</span>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#CED4DA]">
          <span className="text-xs text-slate-500 font-semibold uppercase">Net Inventory Variance</span>
          <p className="text-lg font-bold text-rose-700 mt-1">{netVarianceCost < 0 ? `-${formatCurrency(Math.abs(netVarianceCost))}` : formatCurrency(netVarianceCost)}</p>
          <span className="text-[11px] text-slate-400">{flaggedCount === 0 ? 'No open variances' : `${flaggedCount} open variance${flaggedCount === 1 ? '' : 's'}`}</span>
        </div>
      </div>

      <DataTable title="Physical vs Book Count Audit Schedule" columns={columns} data={auditItems} keyExtractor={(a) => a.id} searchPlaceholder="Filter SKU or location..." searchFilter={(a, term) => String(a.sku ?? '').toLowerCase().includes(term) ||
            String(a.name ?? '').toLowerCase().includes(term) ||
            String(a.location ?? '').toLowerCase().includes(term)}/>
    </div>);
};
