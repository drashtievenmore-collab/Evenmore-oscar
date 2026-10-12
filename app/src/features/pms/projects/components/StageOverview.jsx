import React from 'react';
import {
  Check, Boxes, Droplets, Cog, ShieldCheck, Layers, Play,
  Send, ArrowRightLeft, ClipboardList, Truck, Receipt, Trophy, CircleDot,
} from 'lucide-react';
import { computeStageCompletionPct } from '../../../../stores/pmsStore';
import { StageStatusBadge } from '../../components/StageStatusBadge';

/**
 * StageOverview — the "PRJ-2026-001" style summary: a horizontal stage
 * stepper (sequence, icon, weight, dates, status) plus the Stage Details
 * table (weight, planned/actual dates, quantities, status, progress,
 * remarks). Quantity cells read `stage.quantities` when present and render
 * "—" otherwise, so the columns fill in once production linkage lands.
 */

function dateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function weightOf(stage) {
  return Number(stage.percentage ?? stage.weightPct ?? stage.weight) || 0;
}

function qty(stage, key) {
  const v = stage.quantities?.[key];
  if (v === undefined || v === null || v === '') return '—';
  return Number(v).toLocaleString('en-IN');
}

function statusTone(status) {
  if (status === 'Completed') return { ring: '#10b981', chipBg: '#d1fae5', chipFg: '#065f46', label: 'Completed' };
  if (status === 'In Progress') return { ring: '#2563eb', chipBg: '#dbeafe', chipFg: '#1d4ed8', label: 'In Progress' };
  return { ring: '#cbd5e1', chipBg: '#f1f5f9', chipFg: '#64748b', label: 'Pending' };
}

function StageIcon({ name, department }) {
  const text = `${name ?? ''} ${department ?? ''}`.toLowerCase();
  const pick = [
    [/dye/, Droplets],
    [/process/, Cog],
    [/qc|quality|test|inspect/, ShieldCheck],
    [/stock|invent/, Layers],
    [/reserv/, ClipboardList],
    [/dispatch|deliver|logistic/, Truck],
    [/invoice|collect|payment|billing/, Receipt],
    [/complet|trophy|handoff/, Trophy],
    [/grey|gray|production|weav|knit|fabric/, Boxes],
  ];
  const [, Icon] = pick.find(([re]) => re.test(text)) ?? [, CircleDot];
  return <Icon size={22} strokeWidth={1.8} />;
}

