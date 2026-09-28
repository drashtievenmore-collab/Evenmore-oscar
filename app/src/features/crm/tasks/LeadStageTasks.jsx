import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";
import InfoBanner from "../common/InfoBanner";
import StageTasksGuideModal from "./StageTasksGuideModal";
import { useCrmStore } from "../../../stores/crmStore";
import { syncCollection } from "../../../services/crmCollections";

const STAGE_THEMES = [
  {
    headerBg: "bg-[#eff6ff] border-[#dbeafe]",
    badgeBg: "bg-blue-600 text-white",
    ribbonBg: "bg-blue-600 text-white shadow-xs",
    badgeNumber: 1,
  },
  {
    headerBg: "bg-[#f0fdf4] border-[#bbf7d0]",
    badgeBg: "bg-emerald-600 text-white",
    ribbonBg: "bg-[#ccfbf1] text-[#0f766e]",
    badgeNumber: 2,
  },
  {
    headerBg: "bg-[#fefce8] border-[#fef08a]",
    badgeBg: "bg-amber-500 text-white",
    ribbonBg: "bg-[#fef9c3] text-[#a16207]",
    badgeNumber: 3,
  },
  {
    headerBg: "bg-[#faf5ff] border-[#f3e8ff]",
    badgeBg: "bg-purple-600 text-white",
    ribbonBg: "bg-[#f3e8ff] text-[#7e22ce]",
    badgeNumber: 4,
  },
  {
    headerBg: "bg-[#eef2ff] border-[#e0e7ff]",
    badgeBg: "bg-indigo-600 text-white",
    ribbonBg: "bg-[#e0e7ff] text-[#4338ca]",
    badgeNumber: 5,
  },
  {
    headerBg: "bg-[#eff6ff] border-[#dbeafe]",
    badgeBg: "bg-sky-600 text-white",
    ribbonBg: "bg-[#dbeafe] text-[#1d4ed8]",
    badgeNumber: 6,
  },
  {
    headerBg: "bg-[#f0fdf4] border-[#dcfce7]",
    badgeBg: "bg-teal-600 text-white",
    ribbonBg: "bg-[#dcfce7] text-[#15803d]",
    badgeNumber: 7,
  },
  {
    headerBg: "bg-[#fff1f2] border-[#ffe4e6]",
    badgeBg: "bg-rose-500 text-white",
    ribbonBg: "bg-[#ffe4e6] text-[#be123c]",
    badgeNumber: 8,
  },
];

const TASK_ROLE_MAP = {
  "Call": "Tele Caller Executive",
  "Call customer": "Tele Caller Executive",
  "Send email": "Sales Support Executive",
  "Send quotation": "BDE",
  "Schedule demo": "Area Sales Manager",
  "Client meeting": "Sales Support Executive",
  "Negotiate pricing": "BDE",
};

const DEFAULT_TASK_OPTIONS = [
  "Call",
  "Send email",
  "Send quotation",
  "Schedule demo",
  "Client meeting",
  "Negotiate pricing",
];

