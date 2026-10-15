import React from 'react';
import { FileText, Layers, Cog, Factory, Package, Truck, IndianRupee } from 'lucide-react';
import { formatMeters, formatMoney } from '../format';

/**
 * OverviewKpiStrip — the seven headline tiles across the top of /pms.
 * Values come straight from GET /pms/dashboard/overview/ (kpis).
 */

const TILES = [
  { key: 'totalProjects', label: 'Total Projects', icon: FileText, bg: '#e8f0ff', fg: '#1f6bff', kind: 'count' },
  { key: 'totalQuantity', label: 'Total Fabric Quantity', icon: Layers, bg: '#e6f6ff', fg: '#0284c7', kind: 'meters' },
  { key: 'inProduction', label: 'In Production', icon: Cog, bg: '#e7f8ef', fg: '#16a34a', kind: 'meters' },
  { key: 'inProcessing', label: 'In Processing', icon: Factory, bg: '#f1ebff', fg: '#7c3aed', kind: 'meters' },
  { key: 'finishedStock', label: 'Finished Stock', icon: Package, bg: '#e7f8ef', fg: '#059669', kind: 'meters' },
  { key: 'pendingDispatch', label: 'Pending Dispatch', icon: Truck, bg: '#e8f0ff', fg: '#2563eb', kind: 'meters' },
  { key: 'outstandingPayment', label: 'Outstanding Payment', icon: IndianRupee, bg: '#ffecec', fg: '#dc2626', kind: 'money' },
];

function display(kind, value) {
  if (kind === 'meters') return formatMeters(value);
  if (kind === 'money') return formatMoney(value);
  return Number(value || 0).toLocaleString('en-IN');
}

export function OverviewKpiStrip({ kpis = {} }) {
  return (
    <section
      className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7"
      aria-label="PMS key metrics"
    >
      {TILES.map(({ key, label, icon: Icon, bg, fg, kind }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-xl border border-[#dce5f4] bg-white px-3.5 py-3 shadow-2xs"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: bg, color: fg }}
          >
            <Icon size={20} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
            <p className="truncate text-[17px] font-bold leading-tight text-slate-900">
              {display(kind, kpis[key])}
            </p>
            {key === 'totalProjects' && (
              <p className="text-[10px] font-medium text-slate-400">
                {kpis.inProgressProjects ?? 0} In Progress
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

export default OverviewKpiStrip;
