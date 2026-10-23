import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Factory, RefreshCw } from 'lucide-react';
import { usePmsStore } from '../../../../stores/pmsStore';
import { ProductionLifecyclePanel } from '../../production/ProductionLifecyclePanel';
import { VENDOR_PRODUCTION_STAGES } from './StageOverview';

// PMS production-branch stage name -> Production Lifecycle stage key.
// Mirrors PRODUCTION_LIFECYCLE_STAGE_MAP in apps/pms/pipeline_services.py.
const PMS_STAGE_TO_LIFECYCLE = Object.fromEntries(VENDOR_PRODUCTION_STAGES.map((s) => [s.name, s.lifecycleKey]));

const fmtM = (v) => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} M`);

export function StageVendorProductionWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
  totalStages = 17,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const stageName = (stage?.name || '').trim();
  const stageSeq = stage?.sequence || 2;
  const lifecycleKey = stage?.lifecycleKey || PMS_STAGE_TO_LIFECYCLE[stageName];
  // The production stages sit together in the pipeline in lifecycle order,
  // so a lifecycle key maps to a pipeline sequence by offset.
  const lifecycleIndex = VENDOR_PRODUCTION_STAGES.findIndex((s) => s.lifecycleKey === lifecycleKey);
  const selectLifecycleStage = (key) => {
    const target = VENDOR_PRODUCTION_STAGES.findIndex((s) => s.lifecycleKey === key);
    if (target < 0 || lifecycleIndex < 0 || !onSelectStage) return;
    onSelectStage(stageSeq + (target - lifecycleIndex));
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lifecycles, setLifecycles] = useState([]);

  const primary = lifecycles[0];
  const stageOf = (key) => primary?.stages?.find((s) => s.key === key);
  const kpis = useMemo(() => {
    const pi = stageOf('production_work_instruction');
    const daily = stageOf('daily_production_entry');
    return {
      ordered: pi?.quantity,
      produced: daily?.quantity,
      balance: daily?.balanceQuantity,
      agency: stageOf('external_agency_assignment')?.party,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setRefreshKey((k) => k + 1);
      if (onSyncPipeline) await onSyncPipeline();
      showToast?.(`${stageName} data refreshed.`, 'info');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
              <Factory size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Stage {stageSeq}
                </span>
                <h2 className="text-base font-extrabold text-[#17294e]">{stageName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Vendor A Production Branch
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Production Lifecycle stage {lifecycleIndex + 1} of {VENDOR_PRODUCTION_STAGES.length}. Work is done here; records are saved to the same purchase / production documents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Instructed Quantity</span>
            <span className="font-mono font-bold text-slate-900">{fmtM(kpis.ordered)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Produced (submitted)</span>
            <span className="font-mono font-bold text-emerald-700">{fmtM(kpis.produced)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Pending Balance</span>
            <span className="font-mono font-bold text-amber-700">{fmtM(kpis.balance)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Assigned Agency</span>
            <span className="font-bold text-slate-800">{kpis.agency || 'Not assigned'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <button
            type="button"
            disabled={stageSeq <= 1}
            onClick={() => onSelectStage && onSelectStage(stageSeq - 1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-40"
          >
            <ArrowLeft size={13} /> Back to Previous Stage
          </button>
          <span className="text-[11px] font-bold text-slate-400">
            Stage {stageSeq} of {totalStages}
          </span>
          <button
            type="button"
            disabled={stageSeq >= totalStages}
            onClick={() => onSelectStage && onSelectStage(stageSeq + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40"
          >
            Proceed to Next Stage <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <ProductionLifecyclePanel
        project={project}
        focusStageKey={lifecycleKey}
        refreshKey={refreshKey}
        onLoaded={setLifecycles}
        embedded
        onStageChange={selectLifecycleStage}
        onUpdated={() => onSyncPipeline && onSyncPipeline()}
        defaultQty={project?.pipelineSummary?.shortageMeters || project?.requirementMeters || project?.quantity}
      />
    </div>
  );
}