export function StageStepper({ stages, currentStageId }) {
  if (!stages.length) return null;
  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs overflow-x-auto">
      <ol className="flex items-stretch min-w-max" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {stages.map((stage, idx) => {
          const tone = statusTone(stage.status);
          const done = stage.status === 'Completed';
          return (
            <li key={stage.id} className="flex items-stretch">
              <div className="flex flex-col items-center w-36 shrink-0">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-[3px] bg-white"
                  style={{ borderColor: tone.ring, color: tone.ring }}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : stage.sequence}
                </span>
                <div className="mt-2 flex flex-col items-center text-center px-1" style={{ color: tone.ring }}>
                  <StageIcon name={stage.name} department={stage.department} />
                  <p className="mt-1 text-xs font-bold text-slate-800 leading-tight">{stage.name}</p>
                  <p className="text-xs font-extrabold" style={{ color: tone.ring }}>{weightOf(stage)}%</p>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    {dateOnly(stage.startDateTime)}<br />{dateOnly(stage.expectedCompletionDateTime)}
                  </p>
                  <span
                    className="mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: tone.chipBg, color: tone.chipFg }}
                  >
                    {done ? 'Completed' : tone.label}
                  </span>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <span aria-hidden="true" className="w-8 self-start mt-4 h-[3px] rounded-full shrink-0" style={{ background: tone.ring, opacity: 0.55 }} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const QTY_COLS = [
  ['input', 'Input'],
  ['produced', 'Produced'],
  ['good', 'Good'],
  ['accepted', 'Accepted'],
  ['reserved', 'Reserved'],
  ['dispatched', 'Dispatched'],
];

export function StageDetailsTable({ stages, currentStageId, actions }) {
  if (!stages.length) return null;
  const totalWeight = stages.reduce((acc, s) => acc + weightOf(s), 0);
  const totals = {};
  for (const [key] of QTY_COLS) {
    const vals = stages.map((s) => s.quantities?.[key]).filter((v) => v !== undefined && v !== null && v !== '');
    totals[key] = vals.length && vals.every((v) => !Number.isNaN(Number(v)))
      ? vals.reduce((a, v) => a + Number(v), 0).toLocaleString('en-IN')
      : '—';
  }
  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <h4 className="text-xs font-bold text-slate-800">
          Stage Details <span className="font-medium text-slate-400">({stages.length} stages – {Math.round(totalWeight * 100) / 100}% total weight)</span>
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-slate-500 border-y border-slate-100 bg-slate-50/70">
              <th className="py-2 px-3 w-8">#</th>
              <th className="py-2 px-3">Stage</th>
              <th className="py-2 px-3 text-right">Weight</th>
              <th className="py-2 px-3">Planned Date (Start – End)</th>
              <th className="py-2 px-3">Actual Date (Start – End)</th>
              <th className="py-2 px-3 text-center" colSpan={QTY_COLS.length}>Quantity (m)</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 w-36">Progress</th>
              <th className="py-2 px-3">Remarks</th>
              <th className="py-2 px-3 text-center">Action</th>
            </tr>
            <tr className="text-[10px] font-bold text-slate-400 border-b border-slate-100">
              <th colSpan={5} />
              {QTY_COLS.map(([key, label]) => (
                <th key={key} className="py-1 px-3 text-right font-semibold">{label}</th>
              ))}
              <th colSpan={4} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stages.map((stage) => {
              const pct = Math.round(computeStageCompletionPct(stage));
              const tone = statusTone(stage.status);
              const isDone = stage.status === 'Completed';
              const notStarted = stage.status === 'Not Started';
              const isCurrent = currentStageId && stage.id === currentStageId;
              const btn = 'p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';
              return (
                <tr key={stage.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3">
                    <span
                      className="inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: tone.ring }}
                    >
                      {stage.sequence}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{stage.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">{weightOf(stage)}%</td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                    {dateOnly(stage.startDateTime)} – {dateOnly(stage.expectedCompletionDateTime)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                    {stage.actualCompletionDateTime
                      ? `${dateOnly(stage.startDateTime)} – ${dateOnly(stage.actualCompletionDateTime)}`
                      : '—'}
                  </td>
                  {QTY_COLS.map(([key]) => (
                    <td key={key} className="py-2.5 px-3 text-right font-mono text-slate-700">{qty(stage, key)}</td>
                  ))}
                  <td className="py-2.5 px-3 whitespace-nowrap"><StageStatusBadge status={stage.status} size="sm" /></td>
                  <td className="py-2.5 px-3">
                    <span className="flex items-center gap-2">
                      <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden min-w-[48px]">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct > 0 ? '#2563eb' : '#cbd5e1' }}
                        />
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 w-9 text-right">{pct}%</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-[160px] truncate" title={stage.delayDetails?.reason ?? ''}>
                    {stage.delayDetails?.reason ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {!actions ? (
                      <span className="text-slate-300 text-[11px]">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                        <button
                          type="button"
                          title="Start Stage"
                          disabled={!(notStarted || stage.status === 'Assigned')}
                          onClick={() => actions.onStart?.(stage)}
                          className={`${btn} text-slate-500 hover:text-blue-700 hover:bg-blue-50`}
                        >
                          <Play size={14} />
                        </button>
                        <button
                          type="button"
                          title="Submit Stage"
                          disabled={isDone || notStarted}
                          onClick={() => actions.onSubmit?.(stage)}
                          className={`${btn} text-slate-500 hover:text-emerald-700 hover:bg-emerald-50`}
                        >
                          <Send size={14} />
                        </button>
                        <button
                          type="button"
                          title="Hand off to the next department"
                          disabled={isDone || notStarted}
                          onClick={() => actions.onHandoff?.(stage)}
                          className={`${btn} text-slate-500 hover:text-violet-700 hover:bg-violet-50`}
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                        {isCurrent && (
                          <span className="ml-1 text-[10px] font-bold text-blue-600">Active</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50/70 font-bold text-slate-800">
              <td colSpan={2} className="py-2.5 px-3">Total</td>
              <td className="py-2.5 px-3 text-right font-mono">{Math.round(totalWeight * 100) / 100}%</td>
              <td colSpan={2} />
              {QTY_COLS.map(([key]) => (
                <td key={key} className="py-2.5 px-3 text-right font-mono">{totals[key]}</td>
              ))}
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StageDetailsTable;
