import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, UserPlus, Send, AlertTriangle, CheckCircle2, Truck, Receipt, ShoppingCart } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { StageStatusBadge } from '../../components/StageStatusBadge';
import { formatCurrency } from '../../../../utils/currencyUtils';
import PageInfoButton from '../../../../components/ui/PageInfoButton';

/**
 * ProjectHeader — the hero banner for the project workspace.
 *
 * Carries the order context, a radial completion gauge fed by the store's
 * derived overallCompletionPct, and the four quick actions from the spec.
 */

const PRIORITY_TONES = {
  Urgent: { bg: '#ffe4e6', fg: '#9f1239' },
  High: { bg: '#ffedd5', fg: '#9a3412' },
  Medium: { bg: '#e0f2fe', fg: '#0369a1' },
  Low: { bg: '#f1f5f9', fg: '#475569' },
};

function CompletionGauge({ value = 0, status }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const size = 96;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const color =
    status === 'Delayed' ? '#f43f5e' :
    status === 'At Risk' ? '#ef9b06' :
    status === 'Completed' ? '#1bb878' : '#1f6bff';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${pct} percent complete`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e8eef8" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-800 leading-none">{pct}%</span>
        <span className="text-[9px] font-semibold text-slate-400 mt-0.5">COMPLETE</span>
      </div>
    </div>
  );
}

export function ProjectHeader({
  project,
  meta,
  onAssignStage,
  onSubmitForReview,
  onLogDelay,
  onCompleteProject,
}) {
  const priority = PRIORITY_TONES[project.priority] ?? PRIORITY_TONES.Low;
  const isClosed = project.status === 'Completed';

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-3">
        <Link to="/pms" className="text-blue-600 hover:underline">PMS</Link>
        <ChevronRight size={12} className="text-slate-300" />
        <Link to="/pms/projects" className="text-blue-600 hover:underline">Projects</Link>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-600 font-semibold">{project.code || project.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <CompletionGauge value={project.overallCompletionPct} status={project.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{project.code || project.id}</h2>
            <PageInfoButton title="Project Details" />
            <StageStatusBadge status={project.status} />
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: priority.bg, color: priority.fg }}
            >
              {project.priority}
            </span>
            {meta?.isOverdue && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#ffe4e6', color: '#9f1239' }}
              >
                <AlertTriangle size={10} strokeWidth={2.5} />+{meta.projectDelayLabel} overdue
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-700 truncate">
            {project.productDetails?.productName}
          </p>

          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
            {[
              ['Customer', project.customerName],
              ['CRM Order', project.crmOrderId ? (
                <Link to="/sales/orders" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono">
                  <ShoppingCart size={10} /> {project.crmOrderId}
                </Link>
              ) : '—'],
              ['Order Value', formatCurrency(project.productDetails?.orderValue ?? 0)],
              ['Current Stage', meta?.sequenceLabel ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-slate-400 font-medium">{k}</dt>
                <dd className="text-[11px] font-semibold text-slate-700 truncate max-w-[220px]" title={typeof v === 'string' ? v : undefined}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
          <Button size="sm" variant="secondary" icon={UserPlus} onClick={onAssignStage} disabled={isClosed}>
            Assign Active Stage
          </Button>
          <Button size="sm" variant="secondary" icon={Send} onClick={onSubmitForReview} disabled={isClosed || !meta?.currentStage}>
            Submit for Review
          </Button>
          <Button size="sm" variant="secondary" icon={AlertTriangle} onClick={onLogDelay} disabled={isClosed}>
            Log Delay
          </Button>
          <Button size="sm" icon={CheckCircle2} onClick={onCompleteProject} disabled={isClosed}>
            {isClosed ? 'Completed' : 'Complete Project'}
          </Button>

          {isClosed && (
            <>
              <Link
                to="/sales/delivery"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                title="Generate Delivery Challan for dispatching completed project"
              >
                <Truck size={13} /> Issue Challan
              </Link>
              <Link
                to="/sales/invoices"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs transition-colors"
                title="Create Commercial Sales Invoice"
              >
                <Receipt size={13} /> Create Invoice
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProjectHeader;
