import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Send, ShieldCheck, Layers, Check, RefreshCw, Clock, AlertCircle, Link2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import { ProofViewer } from '../../components/ProofViewer';
import { ClientApprovalModal } from '../../components/ClientApprovalModal';
import { ShareProofModal } from '../../approval/ShareProofModal';
import { UploadProofModal } from './UploadProofModal';
import { usePmsStore, getProofWorkflowState } from '../../../../stores/pmsStore';

/**
 * DocumentsProofTab — the design proofing centre.
 *
 * Version history rail on the left, proof preview on the right, and the actions
 * that move a proof along the chain: upload → PM review → send to client →
 * client decision. Which action is available comes from getProofWorkflowState,
 * so the UI can never offer a step the data is not ready for.
 */

const APPROVAL_TONES = {
  Approved: { bg: '#d1fae5', fg: '#065f46', icon: Check },
  Pending: { bg: '#fef3c7', fg: '#92400e', icon: Clock },
  'Need Improvement': { bg: '#ffedd5', fg: '#9a3412', icon: RefreshCw },
};

const STEP_COPY = {
  'awaiting-upload': { label: 'Awaiting first proof', tone: '#64748b' },
  'pm-review': { label: 'With the PM for review', tone: '#3730a3' },
  'with-client': { label: 'Sent to client — awaiting decision', tone: '#92400e' },
  approved: { label: 'Approved — handoff unlocked', tone: '#065f46' },
  'needs-revision': { label: 'Revision requested — upload a new version', tone: '#9a3412' },
};

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function DocumentsProofTab({ project }) {
  const requestApproval = usePmsStore((s) => s.requestApproval);

  const proofStages = useMemo(
    () => [...(project.stages ?? [])].sort((a, b) => a.sequence - b.sequence),
    [project]
  );
  const stagesWithProofs = proofStages.filter((s) => (s.documents ?? []).length > 0);

  // Default to the stage that needs attention, else the first with proofs.
  const [stageId, setStageId] = useState(null);
  const [versionId, setVersionId] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [annotations, setAnnotations] = useState({});

  const activeStage =
    proofStages.find((s) => s.id === stageId) ??
    stagesWithProofs.find((s) => s.status === 'Need Improvement' || s.status === 'Under Review') ??
    stagesWithProofs[0] ??
    proofStages.find((s) => s.status !== 'Completed') ??
    proofStages[0] ??
    null;

  const workflow = useMemo(
    () => (activeStage ? getProofWorkflowState(activeStage) : null),
    [activeStage]
  );

  const versions = useMemo(
    () => [...(activeStage?.documents ?? [])].sort((a, b) => b.version - a.version),
    [activeStage]
  );
  const selected = versions.find((v) => v.id === versionId) ?? versions[0] ?? null;

  // Follow the newest version when a fresh one is uploaded.
  useEffect(() => {
    if (versions.length > 0 && !versions.some((v) => v.id === versionId)) {
      setVersionId(versions[0].id);
    }
  }, [versions, versionId]);

  if (proofStages.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms variant="documents" />
      </div>
    );
  }

  const step = workflow ? STEP_COPY[workflow.step] : null;
  const isClosed = project.status === 'Completed';

  return (
    <div className="space-y-4">
      {/* Stage selector + workflow state */}
      <section className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={14} className="text-slate-400 shrink-0" />
            <label className="text-[11px] font-semibold text-slate-600" htmlFor="proof-stage">
              Stage
            </label>
            <select
              id="proof-stage"
              className="text-xs rounded-lg border border-[#dce5f4] bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={activeStage?.id ?? ''}
              onChange={(e) => { setStageId(e.target.value); setVersionId(null); }}
            >
              {proofStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sequence}. {s.name}
                  {(s.documents ?? []).length > 0 ? ` (${s.documents.length})` : ''}
                </option>
              ))}
            </select>
          </div>

          {step && (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: `${step.tone}1a`, color: step.tone }}
              data-test="proof-step"
            >
              {step.label}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              icon={Upload}
              onClick={() => setUploadOpen(true)}
              disabled={isClosed}
            >
              Upload New Version
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Send}
              disabled={isClosed || !workflow?.canSendToClient}
              title={
                workflow?.canSendToClient
                  ? 'Circulate this version to the client'
                  : 'Available once a version is uploaded and not yet circulated'
              }
              onClick={() =>
                requestApproval(project.id, activeStage.id, selected.id, {
                  approverName: project.customerName,
                  actor: project.projectManager,
                })
              }
            >
              Send to Client
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Link2}
              disabled={isClosed || !selected}
              title={
                selected
                  ? 'Generate a shareable client approval link for this version'
                  : 'Upload a version first'
              }
              onClick={() => setShareOpen(true)}
            >
              Generate Link
            </Button>
            <Button
              size="sm"
              icon={ShieldCheck}
              disabled={isClosed || !workflow?.canDecide}
              title={
                workflow?.canDecide
                  ? 'Open the client approval simulator'
                  : 'Available once the proof has been sent to the client'
              }
              onClick={() => setApprovalOpen(true)}
            >
              Client Approval Portal
            </Button>
          </div>
        </div>

        {workflow?.needsRevision && (
          <p className="flex items-start gap-1.5 text-[11px] text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-3">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>
              <strong>Revision requested:</strong> {workflow.latest?.revisionReason} — upload
              v{(workflow.latest?.version ?? 0) + 1}.0 to continue.
            </span>
          </p>
        )}
      </section>

      {versions.length === 0 ? (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <EmptyStatePms
            variant="documents"
            title="No proofs on this stage yet"
            description="Upload the first version to start the approval chain."
            action={
              <Button icon={Upload} onClick={() => setUploadOpen(true)} disabled={isClosed}>
                Upload New Version
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-4">
          {/* Version history rail */}
          <aside className="rounded-xl border border-[#dce5f4] bg-white p-3 shadow-2xs h-fit">
            <header className="flex items-center justify-between mb-2.5">
              <h3 className="text-[11px] font-bold text-slate-700">Version History</h3>
              <span className="text-[10px] text-slate-400">{versions.length}</span>
            </header>

            <ol className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {versions.map((v) => {
                const tone = APPROVAL_TONES[v.approvalStatus] ?? APPROVAL_TONES.Pending;
                const Icon = tone.icon;
                const isActive = v.id === selected?.id;
                const isLatest = v.version === versions[0].version;

                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setVersionId(v.id)}
                      aria-current={isActive}
                      className="w-full text-left rounded-lg border px-2.5 py-2 transition-colors"
                      style={
                        isActive
                          ? { borderColor: '#1f6bff', background: '#f6f9ff' }
                          : { borderColor: '#e8eef8', background: '#fff' }
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-800">v{v.version}.0</span>
                        {isLatest && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{stamp(v.uploadedAt)}</p>
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        <Icon size={9} strokeWidth={2.5} />
                        {v.approvalStatus}
                      </span>
                      {v.revisionReason && (
                        <p className="text-[10px] text-orange-700 mt-1 line-clamp-2" title={v.revisionReason}>
                          “{v.revisionReason}”
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* Preview + comments */}
          <div className="space-y-3">
            <ProofViewer
              document={selected}
              projectName={project.productDetails?.productName}
              annotations={annotations[selected?.id] ?? []}
              onAddAnnotation={({ page, text }) =>
                setAnnotations((prev) => ({
                  ...prev,
                  [selected.id]: [
                    ...(prev[selected.id] ?? []),
                    { id: `${Date.now()}`, page, text, author: project.projectManager?.name },
                  ],
                }))
              }
            />

            <div className="rounded-xl border border-[#dce5f4] bg-white p-3 shadow-2xs">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Uploaded by', selected?.uploadedBy?.name ?? '—'],
                  ['Uploaded at', stamp(selected?.uploadedAt)],
                  ['Size', selected?.fileSize ?? '—'],
                  ['Status', selected?.approvalStatus ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[10px] text-slate-400">{k}</dt>
                    <dd className="text-[11px] font-semibold text-slate-700 truncate" title={String(v)}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}

      <UploadProofModal
        isOpen={uploadOpen}
        project={project}
        stage={activeStage}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setVersionId(null)}
      />

      <ClientApprovalModal
        isOpen={approvalOpen}
        project={project}
        stage={activeStage}
        document={selected}
        onClose={() => setApprovalOpen(false)}
      />

      <ShareProofModal
        isOpen={shareOpen}
        project={project}
        stage={activeStage}
        document={selected}
        canCirculate={workflow?.canSendToClient}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

export default DocumentsProofTab;
