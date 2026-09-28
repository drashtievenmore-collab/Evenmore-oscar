import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  X,
  Pencil,
  Copy,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Phone,
  Monitor,
  Clock,
  Gift,
  Users,
  FileText,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';

import MasterTasksGuideModal from './MasterTasksGuideModal';
import InfoBanner from '../common/InfoBanner';
import { useCrmStore } from '../../../stores/crmStore';
import { syncCollection } from '../../../services/crmCollections';


const ROLES = ['Tele Caller Executive', 'Sales Support Executive', 'BDE', 'Area Sales Manager'];
const DEPARTMENTS = ['Sales', 'Support', 'Marketing'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Active', 'Inactive'];
const STAGES = ['New Lead', 'Details Collected', 'Quotation Shared', 'Demo Pending', 'Demo Done', 'Negotiation', 'Won', 'Lost'];
const ICONS = ['call', 'demo', 'pending', 'meeting', 'formal', 'quotation'];
const PER_PAGE_OPTIONS = [5, 10, 20, 50];

const STAGE_STYLES = {
  'New Lead': 'bg-blue-50 text-blue-700 border-blue-100',
  'Details Collected': 'bg-teal-50 text-teal-700 border-teal-100',
  'Quotation Shared': 'bg-amber-50 text-amber-700 border-amber-100',
  'Demo Pending': 'bg-orange-50 text-orange-700 border-orange-100',
  'Demo Done': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Negotiation: 'bg-sky-50 text-sky-700 border-sky-100',
  Won: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Lost: 'bg-rose-50 text-rose-700 border-rose-100',
};

const ICON_STYLE = {
  call: 'bg-emerald-50 text-emerald-600',
  demo: 'bg-violet-50 text-violet-600',
  pending: 'bg-orange-50 text-orange-500',
  meeting: 'bg-rose-50 text-rose-500',
  formal: 'bg-blue-50 text-blue-600',
  quotation: 'bg-amber-50 text-amber-600',
};

/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

function iconFor(key) {
  if (key === 'demo') return Monitor;
  if (key === 'pending') return Clock;
  if (key === 'meeting') return Gift;
  if (key === 'formal') return Users;
  if (key === 'quotation') return FileText;
  return Phone;
}



const EMPTY_FORM = {
  name: '',
  icon: 'call',
  stages: [],
  role: 'Tele Caller Executive',
  department: 'Sales',
  priority: 'Medium',
  dueIn: 0,
  status: 'Active',
};

export default function MasterTasksPage() {
  const navigate = useNavigate();
  // Master task templates live at `/crm/master-tasks/`; the automation that
  // generates a lead's stage tasks reads the same rows.
  const storeTasks = useCrmStore((s) => s.masterTasks);
  const [tasks, setTasks] = useState([]);
  useEffect(() => { setTasks(storeTasks); }, [storeTasks]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('order');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // Each distinct list is synced at most once — a sync that never sticks
  // (offline write the server rejects) must not re-trigger this effect
  // via the store subscription forever ("Maximum update depth exceeded").
  const lastSyncedRef = useRef('');

  useEffect(() => {
    if (tasks.length > 0 || storeTasks.length > 0) {
      const key = JSON.stringify(tasks);
      if (key === lastSyncedRef.current) return;
      lastSyncedRef.current = key;
      syncCollection('masterTasks', tasks, storeTasks);
    }
  }, [tasks, storeTasks]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, deptFilter, statusFilter, perPage]);

  function resetFilters() {
    setSearch('');
    setRoleFilter('All');
    setDeptFilter('All');
    setStatusFilter('All');
    setPage(1);
    setSelected([]);
  }

  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = tasks.filter((t) => {
      if (roleFilter !== 'All' && t.role !== roleFilter) return false;
      if (deptFilter !== 'All' && t.department !== deptFilter) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        text(t.name).includes(q) ||
        text(t.role).includes(q) ||
        text(t.department).includes(q) ||
        (t.stages || []).join(' ').toLowerCase().includes(q)
      );
    });
    const sorted = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''));
      else cmp = (a.order || 0) - (b.order || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [tasks, search, roleFilter, deptFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, filtered.length);
  const allChecked = pageItems.length > 0 && pageItems.every((t) => selected.includes(t.id));

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectPage() {
    if (allChecked) {
      setSelected((prev) => prev.filter((id) => !pageItems.some((t) => t.id === id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageItems.map((t) => t.id)])]);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(task) {
    setEditingId(task.id);
    setForm({
      name: task.name,
      icon: task.icon || 'call',
      stages: [...(task.stages || [])],
      role: task.role,
      department: task.department,
      priority: task.priority,
      dueIn: task.dueIn,
      status: task.status,
    });
    setFormError('');
    setModalOpen(true);
    setMenuId(null);
  }

  function toggleStageInForm(stage) {
    setForm((f) => ({
      ...f,
      stages: f.stages.includes(stage) ? f.stages.filter((s) => s !== stage) : [...f.stages, stage],
    }));
  }

  function submitForm(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Task name is required.');
      return;
    }
    if (form.stages.length === 0) {
      setFormError('Select at least one stage.');
      return;
    }
    if (editingId) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...form, name: form.name.trim(), dueIn: Number(form.dueIn) || 0 } : t)));
    } else {
      const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
      setTasks((prev) => [
        ...prev,
        { id: `mt-${Date.now()}`, order: maxOrder + 1, ...form, name: form.name.trim(), dueIn: Number(form.dueIn) || 0 },
      ]);
    }
    setModalOpen(false);
    setEditingId(null);
  }

  function duplicateTask(id) {
    const src = tasks.find((t) => t.id === id);
    if (!src) return;
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const copy = { ...src, id: `mt-${Date.now()}`, order: maxOrder + 1, name: `${src.name} Copy`, stages: [...src.stages] };
    setTasks((prev) => [...prev, copy]);
    setMenuId(null);
  }

  function toggleStatus(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: t.status === 'Active' ? 'Inactive' : 'Active' } : t)));
    setMenuId(null);
  }

  function confirmDelete() {
    if (!deleteId) return;
    setTasks((prev) => prev.filter((t) => t.id !== deleteId));
    setSelected((prev) => prev.filter((id) => id !== deleteId));
    setDeleteId(null);
  }

  function confirmBulkDelete() {
    setTasks((prev) => prev.filter((t) => !selected.includes(t.id)));
    setSelected([]);
    setBulkDelete(false);
  }

  function priorityPill(priority) {
    if (priority === 'High') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (priority === 'Low') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
  }

  return (
    <section className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manage Master Lead Tasks</h1>
          <p className="text-xs text-slate-500 mt-1">Create and manage reusable tasks that can be assigned to different lead stages.</p>
        </div>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="inline-flex items-center gap-2 rounded-[12px] border-2 border-[#1d6bff] bg-[#f2f7ff] px-3 py-2 text-[13px] font-semibold text-[#1d6bff]"
            aria-label="How to create lead tasks master"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1d6bff] text-[12px] font-bold text-white">?</span>
            <span>How to create lead tasks master?</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
          >
            <Plus size={15} /> Create Master Task
          </button>
        </div>
      </div>

      <InfoBanner
        storageKey="leadMasterTasksBannerV2"
        title="Why use Master Lead Tasks?"
        text="Create reusable tasks such as calls, demos and quotations once, then link them to the relevant lead stages. Set the responsible role, department, priority and due days so your team follows a consistent process for every lead."
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 p-3.5 border-b border-slate-100">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task name, role or department..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="All">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="All">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="All">All Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50/60 border-b border-blue-100 text-xs">
            <span className="font-semibold text-blue-700">{selected.length} selected</span>
            <button type="button" onClick={() => setBulkDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition">
              <Trash2 size={13} /> Delete selected
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1020px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleSelectPage} className="w-4 h-4 rounded border-slate-300 cursor-pointer" />
                </th>
                <th className="px-2 py-3 w-12">
                  <button type="button" onClick={() => toggleSort('order')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    # {sortKey === 'order' ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    Task Name {sortKey === 'name' ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
                  </button>
                </th>
                <th className="px-3 py-3">Used in Stages</th>
                <th className="px-3 py-3">Assigned Role</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Due In (Days)</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((t, idx) => {
                const Icon = iconFor(t.icon);
                const visibleStages = (t.stages || []).slice(0, 2);
                const extra = (t.stages || []).length - visibleStages.length;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleSelect(t.id)} className="w-4 h-4 rounded border-slate-300 cursor-pointer" />
                    </td>
                    <td className="px-2 py-3 text-slate-500">{(safePage - 1) * perPage + idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-bold text-slate-800 whitespace-nowrap">
                        <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${ICON_STYLE[t.icon] || ICON_STYLE.call}`}>
                          <Icon size={14} />
                        </span>
                        {t.name}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        {visibleStages.map((s) => (
                          <span key={s} className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${STAGE_STYLES[s] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{s}</span>
                        ))}
                        {extra > 0 && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">+{extra}</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 font-medium whitespace-nowrap">{t.role}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{t.department}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${priorityPill(t.priority)}`}>
                        {t.priority === 'Low' ? <ArrowDown size={11} /> : <ArrowUp size={11} />} {t.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-center">{t.dueIn}</td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => toggleStatus(t.id)} title="Toggle status" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                        <span className={`w-2 h-2 rounded-full ${t.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`} /> {t.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 relative">
                        <button type="button" onClick={() => openEdit(t)} title="Edit" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => duplicateTask(t.id)} title="Duplicate" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                          <Copy size={15} />
                        </button>
                        <button type="button" onClick={() => setDeleteId(t.id)} title="Delete" className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                          <Trash2 size={15} />
                        </button>
                        <button type="button" onClick={() => setMenuId(menuId === t.id ? null : t.id)} title="More" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                          <MoreVertical size={15} />
                        </button>
                        {menuId === t.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                            <button type="button" onClick={() => toggleStatus(t.id)} className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Mark {t.status === 'Active' ? 'Inactive' : 'Active'}
                            </button>
                            <button type="button" onClick={() => duplicateTask(t.id)} className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Duplicate task
                            </button>
                            <button type="button" onClick={() => navigate('/crm/leads/stage-tasks')} className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Open Stage Tasks
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-700">No tasks found</p>
                    <p className="text-xs text-slate-500 mt-1">Try a different search or reset filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-t border-slate-100 text-xs text-slate-500 pr-20 sm:pr-24">
          <span>Showing {from} to {to} of {filtered.length} tasks</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer" aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-7 h-7 px-2 rounded-lg border text-xs font-bold transition cursor-pointer ${p === safePage ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer" aria-label="Next page">
              <ChevronRight size={14} />
            </button>
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer">
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <form onSubmit={submitForm} onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Master Task' : 'Create Master Task'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3.5 max-h-[72vh] overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Name <span className="text-rose-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Call, Demo, Quotation" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due In (Days)</label>
                  <input type="number" min="0" value={form.dueIn} onChange={(e) => setForm({ ...form, dueIn: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {ICONS.map((key) => {
                    const Icon = iconFor(key);
                    const active = form.icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm({ ...form, icon: key })}
                        className={`h-10 rounded-lg border grid place-items-center transition ${active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Used in Stages <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STAGES.map((s) => {
                    const checked = form.stages.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStageInForm(s)}
                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${checked ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <span className={`w-4 h-4 rounded border grid place-items-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                          <Check size={11} />
                        </span>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition">
                {editingId ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setDeleteId(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete this task?</h2>
            <p className="text-xs text-slate-500 mt-1">This action cannot be undone. The master task will be removed permanently.</p>
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setBulkDelete(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete {selected.length} tasks?</h2>
            <p className="text-xs text-slate-500 mt-1">Selected master tasks will be removed permanently.</p>
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button type="button" onClick={() => setBulkDelete(false)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition">
                Cancel
              </button>
              <button type="button" onClick={confirmBulkDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      <MasterTasksGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </section>
  );
}
