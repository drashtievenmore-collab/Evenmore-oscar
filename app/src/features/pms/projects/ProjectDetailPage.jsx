import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info, GitBranch, ShieldCheck, History } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { EmptyStatePms } from '../components/EmptyStatePms';
import { usePmsStore, getProjectRowMeta } from '../../../stores/pmsStore';
import { ProjectHeader } from './components/ProjectHeader';
import { ProjectInfoTab } from './components/ProjectInfoTab';
import { StageTimelineTab } from './components/StageTimelineTab';
import { ApprovalsTab } from './components/ApprovalsTab';
import { ActivityAuditTab } from './components/ActivityAuditTab';
import { AssignStageModal } from './components/AssignStageModal';
import { StageHandoffModal } from '../components/StageHandoffModal';
import { CompleteProjectModal } from './components/CompleteProjectModal';
import { PmsToast } from '../components/PmsToast';

/**
 * ProjectDetailPage (/pms/projects/:id) — the project workspace.
 *
 * Four tabs over one project.
 */

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'timeline', label: 'Stage Timeline', icon: GitBranch },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { id: 'activity', label: 'Activity', icon: History },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const projects = usePmsStore((s) => s.projects);
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  const startStage = usePmsStore((s) => s.startStage);
  const setStageStatus = usePmsStore((s) => s.setStageStatus);

  const [tab, setTab] = useState('timeline');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [assignStageId, setAssignStageId] = useState(null); // null = closed
  const [handoffStageId, setHandoffStageId] = useState(null);

  const project = useMemo(() => projects.find((p) => p.id === id) ?? null, [projects, id]);
  const meta = useMemo(() => (project ? getProjectRowMeta(project) : null), [project]);

  const counts = useMemo(() => {
    if (!project) return {};
    const stages = project.stages ?? [];
    return {
      approvals: stages.reduce((n, s) => n + (s.approvals?.length ?? 0), 0),
      activity: project.activityLog?.length ?? 0,
      timeline: stages.length,
    };
  }, [project]);

  if (!project) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms
          variant="projects"
          title="Project not found"
          description={`No project matches "${id}". It may have been deleted.`}
          action={<Button onClick={() => navigate('/pms/projects')}>Back to all projects</Button>}
        />
      </div>
    );
  }

  const currentStage = meta?.currentStage ?? null;

  function handleSubmitStage(stage) {
    setStageStatus(project.id, stage.id, 'Submitted', project.projectManager);
  }

  return (
    <div className="space-y-5">
      <ProjectHeader
        project={project}
        meta={meta}
        onAssignStage={() => setAssignStageId(currentStage?.id ?? '')}
        onSubmitForReview={() => currentStage && handleSubmitStage(currentStage)}
        onLogDelay={() => navigate(`/pms/delays?project=${project.id}`)}
        onCompleteProject={() => setConfirmComplete(true)}
      />

      {/* Tabs */}
      <div className="border-b border-[#dce5f4] overflow-x-auto">
        <nav className="flex gap-1 min-w-max" role="tablist" aria-label="Project sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap"
                style={
                  active
                    ? { borderColor: '#1f6bff', color: '#1f6bff' }
                    : { borderColor: 'transparent', color: '#64748b' }
                }
              >
                <Icon size={13} />
                {t.label}
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      active
                        ? { background: '#dbeafe', color: '#1d4ed8' }
                        : { background: '#f1f5f9', color: '#94a3b8' }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Panels */}
      <div role="tabpanel">
        {tab === 'overview' && <ProjectInfoTab project={project} meta={meta} />}

        {tab === 'timeline' && (
          <StageTimelineTab
            project={project}
            stageConfigs={stageConfigs}
            onStart={(stage) => startStage(project.id, stage.id, project.projectManager)}
            onSubmit={handleSubmitStage}
            onHandoff={(stage) => setHandoffStageId(stage.id)}
          />
        )}

        {tab === 'approvals' && <ApprovalsTab project={project} />}
        {tab === 'activity' && <ActivityAuditTab project={project} />}
      </div>

      <AssignStageModal
        isOpen={assignStageId !== null}
        initialStageId={assignStageId || null}
        project={project}
        onClose={() => setAssignStageId(null)}
      />

      <StageHandoffModal
        isOpen={handoffStageId !== null}
        stageId={handoffStageId}
        project={project}
        onClose={() => setHandoffStageId(null)}
      />

      <CompleteProjectModal
        isOpen={confirmComplete}
        project={project}
        onClose={() => setConfirmComplete(false)}
      />

      <PmsToast />
    </div>
  );
}