function getDynamicTaskOptions() {
  try {
    const raw = localStorage.getItem('leadMasterTasksV1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const names = parsed.map((m) => m.name).filter(Boolean);
        return [...new Set([...DEFAULT_TASK_OPTIONS, ...names])];
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_TASK_OPTIONS;
}

// Which pipeline the screen is looking at is a view preference, not data.
const PIPELINE_KEY = 'leadStageTasksPipelineV1';

/** A blank stage task, as the "add task" form opens it. */
const EMPTY_MASTER_TASK = {
  name: '',
  description: '',
  role: '',
  department: '',
  priority: 'Medium',
  dueIn: 1,
  autoCreate: true,
  isActive: true,
};

function getStoredPipeline() {
  try {
    return localStorage.getItem(PIPELINE_KEY) || 'Sales';
  } catch { /* ignore */ }
  return 'Sales';
}

/**
 * The screen renders a stage with its tasks nested. The API keeps them apart
 * (`/crm/stages/` and `/crm/stage-tasks/`), so they are joined here.
 */
function stagesWithTasks(stages, stageTasks) {
  return stages.map((stage) => ({
    ...stage,
    tasks: stageTasks
      .filter((task) => task.stageId === stage.id)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
  }));
}

export default function LeadStageTasks({ leadForms = [] }) {
  const storeStages = useCrmStore((s) => s.stages);
  const storeStageTasks = useCrmStore((s) => s.stageTasks);
  const [stages, setStages] = useState([]);
  // Each distinct tree state is written back at most once. Without this,
  // a sync that never sticks (offline create/update that the server
  // rejects) re-triggers this effect via the store subscription forever —
  // "Maximum update depth exceeded".
  const lastSyncedRef = useRef('');

  useEffect(() => {
    setStages(stagesWithTasks(storeStages, storeStageTasks));
  }, [storeStages, storeStageTasks]);
  const [openStages, setOpenStages] = useState([]);
  const [isTaskRolesOpen, setIsTaskRolesOpen] = useState(false);
  const [pipeline, setPipeline] = useState(getStoredPipeline);
  const [taskModalStageId, setTaskModalStageId] = useState(null);
  const [masterTask, setMasterTask] = useState(EMPTY_MASTER_TASK);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [stageDrafts, setStageDrafts] = useState({});
  const taskOptions = useMemo(() => getDynamicTaskOptions(), []);


  // An edit anywhere in the tree is written back as the flat task collection
  // the API stores, with each task carrying the stage it belongs to.
  useEffect(() => {
    if (stages.length === 0) return;
    const flat = stages.flatMap((stage) =>
      (stage.tasks || []).map((task, index) => ({ ...task, stageId: stage.id, order: index + 1 }))
    );
    const key = JSON.stringify(flat);
    if (key === lastSyncedRef.current) return;
    lastSyncedRef.current = key;
    syncCollection('stageTasks', flat, storeStageTasks);
  }, [stages, storeStageTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_KEY, pipeline);
    } catch { /* ignore */ }
  }, [pipeline]);

  /** Re-read the configured stages and their tasks from the server. */
  function resetToDefaults() {
    const store = useCrmStore.getState();
    Promise.all([store.refresh('stages'), store.refresh('stageTasks')]).catch((err) => {
      console.warn('[CRM] could not reload stage tasks:', err?.message || err);
    });
  }

  function getDraft(stageId) {
    return (
      stageDrafts[stageId] || {
        name: "Call",
        order: 0,
        required: true,
        autoCreate: true,
        repeats: "",
        dueIn: "",
      }
    );
  }

  function updateDraft(stageId, key, value) {
    setStageDrafts((prev) => ({
      ...prev,
      [stageId]: {
        ...getDraft(stageId),
        [key]: value,
      },
    }));
  }

  function addDraftTask(stageId) {
    const draft = getDraft(stageId);
    const role = TASK_ROLE_MAP[draft.name] || "Tele Caller Executive";
    setStages((current) =>
      current.map((stage) => {
        if (stage.id !== stageId) return stage;
        return {
          ...stage,
          tasks: [
            ...stage.tasks,
            {
              id: Date.now(),
              name: draft.name,
              description: `${draft.name} task`,
              role,
              department: "Any",
              order: Number(draft.order) || 0,
              required: draft.required ?? true,
              autoCreate: draft.autoCreate ?? true,
              repeats: draft.repeats === "" ? 14 : Number(draft.repeats) || 0,
              dueIn: draft.dueIn === "" ? 0 : Number(draft.dueIn) || 0,
            },
          ],
        };
      })
    );
    setStageDrafts((prev) => ({
      ...prev,
      [stageId]: {
        name: "Call",
        order: 0,
        required: true,
        autoCreate: true,
        repeats: "",
        dueIn: "",
      },
    }));
    triggerSaveToast();
  }

  function addTask(stageId) {
    setTaskModalStageId(stageId || stages[0].id);
    setMasterTask(EMPTY_MASTER_TASK);
  }

  function closeTaskModal() {
    setTaskModalStageId(null);
  }

  function updateMasterTask(key, value) {
    setMasterTask((current) => ({ ...current, [key]: value }));
  }

  function createMasterTask(event) {
    event.preventDefault();
    if (!masterTask.name.trim()) return;

    setStages((current) =>
      current.map((stage) => {
        if (stage.id !== taskModalStageId) return stage;
        return {
          ...stage,
          tasks: [
            ...stage.tasks,
            {
              id: Date.now(),
              name: masterTask.name.trim(),
              description: masterTask.description.trim() || "New stage task",
              role: masterTask.role || "Tele Caller Executive",
              department: masterTask.department || "Any",
              priority: masterTask.priority,
              time: masterTask.time,
              form: masterTask.form,
              order: stage.tasks.length,
              required: true,
              autoCreate: true,
              repeats: Number(masterTask.repeats) || 1,
              dueIn: Number(masterTask.dueIn) || 0,
            },
          ],
        };
      })
    );
    if (!openStages.includes(taskModalStageId)) {
      setOpenStages((prev) => [...prev, taskModalStageId]);
    }
    closeTaskModal();
    triggerSaveToast();
  }

  function deleteTask(stageId, taskId) {
    setStages((current) =>
      current.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              tasks: stage.tasks.filter((task) => task.id !== taskId),
            }
          : stage
      )
    );
    triggerSaveToast();
  }

  function updateTask(stageId, taskId, key, value) {
    setStages((current) =>
      current.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              tasks: stage.tasks.map((task) =>
                task.id === taskId ? { ...task, [key]: value } : task
              ),
            }
          : stage
      )
    );
  }

  function toggleStage(stageId) {
    setOpenStages((current) =>
      current.includes(stageId)
        ? current.filter((id) => id !== stageId)
        : [...current, stageId]
    );
  }

  function triggerSaveToast() {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }

  const allRoleTasks = stages.flatMap((stage) =>
    stage.tasks.map((task) => ({ ...task, stageId: stage.id }))
  );

  return (
    <section className="w-full space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Leads</h2>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <div className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <span>CRM</span>
              <span>&gt;</span>
              <span>Leads</span>
              <span>&gt;</span>
              <span className="text-slate-600 font-semibold">Lead Stage Tasks</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Lead Stage Tasks
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign and manage tasks for each lead stage. When a lead moves to a stage, selected tasks are created automatically.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-2 rounded-[12px] border-2 border-[#1d6bff] bg-[#f2f7ff] px-3 py-2 text-[13px] font-semibold text-[#1d6bff]"
              aria-label="How to create lead stage tasks"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1d6bff] text-[12px] font-bold text-white">?</span>
              <span>How to create lead stage tasks?</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span>Pipeline</span>
              <select
                value={pipeline}
                onChange={(e) => setPipeline(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option>Sales</option>
                <option>Support</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => addTask(stages[0].id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus size={15} />
              Add Stage Task
            </button>
          </div>
        </div>
      </div>

      <InfoBanner
        storageKey="infoBannerLeadStageTasksV1"
        title="Why use Lead Stage Tasks?"
        text="These auto-create the right tasks when a lead enters a stage. You map tasks once, then every stage change creates follow-ups automatically."
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs mb-8 overflow-hidden">
        <div
          onClick={() => setIsTaskRolesOpen((prev) => !prev)}
          className="flex items-center justify-between gap-3 lg:gap-0 p-4 sm:p-5 cursor-pointer hover:bg-slate-50/50 transition select-none"
        >
          <div className="flex items-start gap-3">
            <span className="text-slate-500 mt-0.5">
              {isTaskRolesOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Task Roles</h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {allRoleTasks.length} Tasks
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Each task is done by one role. When a task is created on a lead it goes to whoever owns that role on the lead.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              addTask(stages[0].id);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer shrink-0"
          >
            <Plus size={14} />
            Add Task
          </button>
        </div>

        {isTaskRolesOpen && (
          <div className="border-t border-slate-100 overflow-x-auto">
            <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">TASK</th>
                  <th className="px-4 py-3">ROLE</th>
                  <th className="px-4 py-3">DEPARTMENT</th>
                  <th className="px-4 py-3">MAX REPEATS</th>
                  <th className="px-5 py-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allRoleTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {task.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={task.role}
                        onChange={(e) =>
                          updateTask(task.stageId, task.id, "role", e.target.value)
                        }
                        className="w-full max-w-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                      >
                        <option>Tele Caller Executive</option>
                        <option>Sales Support Executive</option>
                        <option>BDE</option>
                        <option>Area Sales Manager</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={task.department || "Any"}
                        onChange={(e) =>
                          updateTask(task.stageId, task.id, "department", e.target.value)
                        }
                        className="w-full max-w-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                      >
                        <option>Any</option>
                        <option>Sales</option>
                        <option>Support</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="number"
                        value={task.repeats}
                        onChange={(e) =>
                          updateTask(task.stageId, task.id, "repeats", Number(e.target.value))
                        }
                        className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                      />
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => triggerSaveToast()}
                          className="px-4 py-1.5 bg-[#17487d] hover:bg-[#12365e] text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(task.stageId, task.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">Lead Stage Tasks</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-3.5">
          Configure the tasks that are created when a lead enters each stage.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 p-1 bg-slate-50/50 rounded-2xl border border-slate-200/80 mb-5">
          {stages.map((stage, idx) => {
            const theme = STAGE_THEMES[idx] ?? STAGE_THEMES[0];
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => toggleStage(stage.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none truncate ${theme.ribbonBg}`}
              >
                <span className="w-4.5 h-4.5 rounded-full bg-white/25 flex items-center justify-center text-[10px] shrink-0 font-bold">
                  {idx + 1}
                </span>
                <span className="truncate">{stage.name}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3.5">
          {stages.map((stage, idx) => {
            const isOpen = openStages.includes(stage.id);
            const theme = STAGE_THEMES[idx] ?? STAGE_THEMES[0];
            const draft = getDraft(stage.id);

            return (
              <div
                key={stage.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
              >
                <div
                  onClick={() => toggleStage(stage.id)}
                  className={`flex items-center justify-between gap-2 lg:gap-0 px-4 sm:px-5 py-3 cursor-pointer transition select-none ${theme.headerBg}`}
                >
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 min-w-0 lg:min-w-auto">
                    <span className="text-slate-600">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${theme.badgeBg}`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{stage.name}</span>
                    <span className="text-xs text-slate-400 font-normal">
                      {stage.tasks.length} Tasks
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addTask(stage.id);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
                  >
                    <Plus size={13} />
                    Add Task
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full min-w-[900px] lg:min-w-0 text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                          <th className="px-3 py-3 w-64">TASK</th>
                          <th className="px-3 py-3">ROLE</th>
                          <th className="px-3 py-3 w-28">ORDER</th>
                          <th className="px-3 py-3 w-24 text-center">REQUIRED</th>
                          <th className="px-3 py-3 w-28 text-center">
                            <div>AUTO CREATE</div>
                            <div className="text-[9px] font-normal text-slate-400 normal-case tracking-normal mt-0.5">Auto-created when lead enters stage</div>
                          </th>
                          <th className="px-3 py-3 w-32">MAX REPEATS</th>
                          <th className="px-3 py-3 w-32">DUE IN (DAYS)</th>
                          <th className="px-3 py-3 w-40 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {stage.tasks.map((task) => {
                          const currentRole = task.role || TASK_ROLE_MAP[task.name] || "Tele Caller Executive";
                          return (
                            <tr key={task.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-3 py-2.5">
                                <select
                                  value={task.name}
                                  onChange={(e) => {
                                    const newName = e.target.value;
                                    const newRole = TASK_ROLE_MAP[newName] || task.role;
                                    updateTask(stage.id, task.id, "name", newName);
                                    updateTask(stage.id, task.id, "role", newRole);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                                >
                                  {taskOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1 bg-[#22b7c6] text-white text-xs font-semibold rounded-md shadow-2xs">
                                  {currentRole}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  value={task.order}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "order", Number(e.target.value))
                                  }
                                  className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 text-center focus:outline-none focus:border-blue-500 shadow-2xs"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={task.required}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "required", e.target.checked)
                                  }
                                  className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={task.autoCreate}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "autoCreate", e.target.checked)
                                  }
                                  className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="text"
                                  value={task.repeats ?? ""}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "repeats", e.target.value)
                                  }
                                  className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="text"
                                  value={task.dueIn ?? ""}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "dueIn", e.target.value)
                                  }
                                  className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                                />
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => triggerSaveToast()}
                                    className="px-3.5 py-1.5 bg-[#0f4c81] hover:bg-[#0c3c66] text-white text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteTask(stage.id, task.id)}
                                    className="px-3 py-1.5 bg-white border border-[#f43f5e] text-[#f43f5e] hover:bg-rose-50 text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        <tr className="bg-white hover:bg-slate-50/50 transition">
                          <td className="px-3 py-2.5">
                            <select
                              value={draft.name}
                              onChange={(e) => updateDraft(stage.id, "name", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                            >
                              {taskOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 bg-transparent text-transparent text-xs font-semibold rounded-md min-w-[20px]">
                              &nbsp;
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              value={draft.order}
                              onChange={(e) =>
                                updateDraft(stage.id, "order", Number(e.target.value))
                              }
                              className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 text-center focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={draft.required}
                              onChange={(e) => updateDraft(stage.id, "required", e.target.checked)}
                              className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={draft.autoCreate}
                              onChange={(e) =>
                                updateDraft(stage.id, "autoCreate", e.target.checked)
                              }
                              className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              placeholder="default"
                              value={draft.repeats}
                              onChange={(e) => updateDraft(stage.id, "repeats", e.target.value)}
                              className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              placeholder="default"
                              value={draft.dueIn}
                              onChange={(e) => updateDraft(stage.id, "dueIn", e.target.value)}
                              className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => addDraftTask(stage.id)}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#50667a] hover:bg-[#415363] text-white text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
                            >
                              <Plus size={13} /> Add
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {taskModalStageId && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
          role="presentation"
          onMouseDown={closeTaskModal}
        >
          <form
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden"
            onSubmit={createMasterTask}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Create New Master Task</h2>
              <button
                type="button"
                onClick={closeTaskModal}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                aria-label="Close task form"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Name <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  value={masterTask.name}
                  onChange={(e) => updateMasterTask("name", e.target.value)}
                  placeholder="Enter Task Name"
                  required
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Performed By (Role)
                  </label>
                  <select
                    value={masterTask.role}
                    onChange={(e) => updateMasterTask("role", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  >
                    <option>Tele Caller Executive</option>
                    <option>Sales Support Executive</option>
                    <option>BDE</option>
                    <option>Area Sales Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={masterTask.department}
                    onChange={(e) => updateMasterTask("department", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  >
                    <option>Any</option>
                    <option>Sales</option>
                    <option>Support</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Priority
                  </label>
                  <select
                    value={masterTask.priority}
                    onChange={(e) => updateMasterTask("priority", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due In (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={masterTask.dueIn}
                    onChange={(e) => updateMasterTask("dueIn", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Repeats
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={masterTask.repeats}
                    onChange={(e) => updateMasterTask("repeats", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Time
                  </label>
                  <input
                    type="time"
                    value={masterTask.time}
                    onChange={(e) => updateMasterTask("time", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={masterTask.description}
                  onChange={(e) => updateMasterTask("description", e.target.value)}
                  placeholder="Enter Description"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
              <button
                type="button"
                onClick={closeTaskModal}
                className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer text-xs"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg text-xs font-semibold">
          <CheckCircle2 size={16} />
          <span>Stage tasks updated successfully!</span>
        </div>
      )}
      <StageTasksGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </section>
  );
}
