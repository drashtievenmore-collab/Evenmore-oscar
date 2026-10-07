import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import AssignTaskModal from './AssignTaskModal';
import PageHeader from '../../../../components/ui/PageHeader';
import { loadAllocationTasks, saveAllocationTasks, formatDeadline, formatAuditDate, STATUSES, EMPLOYEES } from './taskAllocationStore';

export default function TaskAllocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(loadAllocationTasks);
  const [statusDraft, setStatusDraft] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const task = tasks.find((t) => t.id === id);

  useEffect(() => {
    saveAllocationTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (task) {
      setStatusDraft(task.status);
      setReassignTo(task.assignee);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) {
    return (
      <section className="w-full max-w-5xl mx-auto py-8 text-center">
        <p className="text-sm font-bold text-slate-800">Task not found</p>
        <button type="button" onClick={() => navigate('/crm/tasks/allocation')} className="mt-3 px-4 py-2 bg-[#1d4a79] text-white text-xs font-semibold rounded-lg">Back to Task Allocation</button>
      </section>
    );
  }

  function appendAudit(text) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, audit: [{ text, at: new Date().toISOString() }, ...(t.audit || [])] } : t)));
  }

  function handleSaveStatus() {
    if (!statusDraft) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: statusDraft } : t)));
    appendAudit(`${task.assignee} changed status to ${statusDraft}${statusNote.trim() ? ` — ${statusNote.trim()}` : ''}`);
    setStatusNote('');
  }

  function handleReassign() {
    if (!reassignTo || reassignTo === task.assignee) return;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, assignee: reassignTo } : t)));
    appendAudit(`${task.assignedBy} reassigned this to ${reassignTo}${reassignReason.trim() ? ` — ${reassignReason.trim()}` : ''}`);
    setReassignReason('');
  }

  function handleEditSubmit(data) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...data } : t)));
    setIsEditOpen(false);
  }

  return (
    <section className="w-full space-y-4">
      <PageHeader
        title={task.title}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'CRM' },
          { label: 'Task Allocation', path: '/crm/tasks/allocation' },
          { label: task.title },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="btn-primary"
            >
              <Pencil size={16} /> Edit
            </button>
            <button type="button" onClick={() => navigate('/crm/tasks/allocation')} className="text-[13px] font-medium text-slate-700 hover:text-slate-900">
              Back
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <h2 className="text-[15px] font-bold text-slate-900">{task.title}</h2>
            <p className="text-[13px] text-slate-400 mt-1">{task.description || 'No description.'}</p>
            {task.fileName && <p className="text-xs text-slate-500 mt-2">File: {task.fileName}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5 mt-6">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assignee</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.assignee}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assigned By</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.assignedBy}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Department</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.department}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Priority</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.priority}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Deadline</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.deadline ? formatDeadline(task.deadline) : 'No deadline'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.status}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <h3 className="text-[13px] font-bold text-slate-900 mb-3">Update Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:border-blue-400">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Note (optional)" className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
              <button type="button" onClick={handleSaveStatus} className="px-5 py-2.5 bg-[#1d4a79] hover:bg-[#163a61] text-white text-[13px] font-semibold rounded-lg transition">Save</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <h3 className="text-[13px] font-bold text-slate-900 mb-3">Reassign</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:border-blue-400">
                {EMPLOYEES.map((e) => (
                  <option key={e.name} value={e.name}>{e.name}</option>
                ))}
              </select>
              <input value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="Reason (optional)" className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
              <button type="button" onClick={handleReassign} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-[#1d4a79] text-[13px] font-medium rounded-lg border border-[#1d4a79] transition">Reassign</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <h3 className="text-[13px] font-bold text-slate-900 mb-4">Audit Log</h3>
            <div className="relative pl-4 border-l border-slate-200 space-y-5">
              {(task.audit || []).map((a, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-500 border-2 border-white shadow" />
                  <p className="text-[13px] text-slate-700">{a.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatAuditDate(a.at)}</p>
                </div>
              ))}
              {(!task.audit || task.audit.length === 0) && <p className="text-xs text-slate-400">No activity yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <AssignTaskModal isOpen={isEditOpen} initial={task} onClose={() => setIsEditOpen(false)} onSubmit={handleEditSubmit} />
    </section>
  );
}
