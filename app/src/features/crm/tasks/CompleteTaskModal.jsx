import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TASK_OUTCOMES, NEXT_ACTIONS, NEXT_ACTION_LABELS } from '../../../services/taskCompletionService';

export default function CompleteTaskModal({ open, task, lead, onCancel, onComplete, onSuccess }) {
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('follow-up');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [phase, setPhase] = useState('form');
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    if (open) {
      setNote('');
      setOutcome('');
      setNextAction('follow-up');
      setSubmitting(false);
      setFormError('');
      setPhase('form');
      setWarnings([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape' && phase === 'form') onCancel?.();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, phase, onCancel]);

  if (!open) return null;

  const valid = Boolean(note.trim() && outcome && nextAction);
  const currentStage = task?.stage || lead?.status || '-';
  const attemptNumber = task?.attempt || task?.attemptNumber || 1;
  const nextActionOptions = NEXT_ACTIONS.filter((option) =>
    ['follow-up', 'move-next-stage', 'finish', 'schedule-demo', 'send-quotation'].includes(option.value)
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) {
      setFormError('Please enter what happened.');
      return;
    }
    if (!outcome) {
      setFormError('Please select an outcome.');
      return;
    }
    if (!nextAction) {
      setFormError("Please select what's next.");
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const result = (await onComplete?.(outcome, nextAction, note.trim())) || {};
      if (result.ok === false) {
        setFormError(result.message || 'Could not complete the task.');
        setSubmitting(false);
        return;
      }
      setWarnings(result.warnings || []);
      setPhase('success');
      window.setTimeout(() => onSuccess?.(), 1600);
    } catch (err) {
      setFormError(err?.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-2 sm:p-4 backdrop-blur-xs"
      onClick={() => { if (!submitting && phase === 'form') onCancel?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Fill Task Form"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[375px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-bold text-slate-900">Fill Task Form</h2>
          <button
            type="button"
            onClick={() => { if (!submitting && phase === 'form') onCancel?.(); }}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="overflow-y-auto">
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={30} />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-slate-900">Task completed successfully.</h3>
              <p className="mt-1 text-xs text-slate-500">
                Outcome: <strong className="text-slate-700">{outcome}</strong>
                <span className="mx-1">-</span>
                Next: <strong className="text-slate-700">{NEXT_ACTION_LABELS[nextAction] || nextAction}</strong>
              </p>
              {note && (
                <p className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] text-slate-600">
                  {note}
                </p>
              )}
              {warnings.length > 0 && (
                <div className="mt-4 w-full space-y-2 text-left">
                  {warnings.map((warning, index) => (
                    <p key={index} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto">
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="text-[14px] font-medium text-slate-700">{task?.title || 'Task'}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Attempt {attemptNumber} | Stage: {currentStage}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-slate-800">
                  What happened?
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Outcome of the call, visit or demo"
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none transition focus:border-[#1d6bff]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-slate-800">
                  Outcome
                </label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-[#1d6bff]"
                >
                  <option value="">Select outcome</option>
                  {TASK_OUTCOMES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-slate-800">
                  What next?
                </label>
                <div className="space-y-2">
                  {nextActionOptions.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="next-action"
                        value={option.value}
                        checked={nextAction === option.value}
                        onChange={(e) => setNextAction(e.target.value)}
                        className="mt-1 h-4 w-4 accent-[#1d4a79]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-700">
                          {option.label}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {option.value === 'follow-up'
                            ? `Creates attempt ${attemptNumber + 1} in this same stage.`
                            : option.value === 'move-next-stage'
                            ? "Moves the lead to the next stage and creates that stage's task."
                            : option.value === 'finish'
                            ? 'Marks this task completed and closes this follow-up.'
                            : option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-[11px] font-semibold text-rose-600">{formError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="h-10 rounded-lg bg-slate-500 px-5 text-[13px] font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || submitting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1d4a79] px-5 text-[13px] font-semibold text-white transition hover:bg-[#163a61] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Saving...
                  </>
                ) : (
                  'Complete Task'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
