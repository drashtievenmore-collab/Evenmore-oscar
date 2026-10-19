import React, { useState, useMemo } from 'react';
import { Percent, Plus, RefreshCw } from 'lucide-react';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import {
  ConditionalStockBanner,
  StageStepper,
  buildStaticPipelineStages,
} from './StageOverview';
import { isProjectCreator } from '../../../../stores/pmsStore';
import { useAppStore } from '../../../../stores/appStore';
import { ConfigureStagePercentagesModal } from './ConfigureStagePercentagesModal';
import { AddDynamicStageModal } from './AddDynamicStageModal';
import { Stage1GreyStockWorkspace } from './Stage1GreyStockWorkspace';

export function StageTimelineTab({
  project,
  stageConfigs = [],
  onStart,
  onManageTasks,
  onSubmit,
  onHandoff,
  onDeleteStage,
  onSyncPipeline,
}) {
  const [isPercentagesOpen, setPercentagesOpen] = useState(false);
  const [isAddStageOpen, setAddStageOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedStageSeq, setSelectedStageSeq] = useState(1);

  const currentUser = useAppStore((s) => s.currentUser);
  const isCreator = isProjectCreator(project, currentUser);

  const ordered = useMemo(() => buildStaticPipelineStages(project), [project]);

  const totalWeight = ordered.reduce(
    (acc, s) => acc + (Number(s.percentage ?? s.weightPct ?? s.weight) || 0),
    0
  );

  const readOnly = project.status === 'Completed';

  return (
    <div className="space-y-4">
      <ConditionalStockBanner pipelineSummary={project.pipelineSummary} />

      {ordered.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Project Stage Pipeline
              </h3>
              <span className="text-[11px] text-slate-400">
                ({ordered.filter((s) => s.status === 'Completed').length} of{' '}
                {ordered.filter((s) => s.status !== 'Not Required').length} active stages completed · {Math.round(totalWeight * 100) / 100}% total weight)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onSyncPipeline && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await onSyncPipeline();
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Synchronize stage pipeline with latest ERP inventory and order data"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync Pipeline'}
                </button>
              )}

              {isCreator && project.status !== 'Completed' && (
                <>
                  <button
                    type="button"
                    onClick={() => setAddStageOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs"
                    title="Add a custom dynamic stage"
                  >
                    <Plus size={13} /> Add Dynamic Stage
                  </button>

                  {ordered.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPercentagesOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs"
                      title="Configure stage percentage weights"
                    >
                      <Percent size={13} /> Stage Weights
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <StageStepper
            stages={ordered}
            currentStageId={project.currentStageId}
            pipelineSummary={project.pipelineSummary}
            selectedStageSequence={selectedStageSeq}
            onSelectStage={(seq) => setSelectedStageSeq(seq)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <EmptyStatePms
            variant="stages"
            title="No stages configured"
            description="No stages have been configured for this project."
          />
        </div>
      )}

      {selectedStageSeq === 1 && (
        <Stage1GreyStockWorkspace
          project={project}
          stage={ordered.find((s) => s.sequence === 1)}
          onSyncPipeline={onSyncPipeline}
          onHandoff={onHandoff}
        />
      )}

      <ConfigureStagePercentagesModal
        isOpen={isPercentagesOpen}
        project={project}
        onClose={() => setPercentagesOpen(false)}
      />

      <AddDynamicStageModal
        isOpen={isAddStageOpen}
        project={project}
        onClose={() => setAddStageOpen(false)}
      />
    </div>
  );
}

export default StageTimelineTab;
