import React, { useState } from 'react';
import { Percent, Plus } from 'lucide-react';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import { StageStepper, StageDetailsTable } from './StageOverview';
import { isProjectCreator } from '../../../../stores/pmsStore';
import { useAppStore } from '../../../../stores/appStore';
import { ConfigureStagePercentagesModal } from './ConfigureStagePercentagesModal';
import { AddDynamicStageModal } from './AddDynamicStageModal';

/**
 * StageTimelineTab — the sequential, interactive stage pipeline.
 *
 * Renders the horizontal stage stepper plus the Stage Details table.
 * Row-level actions (Start / Tasks / Submit / Hand Off) live in the
 * table's Action column.
 */

export function StageTimelineTab({ project, stageConfigs = [], onStart, onManageTasks, onSubmit, onHandoff }) {
  const [isPercentagesOpen, setPercentagesOpen] = useState(false);
  const [isAddDynamicOpen, setAddDynamicOpen] = useState(false);

  const currentUser = useAppStore((s) => s.currentUser);
  const isCreator = isProjectCreator(project, currentUser);

  const ordered = [...(project.stages ?? [])].sort((a, b) => a.sequence - b.sequence);

  const totalWeight = ordered.reduce(
    (acc, s) => acc + (Number(s.percentage ?? s.weightPct ?? s.weight) || 0),
    0
  );

  const readOnly = project.status === 'Completed';

  return (
    <div className="space-y-4">
      {/* Top action toolbar for stage management */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Project Stage Pipeline</span>
          {ordered.length > 0 && (
            <span className="text-[11px] text-slate-400">
              ({ordered.length} stages · {Math.round(totalWeight * 100) / 100}% total weight)
            </span>
          )}
        </div>

        {isCreator && project.status !== 'Completed' && (
          <div className="flex items-center gap-2">
            {ordered.length > 0 && (
              <button
                type="button"
                onClick={() => setPercentagesOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                title="Configure stage percentage weights"
              >
                <Percent size={13} /> Stage Weights
              </button>
            )}
            <button
              type="button"
              onClick={() => setAddDynamicOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs"
              title="Add a dynamic stage to this project"
            >
              <Plus size={13} /> Add Dynamic Stage
            </button>
          </div>
        )}
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <EmptyStatePms
            variant="stages"
            title="No stages configured"
            description="This project has no stage pipeline yet. Add a dynamic stage to get started."
            action={
              isCreator && project.status !== 'Completed' ? (
                <button
                  type="button"
                  onClick={() => setAddDynamicOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus size={13} /> Add Dynamic Stage
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <StageStepper stages={ordered} currentStageId={project.currentStageId} />
          <StageDetailsTable
            stages={ordered}
            currentStageId={project.currentStageId}
            actions={readOnly ? null : { onStart, onManageTasks, onSubmit, onHandoff }}
          />
        </>
      )}

      <ConfigureStagePercentagesModal
        isOpen={isPercentagesOpen}
        project={project}
        onClose={() => setPercentagesOpen(false)}
      />

      <AddDynamicStageModal
        isOpen={isAddDynamicOpen}
        project={project}
        onClose={() => setAddDynamicOpen(false)}
      />
    </div>
  );
}

export default StageTimelineTab;
