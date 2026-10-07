import { findDealForLead } from '../../../services/dealService';
import CrmKpiCard from '../common/CrmKpiCard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useERP } from '../../../context/ERPContext';
import { formatCurrency } from '../../../utils/currencyUtils';
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FileStack,
  Info,
  ListChecks,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  CheckCircle,
  Eye,
  Send,
  UserCheck,
  Building2,
  Paperclip,
  Share2,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Clock,
  Check,
  CheckSquare,
  Square,
  FileText,
  Truck,
  Receipt,
  Printer,
  Download,
  Upload,
  Globe,
  Tag,
  Megaphone,
  User,
  ChevronDown,
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  X,
  Users,
  XCircle,
} from 'lucide-react';
import LeadAvatar from './LeadAvatar';
import LeadFormBuilder from './LeadFormBuilder';
import { createFieldFromType } from '../../../data/crm/leadFormSchema';
import { exportToCSV } from '../../../services/exportUtils';
import { useEstimates, estimateMatchesLead, addEstimate } from '../../../services/estimateStore';
import { useCrmStore } from '../../../stores/crmStore';
import { withSampleTeam } from '../common/sampleTeam';
import { useLeadDetailStore, EMPTY_DETAIL } from '../../../stores/leadDetailStore';
import { isServerId, isBackendEnabled } from '../../../services/resourceSync';
import { WRITABLE_LEAD_SECTIONS } from '../../../services/leadDetailMap';
import { loadForms, saveForms, TASK_FORM } from '../../../services/crmForms';
import { LineItemEditor } from '../../../components/common/LineItemEditor';
import { loadCrmTasks, saveCrmTasks, runLeadStageAutomation, TASK_SOURCE_AUTOMATION } from '../../../services/leadStageAutomation';
import { emitCrmEvent, CRM_EVENT_TYPES } from '../../../services/crmEventNotifications';
import { useAppStore } from '../../../stores/appStore';
import { completeTaskWithOutcome, NEXT_ACTION_LABELS, getLeadStageOrder } from '../../../services/taskCompletionService';
import CompleteTaskModal from '../tasks/CompleteTaskModal';

const DETAIL_TABS = [
  'General',
  'Users & Products',
  'Sources & Emails',
  'Discussion & Notes',
  'Files',
  'Tasks',
  'Calls',
  'Estimates',
  'Quotations',
  'Delivery Challans',
  'Activity',
];

const DETAIL_TAB_ICONS = {
  General: Info,
  'Users & Products': UserCheck,
  'Sources & Emails': Globe,
  'Discussion & Notes': Share2,
  Files: FileStack,
  Tasks: ListChecks,
  Calls: Phone,
  Estimates: Receipt,
  Quotations: FileText,
  'Delivery Challans': Truck,
  Activity: Sparkles,
};

/**
 * The drawer used to keep a lead and its sections in two localStorage blobs.
 * Both now go to the API: the lead row through the CRM store, each section
 * through its own sub-collection endpoint.
 */
function updateStoredLead(leadId, updates) {
  if (!leadId || !updates || Object.keys(updates).length === 0) return false;
  useCrmStore.getState().updateLead(leadId, updates).catch((err) => {
    console.warn('[CRM] lead not saved:', err?.message || err);
  });
  return true;
}

/**
 * Persist rows a tab just produced. Each key is a sub-collection, and only the
 * rows the server has not seen are posted — the rest are already its own.
 *
 * Sections without a write endpoint (`timeline`, `tasks`, `activities`) are
 * skipped: there is no `POST /crm/leads/{id}/timeline/` to receive them.
 * Rows with no server representation (file previews without a file record)
 * are left local by the mapping layer instead of 400ing.
 *
 * Each local row is posted at most once per page lifetime. Without this, every
 * re-run of a tab's persist effect (StrictMode double-effect, parent
 * re-render, tab remount) re-posts all unsynced rows, so one click becomes
 * many server rows.
 */
const sentDetailRowIds = new Set();
function updateStoredLeadDetail(leadId, updates) {
  if (!leadId || !updates || Object.keys(updates).length === 0) return false;
  const { add } = useLeadDetailStore.getState();
  Object.entries(updates).forEach(([section, rows]) => {
    if (!Array.isArray(rows)) return;
    if (!WRITABLE_LEAD_SECTIONS.has(section)) return;
    rows
      .filter((row) => row && !row._synced && !isServerId(row.id) && row.id && !sentDetailRowIds.has(row.id))
      .forEach((row) => {
        sentDetailRowIds.add(row.id);
        add(leadId, section, row).catch((err) => {
          console.warn(`[CRM] ${section} not saved:`, err?.message || err);
        });
      });
  });
  return true;
}

function limitItems(items, count) {
  if (!Array.isArray(items)) return [];
  const normalizedCount = Number(count);
  if (!Number.isFinite(normalizedCount)) return items;
  if (normalizedCount <= 0) return [];
  return items.slice(0, normalizedCount);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function formatAmount(value) {
  const activeCurrency = localStorage.getItem('evenmore_currency') || 'USD ($)';
  return formatCurrency(value || 0, activeCurrency, { noDecimals: true });
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function statusClass(value) {
  return String(value || '').toLowerCase() === 'active' ? 'green' : 'amber';
}


// ── helpers the drawer's tabs share ─────────────────────────────────────────

/** Lead source icons are stored by name and resolved to a component to render. */
const SOURCE_ICONS = {
  website: Globe,
  email: Mail,
  phone: Phone,
  call: Phone,
  referral: Users,
  campaign: Megaphone,
  exhibition: Building2,
  default: Globe,
};

export function sourceIconName(icon) {
  if (typeof icon === 'string') return icon;
  const match = Object.entries(SOURCE_ICONS).find(([, component]) => component === icon);
  return match ? match[0] : 'default';
}

export function resolveSourceIcon(icon) {
  if (icon && typeof icon !== 'string') return icon;
  return SOURCE_ICONS[String(icon || 'default').toLowerCase()] || SOURCE_ICONS.default;
}

export const LEAD_TASK_PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
export const LEAD_TASK_STATUS_OPTIONS = ['Open', 'In Progress', 'Waiting', 'Completed'];

/** The task form definitions, from `/crm/forms/`. */
function getLeadTaskForms() {
  return loadForms(TASK_FORM);
}

function saveLeadTaskForms(forms) {
  saveForms(forms, TASK_FORM);
}

function createLeadTaskForm(name, sections = []) {
  return {
    id: `task-form-${Date.now()}`,
    title: String(name || 'Untitled form').trim(),
    description: '',
    sections,
    fields: sections.flatMap((section) => (section.fields || []).map((field) => field.label)),
    status: 'ACTIVE',
    lastUpdated: new Date().toLocaleDateString('en-GB'),
  };
}

function getTaskFormFields(formId) {
  const form = getLeadTaskForms().find((f) => String(f.id) === String(formId));
  if (!form) return [];
  if (Array.isArray(form.sections) && form.sections.length > 0) {
    return form.sections.flatMap((section) => section.fields || []);
  }
  return (form.fields || []).map((label, index) => ({ id: `f-${index}`, label, type: 'text' }));
}

/** The master task templates a stage can draw on, from `/crm/master-tasks/`. */
function getMasterTaskOptions() {
  return useCrmStore.getState().masterTasks.map((task) => task.name || task.title).filter(Boolean);
}

/** `DD/MM/YYYY, hh:mm` — what the task rows render — and back again. */
function parseLeadTaskDueAt(value) {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct);
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

function formatLeadTaskDueAt(value) {
  const date = parseLeadTaskDueAt(value);
  if (!date) return String(value || '');
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/**
 * One lead's sections, as the server returned them. Anything the server has no
 * rows for stays empty — the drawer shows an empty state instead of invented
 * contacts, files or a fabricated timeline.
 */
function leadDetailState(detail) {
  const stored = detail || EMPTY_DETAIL;
  return {
    users: stored.users || [],
    products: stored.products || [],
    sources: stored.sources || [],
    emails: stored.emails || [],
    timeline: stored.timeline || [],
    files: stored.files || [],
    calls: stored.calls || [],
    notes: stored.notes || [],
    threads: stored.threads || [],
    tasks: stored.tasks || [],
    activities: stored.activities || [],
  };
}

/** Subscribe to one lead's sections and trigger the load on first use. */
function useLeadDetailState(lead) {
  const leadId = lead?.id;
  const detail = useLeadDetailStore((s) => s.byLead[String(leadId || '')]);
  const load = useLeadDetailStore((s) => s.load);
  useEffect(() => {
    if (leadId) load(leadId);
  }, [leadId, load]);
  return useMemo(() => leadDetailState(detail), [detail]);
}

function DiscussionAvatar({ thread, lead }) {
  if (thread?.kind === 'lead') {
    return <LeadAvatar lead={lead} className="discussion-avatar lead" />;
  }
  return (
    <span className="discussion-avatar discussion-avatar-badge" style={{ backgroundColor: thread?.color ?? '#2F6FED' }}>
      {getInitials(thread?.name)}
    </span>
  );
}

function formatNoteValue(currentValue, textarea, prefix, suffix = prefix, fallback = 'text') {
  const start = textarea?.selectionStart ?? currentValue.length;
  const end = textarea?.selectionEnd ?? currentValue.length;
  const selectedText = currentValue.slice(start, end);
  const insertValue = `${prefix}${selectedText || fallback}${suffix}`;
  const nextValue = `${currentValue.slice(0, start)}${insertValue}${currentValue.slice(end)}`;
  return {
    nextValue,
    selectionStart: start + prefix.length,
    selectionEnd: start + prefix.length + (selectedText || fallback).length,
  };
}

function fieldRows(lead) {
  return [
    ['Company', lead.company || '—'],
    ['Title', lead.jobTitle || '—'],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Amount', formatAmount(lead.amount)],
  ];
}

function addressRows(lead) {
  return [
    ['City', lead.city],
    ['State', lead.state],
    ['Country', lead.country],
  ];
}

function leadExportRows(lead) {
  return [
    ['Lead Name', lead.name],
    ['Company', lead.company],
    ['Title', lead.jobTitle],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Lead Source', lead.source],
    ['Lead Owner', lead.owner],
    ['Status', lead.status],
    ['Created On', lead.createdOn],
    ['City', lead.city],
    ['State', lead.state],
    ['Country', lead.country],
    ['Amount', formatAmount(lead.amount)],
  ];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadLeadAsExcel(lead) {
  const rows = leadExportRows(lead);
  const table = rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const workbook = `<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${table}</tbody></table>`;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(lead.name || 'lead').replace(/\s+/g, '_')}_details.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printLeadAsPdf(lead) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  const rows = leadExportRows(lead).map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(lead.name)} - Lead Details</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:40px}h1{margin:0 0 8px;font-size:24px}p{color:#64748b;margin:0 0 24px}table{border-collapse:collapse;width:100%;max-width:700px}th,td{border:1px solid #dbe2ea;padding:10px;text-align:left;font-size:14px}th{background:#f1f5f9;width:35%}</style></head><body><h1>${escapeHtml(lead.name)}</h1><p>Lead Details</p><table>${rows}</table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function metricCards(counts) {
  return [
    { label: 'Products', value: counts.products },
    { label: 'Sources', value: counts.sources },
    { label: 'Files', value: counts.files },
  ];
}

// ── 1. Sources & Emails Tab (Screenshot Focus) ────────────────
function SourcesAndEmailsTab({ lead, onCountsChange, onActivity }) {
  const initialState = useLeadDetailState(lead);
  const currentUser = useAppStore((s) => s.currentUser);
  const actorName = currentUser?.name || currentUser?.fullName || lead?.owner || '—';
  const [sources, setSources] = useState(() => initialState.sources);
  const [emails, setEmails] = useState(() => initialState.emails);
  const [timeline, setTimeline] = useState(() => initialState.timeline);

  const [showAddSource, setShowAddSource] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [newSource, setNewSource] = useState({ source: 'Website', details: '' });
  const [newEmail, setNewEmail] = useState({ subject: '', message: '' });
  const [recipients, setRecipients] = useState([lead.email].filter(Boolean));
  const [mailTo, setMailTo] = useState(lead.email || '');
  const [mailError, setMailError] = useState('');
  const editorRef = React.useRef(null);
  const [editorEmpty, setEditorEmpty] = useState(true);

  React.useEffect(() => {
    updateStoredLeadDetail(lead?.id, { sources: sources.map((s) => ({ ...s, icon: sourceIconName(s.icon) })), emails, timeline });
  }, [lead?.id, sources, emails, timeline]);

  React.useEffect(() => {
    onCountsChange?.({ sources: sources.length });
  }, [sources.length, onCountsChange]);

  function toggleRecipient(email) {
    setRecipients((current) => (current.includes(email) ? current.filter((r) => r !== email) : [...current, email]));
  }

  function addSource(event) {
    handleAddSource(event);
  }

  function sendEmail(event) {
    handleSendEmail(event);
  }

  function syncEditor() {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText || '';
    setNewEmail((prev) => ({ ...prev, message: text }));
    setEditorEmpty(text.trim() === '');
  }

  function formatDoc(command, value = null) {
    try {
      if (editorRef.current) editorRef.current.focus();
      document.execCommand(command, false, value);
    } catch {
      return;
    }
    syncEditor();
  }

  function runLink() {
    const url = window.prompt('Enter link URL', 'https://');
    if (url) formatDoc('createLink', url);
  }

  function openEmailModal() {
    setMailTo(lead.email || '');
    setMailError('');
    setNewEmail({ subject: '', message: '' });
    setEditorEmpty(true);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setShowSendEmail(true);
  }

  function closeEmailModal() {
    setShowSendEmail(false);
  }

  const handleAddSource = (e) => {
    e.preventDefault();
    if (!newSource.details) return;
    const iconName = newSource.source === 'Referral' ? 'user' : newSource.source === 'Advertisement' ? 'megaphone' : 'globe';
    const added = {
      id: Date.now(),
      source: newSource.source,
      sourceType: String(newSource.source ?? '').toLowerCase(),
      details: newSource.details,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdBy: actorName,
      color: '#1f6bff',
      icon: iconName,
    };
    setSources((current) => [added, ...current]);
    setNewSource({ source: 'Website', details: '' });
    setShowAddSource(false);
    onActivity?.(`Source "${added.source}" added`, '#10b981');
  };

  const handleSendEmail = (e) => {
    e.preventDefault();
    const toOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailTo.trim());
    if (!toOk) {
      setMailError('Enter a valid email address');
      return;
    }
    if (!newEmail.subject.trim()) return;
    const bodyText = (editorRef.current?.innerText || newEmail.message || '').trim();
    const now = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const addedEmail = {
      id: Date.now(),
      subject: newEmail.subject,
      date: now,
      person: actorName,
      status: 'Sent',
      statusColor: 'green',
    };
    const addedTimeline = {
      id: Date.now(),
      type: 'sent',
      title: newEmail.subject,
      preview: bodyText || 'Direct email communication with client representative.',
      date: now,
      author: actorName,
      dotColor: '#10b981',
    };
    setEmails((current) => [addedEmail, ...current]);
    setTimeline((current) => [addedTimeline, ...current]);
    setNewEmail({ subject: '', message: '' });
    setEditorEmpty(true);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setShowSendEmail(false);
    onActivity?.(`Email "${addedEmail.subject}" sent`, '#3b82f6');
  };

  const deleteSource = (id) => {
    const target = sources.find((s) => s.id === id);
    setSources((current) => current.filter((source) => source.id !== id));
    onActivity?.(`Source "${target?.source ?? 'entry'}" removed`, '#f59e0b');
  };
  const deleteEmail = (id) => {
    const target = emails.find((e) => e.id === id);
    setEmails((current) => current.filter((email) => email.id !== id));
    onActivity?.(`Email "${target?.subject ?? 'entry'}" deleted`, '#f59e0b');
  };

  // Graph compatibility alias: old codebase exposed SourcesEmailsTab; current UI uses SourcesAndEmailsTab.
  // Both names resolve to the same implementation so graph queries keep working.

  // Graph compatibility alias: old codebase exposed SourcesEmailsTab; current UI uses SourcesAndEmailsTab.
  // Both names resolve to the same implementation so graph queries keep working.

  return (
    <div className="space-y-4">
      {/* 2-Column Grid for Lead Sources & Emails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Lead Sources */}
        <div className="card">
          <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
            <h3 className="font-bold text-sm">Lead Sources ({sources.length})</h3>
            <button
              type="button"
              onClick={() => setShowAddSource(!showAddSource)}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={13} strokeWidth={2.4} /> Add Source
            </button>
          </div>

          {showAddSource && (
            <form onSubmit={handleAddSource} className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Source Channel</label>
                  <select
                    value={newSource.source}
                    onChange={(e) => setNewSource({ ...newSource, source: e.target.value })}
                    className="form-select text-xs"
                  >
                    <option value="Website">Website Form</option>
                    <option value="Referral">Client Referral</option>
                    <option value="Advertisement">Social Ads</option>
                    <option value="Cold Call">Direct Inbound Call</option>
                    <option value="Trade Fair">Trade Expo</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Specific Details / Notes</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inbound enquiry from landing page"
                    value={newSource.details}
                    onChange={(e) => setNewSource({ ...newSource, details: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddSource(false)} className="btn-ghost btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm">
                  Save Source
                </button>
              </div>
            </form>
          )}

          <div className="table-scroll">
            <table className="data-table text-xs min-w-[640px] lg:min-w-0">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Source</th>
                  <th>Details</th>
                  <th>Date</th>
                  <th>Created By</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, idx) => {
                  const Icon = resolveSourceIcon(s.icon);
                  return (
                    <tr key={s.id}>
                      <td className="text-slate-500 font-mono">{idx + 1}</td>
                      <td>
                        <div className="inline-flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
                            style={{ background: s.color }}
                          >
                            <Icon size={12} />
                          </div>
                          <span className="font-semibold">{s.source}</span>
                        </div>
                      </td>
                      <td className="font-semibold">{s.details}</td>
                      <td className="text-slate-500 font-mono text-xs whitespace-nowrap">{s.date}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: '#2F6FED' }}>{getInitials(s.createdBy)}</span>
                          <span className="text-xs font-medium">{s.createdBy}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSource(s.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Emails */}
        <div className="card">
          <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
            <h3 className="font-bold text-sm">Emails ({emails.length})</h3>
            <button
              type="button"
              onClick={openEmailModal}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={13} strokeWidth={2.4} /> Send Email
            </button>
          </div>

          {showSendEmail && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={closeEmailModal}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <h2 className="text-[15px] font-bold text-slate-800">Create Email</h2>
                  <button type="button" onClick={closeEmailModal} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSendEmail}>
                  <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[13px] font-semibold text-slate-600">Mail To<span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={mailTo}
                          onChange={(e) => { setMailTo(e.target.value); setMailError(''); }}
                          placeholder="Enter email"
                          className="mt-1.5 h-11 w-full border border-slate-300 rounded-lg px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
                        />
                        {mailError && <p className="text-[11px] text-rose-500 mt-1 font-medium">{mailError}</p>}
                      </div>
                      <div>
                        <label className="text-[13px] font-semibold text-slate-600">Subject<span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={newEmail.subject}
                          onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                          placeholder="Enter subject"
                          className="mt-1.5 h-11 w-full border border-slate-300 rounded-lg px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[13px] font-semibold text-slate-600">Description<span className="text-rose-500">*</span></label>
                      <div className="mt-1.5 border border-slate-300 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-white flex-wrap">
                          <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('bold')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><Bold size={15} /></button>
                          <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('italic')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><Italic size={15} /></button>
                          <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('underline')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><Underline size={15} /></button>
                          <button type="button" title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('strikeThrough')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><Strikethrough size={15} /></button>
                          <button type="button" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('insertUnorderedList')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><List size={15} /></button>
                          <button type="button" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('insertOrderedList')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><ListOrdered size={15} /></button>
                          <button type="button" title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('justifyLeft')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><AlignLeft size={15} /></button>
                          <button type="button" title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('justifyCenter')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><AlignCenter size={15} /></button>
                          <button type="button" title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('justifyRight')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><AlignRight size={15} /></button>
                          <button type="button" title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={runLink} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700"><Link2 size={15} /></button>
                        </div>
                        <div className="relative">
                          {editorEmpty && <span className="absolute left-3.5 top-3 text-sm text-slate-400 pointer-events-none">Write Here...</span>}
                          <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={syncEditor} className="min-h-[170px] max-h-[260px] overflow-y-auto px-3.5 py-3 text-sm text-slate-800 outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button type="button" onClick={closeEmailModal} className="h-10 px-6 rounded-lg bg-slate-500 hover:bg-slate-600 text-white text-sm font-semibold">Cancel</button>
                    <button type="submit" className="h-10 px-6 rounded-lg bg-[#1f6bff] hover:bg-blue-700 text-white text-sm font-semibold">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-scroll">
            <table className="data-table text-xs min-w-[640px] lg:min-w-0">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Subject</th>
                  <th>Date & Time</th>
                  <th>Sent/Received By</th>
                  <th>Status</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e, idx) => (
                  <tr key={e.id}>
                    <td className="text-slate-500 font-mono">{idx + 1}</td>
                    <td>
                      <div className="inline-flex items-center gap-2">
                        <Mail size={13} className="text-blue-500 shrink-0" />
                        <span className="font-bold">{e.subject}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 font-mono text-xs whitespace-nowrap">{e.date}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: '#2F6FED' }}>{getInitials(e.person)}</span>
                        <span className="text-xs font-medium">{e.person}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.status === 'Sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="View Message"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEmail(e.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Card: Email Activity Timeline */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Email Activity Timeline</h3>
        {(() => {
          const emailEntries = timeline.filter((item) => item.type === 'email' || item.type === 'sent');
          if (emailEntries.length === 0) {
            return (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>No email activity recorded.</p>
            );
          }
          return (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {emailEntries.map((item) => (
                <div key={item.id} className="relative flex items-start justify-between gap-4">
                  <span
                    className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
                    style={{ background: item.dotColor }}
                  />
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.type === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {item.type === 'sent' ? 'Sent' : 'Email'}
                      </span>
                      <strong className="text-xs font-bold" style={{ color: 'var(--text)' }}>{item.title}</strong>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{item.preview}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <time className="text-[11px] font-mono block" style={{ color: 'var(--muted)' }}>{item.date}</time>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>by {item.author}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Files Tab ───────────────────────────────────────────────
function FilesTab({ lead, onCountsChange, onActivity }) {
  const initialState = useLeadDetailState(lead);
  const currentUser = useAppStore((s) => s.currentUser);
  const actorName = currentUser?.name || currentUser?.fullName || lead?.owner || '—';
  const [files, setFiles] = useState(() => initialState.files);
  const [fileSearch, setFileSearch] = useState('');
  const [fileType, setFileType] = useState('All');
  const [viewFile, setViewFile] = useState(null);

  const visibleFiles = useMemo(() => files.filter((f) => {
    if (fileType !== 'All' && f.type !== fileType) return false;
    if (fileSearch && !String(f.name ?? '').toLowerCase().includes(fileSearch.toLowerCase())) return false;
    return true;
  }), [files, fileSearch, fileType]);

  React.useEffect(() => {
    updateStoredLeadDetail(lead?.id, { files });
    onCountsChange?.({ files: files.length });
  }, [lead?.id, files, files.length, onCountsChange]);

  async function handleUploadFiles(event) {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;
    const now = new Date().toLocaleDateString('en-GB');
    const uploaded = await Promise.all(selected.map(async (file) => {
      const imagePreview = file.type.startsWith('image/') ? await readFileAsDataUrl(file) : '';
      return {
        id: `file-upload-${Date.now()}-${file.name}`,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        name: file.name,
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        sentOn: now,
        sentBy: actorName,
        preview: imagePreview,
        downloadUrl: imagePreview,
        description: 'Uploaded from Files tab.',
      };
    }));
    setFiles((current) => [...uploaded, ...current]);
    event.target.value = '';
    onActivity?.(`${uploaded.length} file${uploaded.length > 1 ? 's' : ''} uploaded`, '#8b5cf6');
  }

  function handleViewFile(file) {
    setViewFile(file);
  }

  function handleDownloadFile(file) {
    const url = file.downloadUrl || file.preview;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleRemoveFile(id) {
    const target = files.find((f) => f.id === id);
    setFiles((current) => current.filter((f) => f.id !== id));
    onActivity?.(`File "${target?.name ?? 'entry'}" removed`, '#f59e0b');
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-sm">Files ({files.length})</h3>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Search files..." value={fileSearch} onChange={(e) => setFileSearch(e.target.value)} className="form-input text-xs" style={{ width: 160 }} />
          <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="form-select text-xs">
            <option value="All">All</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
          </select>
          <label className="btn-primary btn-sm flex items-center gap-1 cursor-pointer">
            <Upload size={13} /> Upload
            <input type="file" multiple hidden onChange={handleUploadFiles} />
          </label>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead><tr><th>Name</th><th>Size</th><th>Sent On</th><th>Sent By</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
          <tbody>
            {visibleFiles.map((f) => (
              <tr key={f.id}>
                <td className="font-semibold">{f.name}</td>
                <td className="text-slate-500">{f.size}</td>
                <td className="text-slate-400">{f.sentOn}</td>
                <td>{f.sentBy}</td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={() => handleViewFile(f)} className="p-1 rounded text-blue-600 hover:bg-blue-50" title="View"><Eye size={13} /></button>
                    <button type="button" onClick={() => handleDownloadFile(f)} className="p-1 rounded text-emerald-600 hover:bg-emerald-50" title="Download"><Download size={13} /></button>
                    <button type="button" onClick={() => handleRemoveFile(f.id)} className="p-1 rounded text-rose-500 hover:bg-rose-50" title="Remove"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewFile && (
        <div className="modal-overlay" role="presentation" onClick={() => setViewFile(null)}>
          <div className="card p-4" style={{ maxWidth: 560, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-sm">{viewFile.name}</h4>
            <p className="text-xs text-slate-500">{viewFile.description}</p>
            {viewFile.preview && <img src={viewFile.preview} alt={viewFile.name} style={{ width: '100%', borderRadius: 8, marginTop: 8 }} />}
            <div className="flex justify-end gap-2" style={{ marginTop: 12 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setViewFile(null)}>Close</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => handleDownloadFile(viewFile)}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CallsTab({ lead, onCountsChange, onActivity }) {
  const initialState = useLeadDetailState(lead);
  const currentUser = useAppStore((s) => s.currentUser);
  const actorName = currentUser?.name || currentUser?.fullName || lead?.owner || '—';
  const [calls, setCalls] = useState(() => initialState.calls);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [callType, setCallType] = useState('Outbound');
  const [assignee, setAssignee] = useState(() => lead?.owner || '');
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState('Connected');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const assigneeOptions = useMemo(() => {
    const names = [lead?.owner, ...useCrmStore.getState().teamMembers.map((e) => e.name)].map((n) => String(n || '').trim()).filter(Boolean);
    return [...new Set(names)];
  }, [lead?.owner]);
  // One physical click must log at most one row. Touch devices, double-clicks
  // and StrictMode re-runs can otherwise invoke the handler twice in the same
  // tick, and `tel:` navigation never blocks the second call.
  const lastDialAt = React.useRef(0);

  React.useEffect(() => {
    updateStoredLeadDetail(lead?.id, { calls });
    onCountsChange?.({ calls: calls.length });
  }, [lead?.id, calls, calls.length, onCountsChange]);

  function dialNumber() {
    const digits = String(lead?.phone || '').replace(/[^0-9]/g, '');
    if (!digits) return;
    const target = digits.length === 10 ? `+91${digits}` : `+${digits}`;
    try {
      window.location.href = `tel:${target}`;
    } catch {
      return;
    }
  }

  function addCallLog(entry) {
    const item = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      by: actorName,
      phone: lead?.phone || '',
      direction: 'Outgoing',
      ...entry,
    };
    setCalls((current) => [item, ...current]);
    onActivity?.(`Call ${entry.outcome || 'logged'} with ${lead?.name || 'lead'}`, '#10b981');
  }

  function callNow() {
    const now = Date.now();
    if (now - lastDialAt.current < 3000) return;
    lastDialAt.current = now;
    addCallLog({ outcome: 'Dialled', duration: '-', notes: 'Dialled from Calls tab.' });
    dialNumber();
  }

  function saveAddCall(event) {
    event?.preventDefault();
    if (!String(subject || '').trim()) return;
    if (!assignee) return;
    addCallLog({ subject: subject.trim(), direction: callType, outcome: 'Connected', duration: '-', notes: description.trim() || subject.trim(), by: assignee, callType });
    setSubject('');
    setCallType('Outbound');
    setDescription('');
    setIsAddOpen(false);
  }

  function saveManualLog(event) {
    event?.preventDefault();
    addCallLog({ outcome, duration: duration ? `${duration} min` : '-', notes: notes.trim() || '-' });
    setOutcome('Connected');
    setDuration('');
    setNotes('');
    setIsLogOpen(false);
  }

  function removeCall(id) {
    const target = calls.find((c) => c.id === id);
    setCalls((current) => current.filter((c) => c.id !== id));
    onActivity?.(`Call log with ${target?.by ?? 'lead'} removed`, '#f59e0b');
  }

  function outcomeStyle(value) {
    if (value === 'Connected') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (value === 'Dialled') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (value === 'Busy') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (value === 'Call Back') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (value === 'Wrong Number') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <div className="card">
      <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <h3 className="font-bold text-sm">Calls ({calls.length})</h3>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <button type="button" onClick={() => setIsLogOpen(true)} className="btn-outline btn-sm">
            Log Call
          </button>
          <button type="button" onClick={callNow} className="btn-primary btn-sm flex items-center gap-1.5 !bg-emerald-600 hover:!bg-emerald-700">
            <Phone size={13} /> Call Lead
          </button>
          <button type="button" onClick={() => { setSubject(''); setCallType('Outbound'); setAssignee(lead?.owner || assigneeOptions[0] || ''); setDescription(''); setIsAddOpen(true); }} title="Add Call" aria-label="Add Call" className="w-8 h-8 grid place-items-center rounded-md bg-[#1d3f6e] hover:bg-[#16325a] text-white transition">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Lead</th>
              <th>Phone</th>
              <th>Date & Time</th>
              <th>Duration</th>
              <th>Outcome</th>
              <th>Called By</th>
              <th style={{ width: 80, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c, idx) => (
              <React.Fragment key={c.id}>
                <tr>
                  <td className="text-slate-500 font-mono">{idx + 1}</td>
                  <td className="font-semibold">{lead?.name}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-medium">{c.phone || lead?.phone}</span>
                      <button type="button" onClick={callNow} title="Call now" className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition cursor-pointer">
                        <Phone size={13} />
                      </button>
                    </span>
                  </td>
                  <td className="text-slate-500 text-xs whitespace-nowrap">{c.date}</td>
                  <td className="text-slate-600">{c.duration}</td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${outcomeStyle(c.outcome)}`}>
                      {c.outcome}
                    </span>
                  </td>
                  <td className="text-xs font-medium">{c.by}</td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => removeCall(c.id)} className="p-1 rounded text-rose-500 hover:bg-rose-50 transition cursor-pointer" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {(c.subject || c.callType || c.direction || c.notes) && (
                  <tr>
                    <td />
                    <td colSpan={7} className="!py-1.5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {c.subject && <span><span className="font-semibold text-slate-600">Subject:</span> {c.subject}</span>}
                        {(c.callType || c.direction) && <span><span className="font-semibold text-slate-600">Call Type:</span> {c.callType || c.direction}</span>}
                        {c.notes && c.notes !== '-' && c.notes !== c.subject && <span className="min-w-0"><span className="font-semibold text-slate-600">Description:</span> {c.notes}</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {calls.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">No calls logged yet. Click Call Lead to dial {lead?.name || 'this lead'}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isLogOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsLogOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Log Call</h4>
                <p className="text-xs text-slate-500 mt-1">Record a call with {lead?.name} ({lead?.phone}).</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsLogOpen(false)} aria-label="Close log call dialog">×</button>
            </div>
            <form onSubmit={saveManualLog} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Outcome *</label>
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="form-select text-xs">
                    <option value="Connected">Connected</option>
                    <option value="Not Answered">Not Answered</option>
                    <option value="Busy">Busy</option>
                    <option value="Call Back">Call Back</option>
                    <option value="Wrong Number">Wrong Number</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Duration (min)</label>
                  <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 5" className="form-input text-xs" />
                </div>
              </div>
              <div>
                <label className="form-label text-xs">Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed..." className="form-textarea text-xs resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setIsLogOpen(false)} className="btn-ghost btn-sm">Cancel</button>
                <button type="submit" className="btn-primary btn-sm">Save Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsAddOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add Call">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h4 className="text-[15px] font-semibold text-slate-900">Add Call</h4>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close add call dialog"><X size={20} /></button>
            </div>
            <form onSubmit={saveAddCall} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Subject<span className="text-rose-500">*</span></label>
                  <input autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter Subject" className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Call Type<span className="text-rose-500">*</span></label>
                  <select value={callType} onChange={(e) => setCallType(e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="Outbound">Outbound</option>
                    <option value="Inbound">Inbound</option>
                    <option value="Missed">Missed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Assignee<span className="text-rose-500">*</span></label>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                  <option value="">Select User</option>
                  {assigneeOptions.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Description</label>
                <textarea rows={7} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter Description" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 resize-y focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddOpen(false)} className="h-10 px-5 rounded-lg bg-slate-500 hover:bg-slate-600 text-white text-[13px] font-semibold transition">Cancel</button>
                <button type="submit" disabled={!String(subject || '').trim() || !assignee} className="h-10 px-6 rounded-lg bg-[#1d4a79] hover:bg-[#163a61] disabled:opacity-50 text-white text-[13px] font-semibold transition">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadTasksTab({ lead, onCountsChange, onActivity }) {
  const { quotations, deliveryChallans } = useERP() || {};
  const navigate = useNavigate();
  const initialState = useLeadDetailState(lead);
  const [tasks, setTasks] = useState(() => initialState.tasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [taskForms, setTaskForms] = useState(() => getLeadTaskForms());
  const [showFormEditor, setShowFormEditor] = useState(false);
  const [taskFormName, setTaskFormName] = useState('');
  const [builderSections, setBuilderSections] = useState([]);
  const [builderSelectedFieldId, setBuilderSelectedFieldId] = useState(null);
  const [builderSaveSuccess, setBuilderSaveSuccess] = useState(false);
  const [taskFormDraftError, setTaskFormDraftError] = useState('');
  const assigneeOptions = useMemo(() => {
    const names = [
      lead?.owner,
      ...(initialState.users || []).map((user) => user.name),
      ...useCrmStore.getState().teamMembers.map((member) => member.name),
      ...tasks.map((task) => task.assignee),
    ]
      .map((name) => String(name || '').trim())
      .filter(Boolean);

    return [...new Set(names)];
  }, [initialState.users, lead?.owner, tasks]);
  const defaultAssignee = assigneeOptions.includes('Utsav Faldu') ? 'Utsav Faldu' : (assigneeOptions[0] || '');
  const [masterTaskOptions, setMasterTaskOptions] = useState(() => getMasterTaskOptions());
  React.useEffect(() => {
    setMasterTaskOptions(getMasterTaskOptions());
  }, [isModalOpen]);
  const linkedQuotations = useMemo(
    () => (quotations || []).filter((quotation) => quotationMatchesLead(quotation, lead)),
    [lead, quotations]
  );
  const linkedChallans = useMemo(() => {
    const customerName = String(lead?.company || lead?.name || '').trim().toLowerCase();
    const leadName = String(lead?.name || '').trim().toLowerCase();

    return (deliveryChallans || []).filter((challan) => {
      const customer = String(challan.customer || '').trim().toLowerCase();
      if (!customerName) return true;
      return customer.includes(customerName) || (leadName && customer.includes(leadName));
    });
  }, [deliveryChallans, lead]);
  const [form, setForm] = useState(() => createLeadTaskForm(defaultAssignee));
  const [formError, setFormError] = useState('');
  const [completeId, setCompleteId] = useState(null);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedTaskForm = useMemo(() => taskForms.find((f) => String(f.id) === String(form.taskFormId)) || null, [taskForms, form.taskFormId]);
  const selectedTaskFormFields = useMemo(() => (selectedTaskForm ? getTaskFormFields(selectedTaskForm) : []), [selectedTaskForm]);

  React.useEffect(() => {
    updateStoredLeadDetail(lead?.id, { tasks });
    onCountsChange?.({ openTasks: tasks.filter((t) => t.status !== 'Completed').length });
  }, [lead?.id, tasks, onCountsChange]);

  React.useEffect(() => {
    function refreshTaskForms() {
      setTaskForms(getLeadTaskForms());
    }
    refreshTaskForms();
    window.addEventListener('focus', refreshTaskForms);
    window.addEventListener('storage', refreshTaskForms);
    return () => {
      window.removeEventListener('focus', refreshTaskForms);
      window.removeEventListener('storage', refreshTaskForms);
    };
  }, [isModalOpen]);

  const dueTasks = useMemo(() => tasks.filter((t) => t.status === 'Due'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status !== 'Due'), [tasks]);

  function openCreate() {
    setEditingId(null);
    setForm(createLeadTaskForm(defaultAssignee));
    setFormError('');
    setTaskForms(getLeadTaskForms());
    setShowFormEditor(false);
    setTaskFormName('');
    setBuilderSections([]);
    setBuilderSelectedFieldId(null);
    setTaskFormDraftError('');
    setIsModalOpen(true);
  }

  function openEdit(task) {
    const due = parseLeadTaskDueAt(task.dueAt);
    setEditingId(task.id);
    setForm({
      defaultTask: task.defaultTask || 'custom',
      title: task.title || '',
      stage: task.stage || 'New Lead',
      priority: task.priority || 'Low',
      status: task.status || 'Due',
      assignee: task.assignee || defaultAssignee,
      description: task.description || '',
      proposalId: task.proposalId || '',
      deliveryChallanId: task.deliveryChallanId || '',
      taskFormId: task.taskFormId || '',
      customValues: task.customValues || {},
      taskDate: due.taskDate,
      taskTime: due.taskTime,
    });
    setFormError('');
    setTaskForms(getLeadTaskForms());
    setShowFormEditor(false);
    setTaskFormDraftError('');
    setIsModalOpen(true);
  }

  function updateTaskForm(key, value) {
    setForm((current) => {
      if (key === 'defaultTask' && value && value !== 'custom') {
        const preset = masterTaskOptions.find((t) => String(t.id) === String(value));
        if (preset) {
          return { ...current, defaultTask: value, title: current.title || preset.name || '', priority: preset.priority || current.priority, assignee: current.assignee || preset.role || defaultAssignee };
        }
      }
      if (key === 'taskFormId') {
        return { ...current, taskFormId: value, customValues: {} };
      }
      return { ...current, [key]: value };
    });
  }

  function updateCustomValue(fieldId, value) {
    setForm((current) => ({ ...current, customValues: { ...(current.customValues || {}), [fieldId]: value } }));
  }

  function openFormBuilderEditor() {
    setTaskForms(getLeadTaskForms());
    setTaskFormName('');
    setBuilderSections([{ id: `task-section-${Date.now()}`, title: 'New Section 2', fields: [] }]);
    setBuilderSelectedFieldId(null);
    setBuilderSaveSuccess(false);
    setTaskFormDraftError('');
    setShowFormEditor(true);
  }

  function updateBuilderField(fieldId, updates) {
    setBuilderSections((cur) => cur.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)) })));
  }

  function addBuilderField(sectionId, type, index) {
    const targetId = sectionId || builderSections[0]?.id;
    const nextField = createFieldFromType(type, Date.now());
    setBuilderSections((cur) => cur.map((s) => {
      if (s.id !== targetId) return s;
      const arr = [...s.fields];
      arr.splice(typeof index === 'number' ? index : arr.length, 0, nextField);
      return { ...s, fields: arr };
    }));
    setBuilderSelectedFieldId(nextField.id);
  }

  function removeBuilderField(fieldId) {
    setBuilderSections((cur) => cur.map((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== fieldId) })));
  }

  function moveBuilderField(fieldId, targetSectionId, targetIndex) {
    setBuilderSections((cur) => {
      let moving = null;
      const stripped = cur.map((s) => ({ ...s, fields: s.fields.filter((f) => { if (f.id === fieldId) { moving = f; return false; } return true; }) }));
      if (!moving) return cur;
      return stripped.map((s) => {
        if (s.id !== targetSectionId) return s;
        const arr = [...s.fields];
        arr.splice(typeof targetIndex === 'number' ? targetIndex : arr.length, 0, moving);
        return { ...s, fields: arr };
      });
    });
    setBuilderSelectedFieldId(fieldId);
  }

  function addBuilderSection() {
    const id = `task-section-${Date.now()}`;
    setBuilderSections((cur) => [...cur, { id, title: `New Section ${cur.length + 1}`, fields: [] }]);
  }

  function removeBuilderSection(sectionId) {
    setBuilderSections((cur) => (cur.length <= 1 ? cur : cur.filter((s) => s.id !== sectionId)));
  }

  function saveTaskFormDraft() {
    const name = String(taskFormName || '').trim();
    if (!name) {
      setTaskFormDraftError('Form name is required.');
      return;
    }
    const allFields = builderSections.flatMap((s) => s.fields || []);
    if (allFields.length === 0) {
      setTaskFormDraftError('Add at least one field from the left panel.');
      return;
    }
    const newForm = { id: `task-form-${Date.now()}`, title: name, description: 'No description provided', fields: allFields.map((f) => f.label), sections: builderSections, lastUpdated: new Date().toLocaleDateString('en-GB'), status: 'ACTIVE', iconName: 'call' };
    const next = [...getLeadTaskForms(), newForm];
    saveLeadTaskForms(next);
    setTaskForms(next);
    setForm((current) => ({ ...current, taskFormId: newForm.id, customValues: {} }));
    setShowFormEditor(false);
    setTaskFormName('');
    setBuilderSections([]);
    setBuilderSelectedFieldId(null);
    setTaskFormDraftError('');
    setBuilderSaveSuccess(true);
    setTimeout(() => setBuilderSaveSuccess(false), 1200);
    onActivity?.(`Task form "${name}" created`, '#1d6bff');
  }

  function openSelectedFormBuilder() {
    if (!selectedTaskForm) return;
    try { localStorage.setItem('activeTaskFormId', selectedTaskForm.id); } catch { }
    navigate(`/crm/leads/task-form/builder?formId=${selectedTaskForm.id}`);
  }

  function submitTask(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Task name is required.');
      return;
    }
    if (!form.taskDate) {
      setFormError('Task date is required.');
      return;
    }
    if (!form.taskTime) {
      setFormError('Task time is required.');
      return;
    }
    if (!form.assignee) {
      setFormError('Please select an assignee.');
      return;
    }
    for (const field of selectedTaskFormFields) {
      if (field.required && !String(form.customValues?.[field.id] ?? '').trim()) {
        setFormError(`"${field.label}" is required.`);
        return;
      }
    }
    const nextTask = {
      defaultTask: form.defaultTask,
      title: form.title.trim(),
      stage: form.stage,
      status: form.status,
      priority: form.priority,
      dueAt: formatLeadTaskDueAt(form.taskDate, form.taskTime),
      process: form.status === 'Completed' ? 'Done' : 'Not Started',
      assignee: form.assignee,
      description: form.description.trim(),
      proposalId: form.proposalId,
      deliveryChallanId: form.deliveryChallanId,
      taskFormId: form.taskFormId,
      taskFormName: selectedTaskForm?.title || '',
      customValues: form.customValues || {},
    };
    if (editingId) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...nextTask } : t)));
      onActivity?.(`Task "${form.title.trim()}" updated`, '#1d6bff');
    } else {
      const manualTask = { id: `lt-${Date.now()}`, ...nextTask };
      setTasks((prev) => [
        manualTask,
        ...prev,
      ]);
      onActivity?.(`Task "${form.title.trim()}" added`, '#16a34a');
      emitCrmEvent({
        type: CRM_EVENT_TYPES.TASK_CREATED,
        entityType: 'lead-task',
        entityId: manualTask.id,
        payload: {
          title: manualTask.title,
          ownerName: manualTask.assignee,
          leadName: lead?.name,
          leadId: lead?.id,
          path: `/crm/leads/${lead?.id}`,
        },
      });
    }
    setIsModalOpen(false);
  }

  function toggleStatus(task) {
    if (task.status === 'Due') {
      setCompleteId(task.id);
      return;
    }
    // Reopen a completed task: clear completion metadata
    const reopened = tasks.find((t) => t.id === task.id);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'Due',
              process: 'Not Started',
              completionOutcome: undefined,
              nextAction: undefined,
              completedAt: undefined,
              completedBy: undefined,
            }
          : t
      )
    );
    if (reopened?.crmTaskId) {
      try {
        const crmTasks = loadCrmTasks();
        const nextCrmTasks = crmTasks.map((t) =>
          String(t.id) === String(reopened.crmTaskId)
            ? {
                ...t,
                status: 'Open',
                completionOutcome: undefined,
                nextAction: undefined,
                completedAt: undefined,
                completedBy: undefined,
              }
            : t
        );
        saveCrmTasks(nextCrmTasks);
      } catch (err) {
        console.error('[CRM Completion] Error reopening task in Task List:', err);
      }
    }
  }

  async function submitCompleteTask(outcome, nextAction, note) {
    const detailTask = tasks.find((t) => t.id === completeId);
    if (!detailTask) {
      return { ok: false, message: 'Task could not be found.' };
    }
    let crmTask = null;
    try {
      crmTask = loadCrmTasks().find((t) => String(t.id) === String(detailTask.crmTaskId)) || null;
    } catch (err) {
      console.error('[CRM Completion] Error loading Task List store:', err);
    }
    const actor = currentUser?.name || defaultAssignee || lead?.owner || 'CRM User';
    const result = completeTaskWithOutcome({
      task: crmTask,
      lead,
      outcome,
      nextAction,
      note,
      completedBy: actor,
      leadDetailTask: detailTask,
    });
    if (Array.isArray(result.leadDetailTasks)) {
      setTasks(result.leadDetailTasks);
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === detailTask.id
            ? {
                ...t,
                status: 'Completed',
                process: 'Done',
                completionOutcome: outcome,
                nextAction,
                completedAt: new Date().toISOString(),
                completedBy: actor,
              }
            : t
        )
      );
    }
    return result;
  }

  function confirmDelete() {
    if (!deleteId) return;
    const target = tasks.find((t) => t.id === deleteId);
    setTasks((prev) => prev.filter((t) => t.id !== deleteId));
    onActivity?.(`Task "${target?.title ?? 'entry'}" removed`, '#f59e0b');
    setDeleteId(null);
  }

  function priorityCls(priority) {
    if (priority === 'High') return 'bg-rose-50 text-rose-600 border border-rose-100';
    if (priority === 'Low') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    return 'bg-orange-50 text-orange-500 border border-orange-100';
  }

  function renderRow(task, showNote) {
    const done = task.status !== 'Due';
    const isAuto = task.source === TASK_SOURCE_AUTOMATION || task.source === 'Created by Lead Stage Automation';
    return (
      <div key={task.id} className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-slate-50/60 transition">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            role="switch"
            aria-checked={done}
            aria-label={done ? 'Mark as due' : 'Mark as completed'}
            onClick={() => toggleStatus(task)}
            className={`relative mt-0.5 w-9 h-5 rounded-full transition shrink-0 ${done ? 'bg-[#1d4a79]' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${done ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
              <span className="font-bold text-slate-900">{task.title}</span>
              <span className="text-slate-400 font-normal">· {task.stage}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${done ? 'bg-lime-500' : 'bg-rose-600'}`}>{done ? 'Completed' : 'Due'}</span>
              {isAuto && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Created by Lead Stage Automation
                </span>
              )}
            </p>
            <p className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
              <span className={`px-2 py-0.5 rounded font-bold ${priorityCls(task.priority)}`}>{task.priority}</span>
              <span className="text-slate-400">·</span>
              <span className="text-[#1d4a79] font-medium">{task.dueAt}</span>
              {task.assignee && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className={`font-semibold ${task.assignee === 'Unassigned' ? 'text-amber-600' : 'text-slate-500'}`}>
                    {task.assignee}
                  </span>
                </>
              )}
            </p>
            {task.warning && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded mt-1.5 font-medium">
                ⚠️ {task.warning}
              </p>
            )}
            {task.description && <p className="text-[11px] text-slate-500 mt-1">{task.description}</p>}
            <p className="text-[11px] text-slate-400 mt-1">Process: {task.process || 'Not Started'}</p>
            {task.completionOutcome && (
              <p className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-semibold">
                  Outcome: {task.completionOutcome}
                </span>
                {task.nextAction && (
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
                    Next: {NEXT_ACTION_LABELS[task.nextAction] || task.nextAction}
                  </span>
                )}
                {task.completedBy && <span className="text-slate-400">by {task.completedBy}</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!done && showNote && (
            <button type="button" onClick={() => setCompleteId(task.id)} title="Fill Task Form" className="w-8 h-8 grid place-items-center rounded-md bg-lime-500 hover:bg-lime-600 text-white transition">
              <ClipboardList size={14} />
            </button>
          )}
          <button type="button" onClick={() => openEdit(task)} title="Edit" className="w-8 h-8 grid place-items-center rounded-md bg-[#3a9ab5] hover:bg-[#2f8299] text-white transition">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={() => setDeleteId(task.id)} title="Delete" className="w-8 h-8 grid place-items-center rounded-md bg-rose-600 hover:bg-rose-700 text-white transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3">
        <h3 className="text-[15px] font-bold text-slate-900">Tasks</h3>
        <button
          type="button"
          onClick={openCreate}
          title="Add Lead Task"
          aria-label="Add Lead Task"
          className="w-8 h-8 grid place-items-center rounded-md bg-[#1d3f6e] hover:bg-[#16325a] text-white transition"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-rose-100/80 border-y border-rose-100">
        <h4 className="text-[13px] font-bold text-slate-800">Due Tasks</h4>
        <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded bg-slate-500/80 text-white text-[11px] font-bold">{dueTasks.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {dueTasks.length === 0 && (
          <p className="px-4 sm:px-5 py-6 text-center text-xs text-slate-400">No due tasks. Click + to add one.</p>
        )}
        {dueTasks.map((t) => renderRow(t, true))}
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-slate-100/80 border-y border-slate-100">
        <h4 className="text-[13px] font-bold text-slate-800">Tasks</h4>
        <span className="min-w-5 h-5 px-1.5 grid place-items-center rounded bg-slate-500/80 text-white text-[11px] font-bold">{doneTasks.length}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {doneTasks.length === 0 && (
          <p className="px-4 sm:px-5 py-6 text-center text-xs text-slate-400">No completed tasks yet.</p>
        )}
        {doneTasks.map((t) => renderRow(t, false))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-2 sm:p-4 bg-slate-950/50 overflow-y-auto" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[#f1f5f9] rounded-xl shadow-2xl w-full max-w-5xl my-6 overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editingId ? 'Edit lead task' : 'Create lead task'}>
            <div className="bg-white px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-[15px] font-bold text-slate-900">Create Lead Task</h2>
              <p className="text-[11px] text-slate-500 mt-1">Dashboard <span className="mx-1">&gt;</span> Lead Task <span className="mx-1">&gt;</span> Create Lead Task</p>
            </div>

            <form onSubmit={submitTask} className="px-6 py-5">
              <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Default Task</label>
                  <select value={form.defaultTask} onChange={(e) => updateTaskForm('defaultTask', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="custom">Create custom task</option>
                    {masterTaskOptions.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Name <span className="text-rose-500">*</span></label>
                  <input autoFocus value={form.title} onChange={(e) => updateTaskForm('title', e.target.value)} placeholder="Enter Name" className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={form.taskDate} onChange={(e) => updateTaskForm('taskDate', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Time <span className="text-rose-500">*</span></label>
                    <input type="time" value={form.taskTime} onChange={(e) => updateTaskForm('taskTime', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Description</label>
                  <textarea rows={4} value={form.description} onChange={(e) => updateTaskForm('description', e.target.value)} placeholder="Enter task related description or notes" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 resize-y focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Priority <span className="text-rose-500">*</span></label>
                    <select value={form.priority} onChange={(e) => updateTaskForm('priority', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      {LEAD_TASK_PRIORITY_OPTIONS.map((priority) => (<option key={priority} value={priority}>{priority}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Status</label>
                    <select value={form.status} onChange={(e) => updateTaskForm('status', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      {LEAD_TASK_STATUS_OPTIONS.map((status) => (<option key={status.value} value={status.value}>{status.label}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Assign To</label>
                  <select value={form.assignee} onChange={(e) => updateTaskForm('assignee', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="">Select Staff</option>
                    {assigneeOptions.map((name) => (<option key={name} value={name}>{name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Proposal</label>
                    <select value={form.proposalId} onChange={(e) => updateTaskForm('proposalId', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="">Select Proposal</option>
                      {linkedQuotations.map((quotation) => (<option key={quotation.id} value={quotation.id}>{quotation.quoteNumber || quotation.quotationNumber || quotation.customer || 'Proposal'}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Delivery Challan</label>
                    <select value={form.deliveryChallanId} onChange={(e) => updateTaskForm('deliveryChallanId', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="">Select Delivery Challan</option>
                      {linkedChallans.map((challan) => (<option key={challan.id} value={challan.id}>{challan.challanNumber || challan.linkedSo || challan.customer || 'Delivery Challan'}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Task Form</label>
                  <select value={form.taskFormId} onChange={(e) => updateTaskForm('taskFormId', e.target.value)} className="w-full h-11 px-4 bg-white border-2 border-[#1d4a79] rounded-lg text-[13px] text-slate-800 focus:outline-none">
                    <option value="">Select Form</option>
                    {taskForms.map((tf) => (<option key={tf.id} value={tf.id}>{tf.title}</option>))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1.5">Please create Task Form first. <button type="button" onClick={() => { if (showFormEditor) { setShowFormEditor(false); } else { openFormBuilderEditor(); } }} className="text-[#1d4a79] font-bold hover:underline">Create Task Form</button></p>
                </div>
                {selectedTaskForm && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-slate-800">{selectedTaskForm.title} Fields</p>
                      <button type="button" onClick={openSelectedFormBuilder} className="px-3 py-1.5 rounded-lg bg-[#1d4a79] hover:bg-[#163a61] text-white text-[11px] font-bold transition">Open Form Builder</button>
                    </div>
                    {selectedTaskFormFields.length === 0 && (<p className="text-[11px] text-slate-400">No fields defined in this form yet.</p>)}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedTaskFormFields.map((field) => (
                        <label key={field.id} className="block">
                          <span className="block text-[12px] font-semibold text-slate-700 mb-1">{field.label} {field.required && <span className="text-rose-500">*</span>}</span>
                          {String(field.type).toLowerCase() === 'multi line' ? (
                            <textarea rows={3} value={form.customValues?.[field.id] || ''} onChange={(e) => updateCustomValue(field.id, e.target.value)} placeholder={field.placeholder || `Enter ${String(field.label).toLowerCase()}`} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                          ) : String(field.type).toLowerCase() === 'dropdown' || String(field.type).toLowerCase() === 'multi select' ? (
                            <select value={form.customValues?.[field.id] || ''} onChange={(e) => updateCustomValue(field.id, e.target.value)} className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                              <option value="">{field.placeholder || 'Select option'}</option>
                              {String(field.options || field.placeholder || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => (<option key={o} value={o}>{o}</option>))}
                            </select>
                          ) : (
                            <input type={String(field.type).toLowerCase() === 'number' ? 'number' : String(field.type).toLowerCase() === 'date' ? 'date' : String(field.type).toLowerCase() === 'email' ? 'email' : String(field.type).toLowerCase() === 'phone' ? 'tel' : 'text'} value={form.customValues?.[field.id] || ''} onChange={(e) => updateCustomValue(field.id, e.target.value)} placeholder={field.placeholder || `Enter ${String(field.label).toLowerCase()}`} className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {showFormEditor && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mt-1">
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1">Form Name</label>
                      <input value={taskFormName} onChange={(e) => setTaskFormName(e.target.value)} placeholder="Enter form name" className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
                      <LeadFormBuilder hideHeader sections={builderSections} selectedFieldId={builderSelectedFieldId} selectedField={builderSections.flatMap((s) => s.fields).find((f) => f.id === builderSelectedFieldId) ?? null} onSelectField={setBuilderSelectedFieldId} onUpdateField={updateBuilderField} onAddField={addBuilderField} onRemoveField={removeBuilderField} onMoveField={moveBuilderField} onAddSection={addBuilderSection} onRemoveSection={removeBuilderSection} onPreview={() => {}} onSaveAndOpen={saveTaskFormDraft} saveSuccess={builderSaveSuccess} formTitle={taskFormName || 'New Task Form'} />
                    </div>
                    {taskFormDraftError && <p className="text-[11px] font-semibold text-rose-600 mt-2">{taskFormDraftError}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button type="button" onClick={saveTaskFormDraft} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1d4a79] hover:bg-[#163a61] text-white text-[12px] font-semibold transition">Save Form</button>
                      <button type="button" onClick={() => { setShowFormEditor(false); setTaskFormDraftError(''); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-500 hover:bg-slate-600 text-white text-[12px] font-semibold transition"><X size={13} /> Cancel</button>
                    </div>
                  </div>
                )}
                {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}
              </div>
              <div className="flex items-center justify-end gap-2.5 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="h-10 px-5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold border border-slate-200 transition">Cancel</button>
                <button type="submit" className="h-10 px-6 rounded-lg bg-[#1d4a79] hover:bg-[#163a61] text-white text-[13px] font-semibold transition">{editingId ? 'Update' : 'Create'}</button>
              </div>
              <p className="text-[11px] text-slate-400 mt-4">© 2026 IMT Endoscopy</p>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-slate-900">Delete this task?</h2>
            <p className="text-xs text-slate-500 mt-1">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {completeId && (
        <CompleteTaskModal
          open={Boolean(completeId)}
          task={tasks.find((t) => t.id === completeId) || null}
          lead={lead}
          onCancel={() => setCompleteId(null)}
          onComplete={submitCompleteTask}
          onSuccess={() => setCompleteId(null)}
        />
      )}
    </div>
  );
}

function EstimatesTab({ lead, onCountsChange }) {
  const all = useEstimates();
  const { customers } = useERP() || {};
  const linked = useMemo(() => all.filter((e) => estimateMatchesLead(e, lead)), [all, lead]);
  const storedProducts = useLeadDetailState(lead).products;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('15 Days');
  const [lineItems, setLineItems] = useState([]);

  React.useEffect(() => {
    onCountsChange?.({ estimates: linked.length });
  }, [linked.length, onCountsChange]);

  function openCreateModal() {
    const preferredCustomer = (customers || []).find((c) => c.name === (lead?.company || lead?.name)) || (customers || [])[0];
    setSelectedCustomerId(preferredCustomer?.id || '');
    setValidUntil('15 Days');
    setLineItems((storedProducts || []).map((p, index) => ({
      id: `li-${Date.now()}-${index}`,
      description: p.name,
      qty: Number(p.qty) || 1,
      rate: Number(String(p.price || '').replace(/[^0-9]/g, '')) || 0,
      amount: (Number(String(p.price || '').replace(/[^0-9]/g, '')) || 0) * (Number(p.qty) || 1),
    })));
    setIsCreateOpen(true);
  }

  function handleCreateEstimate(event) {
    event.preventDefault();
    const cust = (customers || []).find((c) => c.id === selectedCustomerId) || (customers || [])[0];
    const total = (lineItems || []).reduce((sum, item) => sum + ((item.amount) || (Number(item.qty || 1) * Number(item.rate || 0))), 0);
    const created = {
      id: `est-${Date.now()}`,
      estimateNumber: `EST-2026-${String((all.length || 0) + 3).padStart(3, '0')}`,
      customerId: cust?.id || '',
      customer: cust?.name || lead?.company || lead?.name || 'Acme Corp',
      leadId: String(lead?.id || ''),
      leadName: lead?.name || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      validUntil: validUntil || '15 Days',
      amount: total > 0 ? total : 1500,
      status: 'Draft',
      items: lineItems,
    };

    addEstimate(created);
    setIsCreateOpen(false);
    setLineItems([]);
  }

  function estimateTone(status) {
    if (status === 'Converted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Sent') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <div className="card">
      <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <h3 className="font-bold text-sm">Estimates ({linked.length})</h3>
        <button type="button" onClick={openCreateModal} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} strokeWidth={2.4} /> New Estimate
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Estimate Number</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Valid Until</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ width: 80, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {linked.map((e, idx) => (
              <tr key={e.id}>
                <td className="text-slate-500 font-mono">{idx + 1}</td>
                <td>
                  <button type="button" onClick={openCreateModal} className="font-mono font-bold text-blue-600 hover:underline">
                    {e.estimateNumber}
                  </button>
                </td>
                <td className="font-semibold">{e.customer}</td>
                <td className="text-slate-500 text-xs whitespace-nowrap">{e.date}</td>
                <td className="text-slate-500 text-xs">{e.validUntil}</td>
                <td style={{ textAlign: 'right' }} className="font-bold font-mono">
                  ${(e.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${estimateTone(e.status)}`}>
                    {e.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={openCreateModal} className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer" title="Open estimate details">
                      <Eye size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {linked.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">No estimates for {lead?.name || 'this lead'} yet. Click New Estimate to create one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Create Sales Estimate</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateEstimate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Customer Account *</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(event) => setSelectedCustomerId(event.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium"
                  >
                    {(customers || []).map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.code}) - Balance: ${customer.balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Validity Period</label>
                  <input
                    type="text"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    placeholder="e.g. 15 Days"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-2">Estimate Line Items</label>
                <LineItemEditor items={lineItems} onChange={setLineItems} type="sales" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer">
                  Generate Estimate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function quotationMatchesLead(q, lead) {
  if (!q || !lead) return false;
  if (q.leadId && String(q.leadId) === String(lead.id)) return true;
  const company = String(lead.company || '').trim().toLowerCase();
  const customer = String(q.customer || '').trim().toLowerCase();
  if (company && customer && (customer === company || customer.includes(company) || company.includes(customer))) return true;
  const leadName = String(lead.name || '').trim().toLowerCase();
  const qLead = String(q.leadName || '').trim().toLowerCase();
  if (leadName && qLead && qLead === leadName) return true;
  return false;
}

function QuotationsTab({ lead, onActivity }) {
  const { quotations, customers, updateQuotationStatus, addQuotation } = useERP() || {};
  const linked = useMemo(() => (quotations || []).filter((q) => quotationMatchesLead(q, lead)), [quotations, lead]);
  const storedProducts = useLeadDetailState(lead).products;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState((customers || [])[0]?.id || '');
  const [validUntil, setValidUntil] = useState('30 Days');
  const [lineItems, setLineItems] = useState([]);

  useEffect(() => {
    if (!customers || customers.length === 0) return;
    const match = (customers || []).find((customer) => customer.name === (lead?.company || lead?.name)) || (customers || [])[0];
    if (match) setSelectedCustomerId(match.id);
  }, [customers, lead]);

  function openCreateModal() {
    const match = (customers || []).find((customer) => customer.name === (lead?.company || lead?.name)) || (customers || [])[0];
    const nextItems = (storedProducts || []).map((product, index) => ({
      id: `quote-item-${product.id ?? index}`,
      description: product.name,
      qty: 1,
      rate: Number(String(product.price || '').replace(/[^0-9.]/g, '')) || 0,
      amount: Number(String(product.price || '').replace(/[^0-9.]/g, '')) || 0,
    }));

    setSelectedCustomerId(match?.id || '');
    setValidUntil('30 Days');
    setLineItems(nextItems.length > 0 ? nextItems : [{
      id: `quote-item-${Date.now()}`,
      description: 'Commercial pricing proposal',
      qty: 1,
      rate: 0,
      amount: 0,
    }]);
    setIsCreateOpen(true);
  }

  function handleCreateQuotation(event) {
    event.preventDefault();
    const customer = (customers || []).find((entry) => entry.id === selectedCustomerId) || (customers || [])[0];
    const computedTotal = (lineItems || []).reduce((sum, item) => {
      const qty = Number(item.qty || 1);
      const rate = Number(item.rate || 0);
      const amount = Number(item.amount || (qty * rate));
      return sum + amount;
    }, 0);

    const created = addQuotation?.({
      customerId: customer?.id,
      customer: customer?.name || lead?.company || lead?.name || 'Acme Corp',
      leadId: String(lead?.id || ''),
      leadName: lead?.name || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      validUntil: validUntil || '30 Days',
      amount: computedTotal > 0 ? computedTotal : 1500,
      status: 'Draft',
      items: lineItems,
    });

    setIsCreateOpen(false);
    setLineItems([]);
    setValidUntil('30 Days');
    onActivity?.(`Quotation ${created?.quoteNumber || 'created'} generated for ${lead?.name || customer?.name || 'lead'}`, '#3b82f6');
  }

  function sendQuotation(q) {
    window.location.assign(`/sales/quotations?quotationId=${encodeURIComponent(q.id)}&send=1`);
  }

  function quotationTone(status) {
    if (status === 'Sent') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'Confirmed' || status === 'Accepted' || status === 'Converted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <div className="card">
      <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <h3 className="font-bold text-sm">Quotations ({linked.length})</h3>
        <button type="button" onClick={openCreateModal} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} strokeWidth={2.4} /> New Quotation
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Quotation No.</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Valid Until</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ width: 110, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {linked.map((q, idx) => (
              <tr key={q.id}>
                <td className="text-slate-500 font-mono">{idx + 1}</td>
                <td>
                  <button type="button" onClick={openCreateModal} className="font-mono font-bold text-blue-600 hover:underline">
                    {q.quoteNumber}
                  </button>
                </td>
                <td className="font-semibold">{q.customer}</td>
                <td className="text-slate-500 text-xs whitespace-nowrap">{q.date}</td>
                <td className="text-slate-500 text-xs">{q.validUntil}</td>
                <td style={{ textAlign: 'right' }} className="font-bold font-mono">
                  ${(q.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${quotationTone(q.status)}`}>
                    {q.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={openCreateModal} className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer" title="Open quotation details">
                      <Eye size={13} />
                    </button>
                    {q.status !== 'Sent' && (
                      <button type="button" onClick={() => sendQuotation(q)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer" title="Send quotation to lead">
                        <Send size={11} /> Send
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {linked.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">No quotations for {lead?.name || 'this lead'} yet. Convert an estimate to create one automatically.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Create Quotation Estimate</h3>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Close quotation dialog">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateQuotation} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Customer Account *</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(event) => setSelectedCustomerId(event.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium"
                  >
                    {(customers || []).map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.code}) - Balance: ${customer.balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Validity Period</label>
                  <input
                    type="text"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    placeholder="e.g. 30 Days"
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-2">Quotation Line Items</label>
                <LineItemEditor items={lineItems} onChange={setLineItems} type="sales" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-medium cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer">
                  Generate Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryChallansTab({ lead, onCountsChange, onActivity }) {
  const { deliveryChallans, salesOrders, addDeliveryChallan } = useERP() || {};
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedSoId, setSelectedSoId] = useState('');
  const [transporter, setTransporter] = useState('FedEx Freight Direct');
  const [vehicleNo, setVehicleNo] = useState('TRK-9041-WA');
  const [driverContact, setDriverContact] = useState('+1 (555) 349-2810');
  const [totalPackages, setTotalPackages] = useState(4);
  const [dispatchNote, setDispatchNote] = useState('Fragile electronic components. Handle with pallet forklift.');
  const [lineItems, setLineItems] = useState([]);

  const linked = useMemo(() => {
    const allChallans = deliveryChallans || [];
    const customerName = String(lead?.company || lead?.name || '').trim().toLowerCase();
    const leadName = String(lead?.name || '').trim().toLowerCase();

    return allChallans.filter((challan) => {
      const customerMatch = challan.customer && (
        String(challan.customer).trim().toLowerCase().includes(customerName) ||
        (leadName && String(challan.customer).trim().toLowerCase().includes(leadName)) ||
        (customerName && String(challan.customer).trim().toLowerCase().includes(customerName))
      );
      const orderMatch = (salesOrders || []).some((order) => {
        const orderMatchesLead = order.customer && (
          String(order.customer).trim().toLowerCase().includes(customerName) ||
          (leadName && String(order.customer).trim().toLowerCase().includes(leadName))
        );
        return orderMatchesLead && (
          order.id === challan.salesOrderId ||
          order.orderNumber === challan.salesOrderNumber ||
          order.orderNumber === challan.linkedSo
        );
      });
      return customerMatch || orderMatch || !customerName;
    });
  }, [deliveryChallans, lead, salesOrders]);

  useEffect(() => {
    onCountsChange?.({ challans: linked.length });
  }, [linked.length, onCountsChange]);

  function openIssueModal() {
    const relatedOrders = (salesOrders || []).filter((order) => {
      const customerName = String(lead?.company || lead?.name || '').trim().toLowerCase();
      const customerValue = String(order.customer || '').trim().toLowerCase();
      return !customerName || customerValue.includes(customerName) || customerName.includes(customerValue);
    });

    const order = relatedOrders[0] || (salesOrders || [])[0];
    setSelectedSoId(order?.id || '');
    setLineItems(order?.items ? order.items.map((item) => ({ ...item })) : []);
    setShowIssueModal(true);
  }

  function handleCreate(event) {
    event.preventDefault();
    const order = (salesOrders || []).find((entry) => entry.id === selectedSoId) || (salesOrders || [])[0];
    if (!order) return;

    const created = addDeliveryChallan?.({
      salesOrderId: order.id,
      salesOrderNumber: order.orderNumber,
      linkedSo: order.orderNumber,
      customerId: order.customerId,
      customer: order.customer || lead?.company || lead?.name,
      date: new Date().toISOString().split('T')[0],
      dispatchDate: new Date().toISOString().split('T')[0],
      transporter,
      vehicleNo,
      status: 'In Transit',
      items: lineItems.length > 0 ? lineItems : (order.items || []),
    });

    setShowIssueModal(false);
    onCountsChange?.({ challans: (linked.length || 0) + 1 });
    onActivity?.(`Delivery challan ${created?.challanNumber || 'issued'} created for ${lead?.name || order.customer}`, '#f97316');
  }

  return (
    <div className="card">
      <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <h3 className="font-bold text-sm">Delivery Challans ({linked.length})</h3>
        <button type="button" onClick={openIssueModal} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} strokeWidth={2.4} /> New Challan
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Challan No.</th>
              <th>Linked SO</th>
              <th>Customer</th>
              <th>Dispatch Date</th>
              <th>Carrier</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {linked.map((challan, idx) => (
              <tr key={challan.id}>
                <td className="text-slate-500 font-mono">{idx + 1}</td>
                <td className="font-mono font-bold text-blue-600">{challan.challanNumber}</td>
                <td className="font-mono text-slate-600">{challan.salesOrderNumber || challan.linkedSo}</td>
                <td className="font-semibold">{challan.customer}</td>
                <td className="text-slate-500 text-xs whitespace-nowrap">{challan.dispatchDate || challan.date}</td>
                <td className="text-slate-600">{challan.transporter}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${challan.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : challan.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {challan.status}
                  </span>
                </td>
              </tr>
            ))}
            {linked.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">No delivery challans for {lead?.name || 'this lead'} yet. Click New Challan to create one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowIssueModal(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-3xl p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Issue Delivery Challan</h4>
                <p className="text-xs text-slate-500 mt-1">Create a dispatch manifest for {lead?.name || 'this lead'}.</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setShowIssueModal(false)} aria-label="Close delivery challan dialog">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label text-xs">Source Sales Order *</label>
                  <select
                    value={selectedSoId}
                    onChange={(event) => {
                      const nextOrder = (salesOrders || []).find((order) => order.id === event.target.value);
                      setSelectedSoId(event.target.value);
                      setLineItems(nextOrder?.items ? nextOrder.items.map((item) => ({ ...item })) : []);
                    }}
                    className="form-select text-xs"
                  >
                    {(salesOrders || []).map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} - {order.customer}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Carrier / Transporter</label>
                  <input type="text" value={transporter} onChange={(event) => setTransporter(event.target.value)} className="form-input text-xs" />
                </div>
                <div>
                  <label className="form-label text-xs">Vehicle / Truck Plate #</label>
                  <input type="text" value={vehicleNo} onChange={(event) => setVehicleNo(event.target.value)} className="form-input text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Driver Contact / Phone</label>
                  <input type="text" value={driverContact} onChange={(event) => setDriverContact(event.target.value)} className="form-input text-xs" />
                </div>
                <div>
                  <label className="form-label text-xs">Total Packages / Cartons</label>
                  <input type="number" min="1" value={totalPackages} onChange={(event) => setTotalPackages(Number(event.target.value))} className="form-input text-xs" />
                </div>
              </div>

              <div>
                <label className="form-label text-xs">Handling / Gate Pass Instructions</label>
                <input type="text" value={dispatchNote} onChange={(event) => setDispatchNote(event.target.value)} className="form-input text-xs" />
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="px-2 py-2 font-bold">SKU</th>
                      <th className="px-2 py-2 font-bold">Description</th>
                      <th className="px-2 py-2 font-bold text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lineItems || []).map((item, index) => (
                      <tr key={`${item.id || item.itemId || index}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-2 font-mono text-slate-600">{item.sku || item.itemSku || 'GEN-SKU'}</td>
                        <td className="px-2 py-2 text-slate-700">{item.name || item.description}</td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.qty || 1}
                            onChange={(event) => {
                              const next = [...lineItems];
                              next[index] = { ...next[index], qty: Number(event.target.value) || 1 };
                              setLineItems(next);
                            }}
                            className="w-20 ml-auto rounded border border-slate-200 bg-white px-2 py-1 text-right text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowIssueModal(false)} className="btn-ghost btn-sm">Cancel</button>
                <button type="submit" className="btn-primary btn-sm">Create Challan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ lead, items }) {
  const entries = items ?? [];
  const allEstimates = useEstimates();
  const { quotations } = useERP() || {};
  const linkedEstimates = (allEstimates || []).filter((e) => estimateMatchesLead(e, lead));
  const linkedQuotations = (quotations || []).filter((q) => quotationMatchesLead(q, lead));
  const systemEntries = [
    ...linkedEstimates.map((e) => ({ id: `sys-est-${e.id}`, title: `Estimate ${e.estimateNumber} • ${e.status}`, time: e.date || '', color: '#f59e0b' })),
    ...linkedQuotations.map((q) => ({ id: `sys-q-${q.id}`, title: `Quotation ${q.quoteNumber} • ${q.status}`, time: q.date || '', color: '#10b981' })),
  ];
  systemEntries.push(...linkedQuotations.flatMap(q => (q.activity || []).map(event => ({ id: event.id, title: `${q.quoteNumber} ? ${event.type}`, time: event.timestamp, color: '#10b981' }))));
  const total = entries.length + systemEntries.length;
  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Activity Log ({total})</h3>
      {total === 0 && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>No activity recorded for this lead yet.</p>
      )}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
        {entries.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-4">
            <span
              className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
              style={{ background: item.color || '#3b82f6' }}
            />
            <div className="space-y-1">
              <strong className="text-xs font-bold block" style={{ color: 'var(--text)' }}>{item.title}</strong>
              {item.outcome && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Outcome: {item.outcome}
                  </span>
                  {item.nextAction && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Next: {item.nextAction}
                    </span>
                  )}
                  {item.employee && <span className="text-[10px] font-medium text-slate-500">by {item.employee}</span>}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <time className="text-[11px] font-mono block" style={{ color: 'var(--muted)' }}>{item.time}</time>
            </div>
          </div>
        ))}
        {systemEntries.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-4">
            <span
              className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
              style={{ background: item.color || '#3b82f6' }}
            />
            <div className="space-y-1">
              <strong className="text-xs font-bold block" style={{ color: 'var(--text)' }}>{item.title}</strong>
            </div>
            <div className="text-right shrink-0">
              <time className="text-[11px] font-mono block" style={{ color: 'var(--muted)' }}>{item.time}</time>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Discussion & Notes Tab ────────────────────────────────────
function DiscussionNotesTab({ lead, onActivity }) {
  const [noteDraft, setNoteDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [notesList, setNotesList] = useState([]);

  function handleSaveNote(event) {
    event?.preventDefault();
    const text = noteDraft.trim();
    if (!text && pendingAttachments.length === 0) return;
    const entry = {
      id: `note-${Date.now()}`,
      body: text,
      attachments: [...pendingAttachments],
      time: new Date().toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      author: 'You',
    };
    setNotesList((current) => [entry, ...current]);
    setNoteDraft('');
    setPendingAttachments([]);
    onActivity?.('Note saved in discussion', '#8b5cf6');
  }

  function handleAttachmentSelect(event) {
    const selected = Array.from(event.target.files || []).map((f) => ({ name: f.name, size: f.size }));
    setPendingAttachments((current) => [...current, ...selected]);
    event.target.value = '';
  }

  function removePendingAttachment(name) {
    setPendingAttachments((current) => current.filter((a) => a.name !== name));
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-bold text-sm text-slate-900 mb-3">Notes</h3>
        <form onSubmit={handleSaveNote} className="space-y-2">
          <textarea
            rows={3}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveNote(e);
            }}
            placeholder="Write a note..."
            className="form-textarea text-xs w-full"
          />
          {pendingAttachments.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {pendingAttachments.map((a) => (
                <span key={a.name} className="text-[11px] bg-slate-100 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Paperclip size={11} /> {a.name}
                  <button type="button" onClick={() => removePendingAttachment(a.name)} aria-label={`Remove ${a.name}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center">
            <label className="btn-ghost btn-sm cursor-pointer flex items-center gap-1">
              <Paperclip size={12} /> Attach
              <input type="file" multiple hidden onChange={handleAttachmentSelect} />
            </label>
            <button type="submit" disabled={!noteDraft.trim() && pendingAttachments.length === 0} className="btn-outline btn-sm disabled:opacity-50">
              Save Note
            </button>
          </div>
        </form>
        {notesList.length > 0 && (
          <div className="mt-4 space-y-2">
            {notesList.map((n) => (
              <div key={n.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                {n.body && <p className="text-slate-800 whitespace-pre-wrap">{n.body}</p>}
                {n.attachments.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    {n.attachments.map((a) => (
                      <span key={a.name} className="text-[11px] bg-white border border-slate-200 rounded-full px-2 py-0.5 flex items-center gap-1 text-slate-600">
                        <Paperclip size={11} /> {a.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {n.author} · {n.time}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 2. General Tab ────────────────────────────────────────────
function GeneralTab({ lead }) {
  const nameParts = String(lead.name || '').split(' ').filter(Boolean);
  const infoRows = [
    ['Company', lead.company || '—'],
    ['First Name', nameParts[0] || '—'],
    ['Last Name', nameParts.slice(1).join(' ') || '—'],
    ['Title', lead.jobTitle || '—'],
    ['Email', lead.email || '—'],
    ['Phone', lead.phone ? `+91 ${lead.phone}` : '—'],
    ['Mobile', lead.phone ? `+91 ${lead.phone}` : '—'],
    ['Lead Source', lead.source || '—'],
    ['Lead Status', lead.status || '—'],
    ['Industry', lead.industry || '—'],
    ['Annual Revenue', formatAmount(lead.amount)],
    ['Website', '—'],
  ];

  const addressRows = [
    ['Address', '—'],
    ['City', lead.city || '—'],
    ['State', lead.state || '—'],
    ['Country', lead.country || '—'],
    ['Zip Code', '—'],
  ];

  // Extra capture from the create form — products, lead users and the
  // optional task schedule. Only rows with values are shown.
  const extraRows = (() => {
    const extras = lead.customValues || {};
    const rows = [];
    if (Array.isArray(extras.products) && extras.products.length > 0) {
      rows.push(['Products', extras.products.join(', ')]);
    }
    if (Array.isArray(extras.leadUsers) && extras.leadUsers.length > 0) {
      rows.push(['Lead Users', extras.leadUsers.join(', ')]);
    }
    if (extras.taskDate) rows.push(['Task Date', extras.taskDate]);
    if (extras.taskTime) rows.push(['Task Time', extras.taskTime]);
    return rows;
  })();

  const activities = [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-5">Lead Information</h3>
        <div className="space-y-3.5 text-xs">
          {infoRows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-normal shrink-0">{label}</span>
              <span className="text-slate-900 font-semibold text-right truncate min-w-0 lg:min-w-auto">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
        <h3 className="font-bold text-sm text-slate-900">Address Information</h3>
        <div className="space-y-3.5 text-xs">
          {addressRows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-normal shrink-0">{label}</span>
              <span className="text-slate-900 font-semibold text-right truncate min-w-0 lg:min-w-auto">{val}</span>
            </div>
          ))}
        </div>

        <div className="h-44 rounded-2xl bg-gradient-to-b from-slate-50 via-slate-50 to-emerald-50/40 border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center text-rose-500 mb-2">
              <MapPin size={16} />
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-500/15 -mt-6 mb-3" />
            <button
              type="button"
              className="px-3.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md border border-slate-200 shadow-xs transition cursor-pointer"
            >
              View on Map
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-sm text-slate-900">Recent Activity</h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-[11px] text-slate-400">No activity yet.</p>
          ) : (
            activities.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 leading-snug">{item.title}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">{item.time}</span>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
      {extraRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-5">Additional Details</h3>
          <div className="space-y-3.5 text-xs">
            {extraRows.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-normal shrink-0">{label}</span>
                <span className="text-slate-900 font-semibold text-right truncate min-w-0 lg:min-w-auto">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. Users | Products Tab ──────────────────────────────────
function UsersProductsTab({ lead, onCountsChange, onActivity }) {
  const initialState = useLeadDetailState(lead);
  const [users, setUsers] = useState(() => (Array.isArray(initialState.users) ? initialState.users : []));
  const [products, setProducts] = useState(() => (Array.isArray(initialState.products) ? initialState.products : []));
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productDraft, setProductDraft] = useState({ name: '', sku: '', price: '', qty: 1, status: 'Active', image: '' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All Users');
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState('All Products');

  const filteredUsers = useMemo(() => (Array.isArray(users) ? users : []).filter((u) => {
    if (!u) return false;
    if (userFilter !== 'All Users' && u.status !== userFilter) return false;
    if (userSearch && !`${u.name || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase().includes(userSearch.toLowerCase())) return false;
    return true;
  }), [users, userSearch, userFilter]);

  const filteredProducts = useMemo(() => (Array.isArray(products) ? products : []).filter((p) => {
    if (!p) return false;
    if (productFilter !== 'All Products' && p.status !== productFilter) return false;
    if (productSearch && !`${p.name || ''} ${p.sku || ''}`.toLowerCase().includes(productSearch.toLowerCase())) return false;
    return true;
  }), [products, productSearch, productFilter]);

  const availableEmployees = useMemo(
    () => withSampleTeam(useCrmStore.getState().teamMembers).filter((member) => !(Array.isArray(users) ? users : []).some((user) => user && user.name === member.name)),
    [users],
  );

  React.useEffect(() => {
    updateStoredLeadDetail(lead?.id, { users, products });
    onCountsChange?.({ users: users.length, products: products.length });
  }, [lead?.id, users, products, users.length, products.length, onCountsChange]);

  function addUser() {
    const employee = withSampleTeam(useCrmStore.getState().teamMembers).find((item) => item.id === selectedEmployeeId);
    if (!employee) return;
    setUsers((current) => [
      ...current,
      {
        id: employee.id,
        initials: getInitials(employee.name),
        name: employee.name,
        email: employee.email,
        role: employee.designation,
        status: employee.status === 'Active' ? 'Active' : 'Inactive',
        bg: '#3b82f6',
      },
    ]);
    setSelectedEmployeeId('');
    setIsAddUserOpen(false);
    onActivity?.(`${employee.name} assigned to lead`, '#10b981');
  }

  function deleteUser(id) {
    const target = users.find((u) => u.id === id);
    setUsers((current) => current.filter((u) => u.id !== id));
    onActivity?.(`User "${target?.name ?? 'entry'}" removed`, '#f59e0b');
  }

  function addProduct() {
    if (!productDraft.name.trim() || !productDraft.sku.trim() || !productDraft.price || Number(productDraft.qty) < 1) return;
    setProducts((current) => [
      ...current,
      {
        id: Date.now(),
        name: productDraft.name.trim(),
        sku: productDraft.sku.trim().toUpperCase(),
        price: `Rs. ${Number(productDraft.price).toLocaleString('en-IN')}`,
        qty: Number(productDraft.qty),
        status: productDraft.status,
        image: productDraft.image,
      },
    ]);
    setProductDraft({ name: '', sku: '', price: '', qty: 1, status: 'Active', image: '' });
    setIsAddProductOpen(false);
    onActivity?.(`Product "${productDraft.name.trim()}" added`, '#ec4899');
  }

  function openEditProduct(product) {
    setEditingProduct({
      id: product.id,
      name: product.name || '',
      sku: product.sku || '',
      price: String(product.price || '').replace(/[^0-9]/g, '') || '',
      qty: product.qty || 1,
      status: product.status || 'Active',
      image: product.image || '',
    });
  }

  function saveEditProduct() {
    if (!editingProduct) return;
    if (!editingProduct.name.trim() || !editingProduct.sku.trim() || !editingProduct.price || Number(editingProduct.qty) < 1) return;
    setProducts((current) => current.map((p) => (p.id === editingProduct.id ? {
      ...p,
      name: editingProduct.name.trim(),
      sku: editingProduct.sku.trim().toUpperCase(),
      price: `Rs. ${Number(editingProduct.price).toLocaleString('en-IN')}`,
      qty: Number(editingProduct.qty),
      status: editingProduct.status,
      image: editingProduct.image,
    } : p)));
    setEditingProduct(null);
    onActivity?.(`Product "${editingProduct.name.trim()}" updated`, '#3b82f6');
  }

  function deleteProduct(id) {
    const target = products.find((p) => p.id === id);
    setProducts((current) => current.filter((p) => p.id !== id));
    onActivity?.(`Product "${target?.name ?? 'entry'}" removed`, '#f59e0b');
  }

  async function handleProductImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = await readFileAsDataUrl(file);
    setProductDraft((current) => ({ ...current, image }));
  }

  async function handleEditProductImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = await readFileAsDataUrl(file);
    setEditingProduct((current) => (current ? { ...current, image } : current));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Users Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900">Users ({filteredUsers.length})</h3>
          <button
            type="button"
            onClick={() => {
              setSelectedEmployeeId(availableEmployees[0]?.id || '');
              setIsAddUserOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={14} /> Add User
          </button>
        </div>

        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsAddUserOpen(false)}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Add Employee</h4>
                  <p className="text-xs text-slate-500 mt-1">Select an employee to assign to this lead.</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsAddUserOpen(false)} aria-label="Close add employee dialog">×</button>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Employee
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  {availableEmployees.length === 0 ? (
                    <option value="">All employees are already added</option>
                  ) : (
                    availableEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.designation} · {employee.department}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50" onClick={addUser} disabled={!selectedEmployeeId}>
                  Add User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div className="relative">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All Users">All Users</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] lg:min-w-0 text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-2 w-7 font-bold">#</th>
                <th className="py-2.5 px-2 font-bold">User Name</th>
                <th className="py-2.5 px-2 font-bold">Email</th>
                <th className="py-2.5 px-2 font-bold">Role</th>
                <th className="py-2.5 px-2 text-center font-bold">Status</th>
                <th className="py-2.5 px-2 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-2 text-slate-400 font-normal">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: u.bg || '#3b82f6' }}
                      >
                        {u.initials}
                      </div>
                      <span className="font-semibold text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-500">{u.email}</td>
                  <td className="py-3 px-2 text-slate-600">{u.role}</td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        u.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => deleteUser(u.id)}
                        className="w-7 h-7 rounded-lg border border-rose-200 text-rose-400 bg-white flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer shadow-2xs"
                        title="Delete User"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-3.5 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
          Showing 1 to {filteredUsers.length} of {filteredUsers.length} entries
        </div>
      </div>

      {/* Products Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900">Products ({filteredProducts.length})</h3>
          <button
            type="button"
            onClick={() => setIsAddProductOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>

        {isAddProductOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsAddProductOpen(false)}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Add Product</h4>
                  <p className="text-xs text-slate-500 mt-1">Enter the product details for this lead.</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsAddProductOpen(false)} aria-label="Close add product dialog">×</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  Product Name
                  <input
                    type="text"
                    value={productDraft.name}
                    onChange={(event) => setProductDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Enter product name"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  Product Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProductImageChange}
                    className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-blue-700"
                  />
                  {productDraft.image && <img src={productDraft.image} alt="Product preview" className="mt-3 h-16 w-16 rounded-lg border border-slate-200 object-cover" />}
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  SKU
                  <input
                    type="text"
                    value={productDraft.sku}
                    onChange={(event) => setProductDraft((current) => ({ ...current, sku: event.target.value }))}
                    placeholder="e.g. PRD-001"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Price
                  <input
                    type="number"
                    min="0"
                    value={productDraft.price}
                    onChange={(event) => setProductDraft((current) => ({ ...current, price: event.target.value }))}
                    placeholder="Enter price"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    value={productDraft.qty}
                    onChange={(event) => setProductDraft((current) => ({ ...current, qty: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Status
                  <select
                    value={productDraft.status}
                    onChange={(event) => setProductDraft((current) => ({ ...current, status: event.target.value }))}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setIsAddProductOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                  onClick={addProduct}
                  disabled={!productDraft.name.trim() || !productDraft.sku.trim() || !productDraft.price || Number(productDraft.qty) < 1}
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>
        )}

        {editingProduct && (
          <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setEditingProduct(null)}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Edit Product</h4>
                  <p className="text-xs text-slate-500 mt-1">Update the product details for this lead.</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setEditingProduct(null)} aria-label="Close edit product dialog">×</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  Product Name
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(event) => setEditingProduct((current) => (current ? { ...current, name: event.target.value } : current))}
                    placeholder="Enter product name"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                  Product Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditProductImageChange}
                    className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-blue-700"
                  />
                  {editingProduct.image && <img src={editingProduct.image} alt="Product preview" className="mt-3 h-16 w-16 rounded-lg border border-slate-200 object-cover" />}
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  SKU
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={(event) => setEditingProduct((current) => (current ? { ...current, sku: event.target.value } : current))}
                    placeholder="e.g. PRD-001"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Price
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.price}
                    onChange={(event) => setEditingProduct((current) => (current ? { ...current, price: event.target.value } : current))}
                    placeholder="Enter price"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.qty}
                    onChange={(event) => setEditingProduct((current) => (current ? { ...current, qty: event.target.value } : current))}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Status
                  <select
                    value={editingProduct.status}
                    onChange={(event) => setEditingProduct((current) => (current ? { ...current, status: event.target.value } : current))}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                  onClick={saveEditProduct}
                  disabled={!editingProduct.name.trim() || !editingProduct.sku.trim() || !editingProduct.price || Number(editingProduct.qty) < 1}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div className="relative">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All Products">All Products</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] lg:min-w-0 text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-2 w-7 font-bold">#</th>
                <th className="py-2.5 px-2 font-bold">Product Name</th>
                <th className="py-2.5 px-2 font-bold">SKU</th>
                <th className="py-2.5 px-2 font-bold">Price</th>
                <th className="py-2.5 px-2 font-bold">Quantity</th>
                <th className="py-2.5 px-2 text-center font-bold">Status</th>
                <th className="py-2.5 px-2 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-2 text-slate-400 font-normal">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-blue-100/70 border border-blue-200/50 flex items-center justify-center shrink-0 overflow-hidden">
                        {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-2.5 h-2.5 bg-slate-700 rounded-[2px]" />}
                      </div>
                      <span className="font-semibold text-slate-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-500 font-mono text-[11px]">{p.sku}</td>
                  <td className="py-3 px-2 text-slate-600 font-medium">{p.price}</td>
                  <td className="py-3 px-2 text-slate-700">{p.qty}</td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        p.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        className="w-7 h-7 rounded-lg border border-blue-200 text-blue-500 bg-white flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition cursor-pointer shadow-2xs"
                        title="Edit Product"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(p.id)}
                        className="w-7 h-7 rounded-lg border border-rose-200 text-rose-400 bg-white flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer shadow-2xs"
                        title="Delete Product"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-3.5 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
          Showing 1 to {filteredProducts.length} of {filteredProducts.length} entries
        </div>
      </div>
    </div>
  );
}

export default function LeadDetailView({ lead, onBackToLeads }) {
  const navigate = useNavigate();
  const [viewLead, setViewLead] = useState(lead);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const storedDetailState = useLeadDetailState(lead);
  const [activeTab, setActiveTab] = useState('Users & Products');
  const { addCustomer, showToast, customers, refreshFromBackend } = useERP() || {};
  const isLeadConverted = Boolean(
    lead?.isConverted ||
    lead?.customValues?.isConverted ||
    viewLead?.isConverted ||
    viewLead?.customValues?.isConverted ||
    lead?.status === 'Converted' ||
    viewLead?.status === 'Converted' ||
    lead?.party ||
    lead?.partyId ||
    viewLead?.party ||
    viewLead?.partyId ||
    customers?.some((c) => (
      (lead?.company && c.name?.toLowerCase() === lead?.company?.toLowerCase()) ||
      (lead?.name && c.name?.toLowerCase() === lead?.name?.toLowerCase()) ||
      (lead?.email && c.email && c.email?.toLowerCase() === lead?.email?.toLowerCase())
    ))
  );
  const [isConverted, setIsConverted] = useState(() => isLeadConverted);
  const [isConverting, setIsConverting] = useState(false);
  const convertLockRef = useRef(false);
  const [isLost, setIsLost] = useState(/lost|closed/i.test(String(lead?.status || '')));
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    setViewLead(lead);
    setIsConverted((prev) => prev || isLeadConverted);
    setIsLost(/lost|closed/i.test(String(lead?.status || '')));
  }, [lead, isLeadConverted]);
  const [detailCounts, setDetailCounts] = useState(() => ({
    users: storedDetailState.users.length,
    products: storedDetailState.products.length,
    sources: storedDetailState.sources.length,
    files: storedDetailState.files.length,
    openTasks: (storedDetailState.tasks || []).filter((t) => t.status !== 'Completed').length || lead?.openTasksCount || 0,
    calls: (storedDetailState.calls || []).length,
    estimates: lead?.estimatesCount ?? 0,
    challans: lead?.deliveryChallansCount ?? 0,
  }));
  const [activities, setActivities] = useState(() => storedDetailState.activities || []);
  const [convertedDeal, setConvertedDeal] = useState(() => findDealForLead(lead?.id));

  const logActivity = React.useCallback((title, color) => {
    if (!title) return;
    const entry = { id: `act-${Date.now()}`, title, time: 'Just now', color: color || '#3b82f6' };
    // The server records the activity from the change itself; this shows it
    // immediately, and the next read of the timeline confirms it.
    setActivities((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
  }, [viewLead?.id, lead?.id]);

  const updateDetailCounts = React.useCallback((counts) => {
    if (!counts) return;
    setDetailCounts((current) => {
      let changed = false;
      for (const [k, v] of Object.entries(counts)) {
        if (current[k] !== v) {
          changed = true;
          break;
        }
      }
      return changed ? { ...current, ...counts } : current;
    });
  }, []);

  // Sync converted deal, activities, and task counts when lead or detail state updates
  React.useEffect(() => {
    const targetId = lead?.id || viewLead?.id;
    if (!targetId) return;
    setConvertedDeal(findDealForLead(targetId));

    const incoming = storedDetailState.activities || [];
    setActivities((current) => {
      if (JSON.stringify(incoming) === JSON.stringify(current)) return current;
      const seen = new Map(current.map((a) => [a.id, a]));
      incoming.forEach((a) => seen.set(a.id, a));
      return Array.from(seen.values());
    });

    const openTasks = (storedDetailState.tasks || []).filter((t) => t.status !== 'Completed').length;
    setDetailCounts((current) => (current.openTasks === openTasks ? current : { ...current, openTasks }));
  }, [lead?.id, viewLead?.id, storedDetailState]);

  function openEditLead() {
    const source = viewLead ?? lead;
    if (!source) return;
    setEditForm({
      name: source.name ?? '',
      company: source.company ?? '',
      email: source.email ?? '',
      phone: source.phone ?? '',
      source: source.source ?? '',
      status: isConverted ? 'Converted' : (source.status ?? ''),
      owner: source.owner ?? '',
      jobTitle: source.jobTitle ?? '',
      industry: source.industry ?? '',
      city: source.city ?? '',
      state: source.state ?? '',
      country: source.country ?? '',
      zipCode: source.zipCode ?? '',
      amount: source.amount ?? '',
      leadNumber: source.leadNumber ?? '',
      createdOn: source.createdOn ?? '',
    });
    setIsEditOpen(true);
  }

  function updateEditField(field, value) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function saveEditedLead() {
    if (!editForm) return;
    const targetId = viewLead?.id ?? lead?.id;
    if (!targetId) return;
    const trimmedName = String(editForm.name ?? '').trim();
    if (!trimmedName) {
      showToast?.('Lead name is required.');
      return;
    }
    const updates = {
      name: trimmedName,
      company: String(editForm.company ?? '').trim(),
      email: String(editForm.email ?? '').trim(),
      phone: String(editForm.phone ?? '').trim(),
      source: String(editForm.source ?? '').trim(),
      status: String(editForm.status ?? '').trim() || viewLead?.status,
      owner: String(editForm.owner ?? '').trim(),
      jobTitle: String(editForm.jobTitle ?? '').trim(),
      industry: String(editForm.industry ?? '').trim(),
      city: String(editForm.city ?? '').trim(),
      state: String(editForm.state ?? '').trim(),
      country: String(editForm.country ?? '').trim(),
      zipCode: String(editForm.zipCode ?? '').trim(),
      amount: editForm.amount === '' ? 0 : Number(editForm.amount) || 0,
      leadNumber: String(editForm.leadNumber ?? '').trim(),
      createdOn: String(editForm.createdOn ?? '').trim(),
    };
    const prevStatus = viewLead?.status ?? lead?.status;
    updateStoredLead(targetId, updates);
    setViewLead((current) => ({ ...(current ?? lead), ...updates }));
    if (updates.status && updates.status !== prevStatus) {
      try {
        runLeadStageAutomation({ ...(viewLead ?? lead), ...updates }, updates.status, { previousStage: prevStatus });
      } catch (e) {
        console.error('[CRM Automation] Error in stage change automation:', e);
      }
    }
    if (updates.status === 'Converted') {
      setIsConverted(true);
    } else if (isConverted && updates.status !== 'Converted') {
      setIsConverted(false);
    }
    setIsEditOpen(false);
    setEditForm(null);
    logActivity(`Lead information updated`, '#10b981');
    showToast?.(`Lead "${updates.name}" updated.`);
  }

  function exportLead(format) {
    const effectiveLead = viewLead ?? lead;
    const filename = `${String(effectiveLead.name || 'lead').replace(/\s+/g, '_')}_details`;
    if (format === 'CSV') {
      exportToCSV(filename, ['Field', 'Value'], leadExportRows(effectiveLead));
    }
    if (format === 'Excel') {
      downloadLeadAsExcel(effectiveLead);
    }
    if (format === 'PDF') {
      printLeadAsPdf(effectiveLead);
    }
    setIsExportOpen(false);
  }

  if (!viewLead && !lead) return null;
  const activeLeadData = viewLead ?? lead;

  const metrics = [
    { label: 'Products', value: detailCounts.products, icon: ShoppingBag, color: '#ec4899', bg: '#fdf2f8' },
    { label: 'Source', value: detailCounts.sources, icon: Globe, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Files', value: detailCounts.files, icon: FileStack, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Open Tasks', value: detailCounts.openTasks, icon: ListChecks, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Calls', value: detailCounts.calls, icon: Phone, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Estimates', value: detailCounts.estimates, icon: Receipt, color: '#06b6d4', bg: '#ecfeff' },
    { label: 'Delivery Challans', value: detailCounts.challans, icon: Truck, color: '#f97316', bg: '#fff7ed' },
  ];

  const handleConvert = async () => {
    // The ref is the real re-entrancy guard: two clicks inside one render
    // pass both read `isConverted`/`isConverting` as false, but the second
    // finds the ref taken. This is what stopped one click becoming many
    // CUST- rows.
    if (convertLockRef.current) return;
    if (isConverted || isLeadConverted) {
      showToast?.('Lead is already converted to an active Customer.');
      return;
    }
    if (isLost) {
      showToast?.('Lead is marked as Lost — reopen it before converting.');
      return;
    }
    const targetId = viewLead?.id ?? lead?.id;
    if (!targetId) return;

    convertLockRef.current = true;
    setIsConverting(true);
    try {
      if (isServerId(targetId) && isBackendEnabled()) {
        // The server owns conversion (api.md §9.1): it links or creates the
        // party and opens the deal in one transaction, and a replayed click
        // gets a 409 — never a duplicate customer.
        await useCrmStore.getState().convertLead(targetId, { createCustomer: true });
      } else {
        // Frontend-design mode (no server session): convert locally, deduped
        // by name/email so a re-click cannot pile up customer rows either.
        const customerName = activeLeadData.company || activeLeadData.name;
        const customerEmail = activeLeadData.email;
        const alreadyExists = customers?.some((c) => (
          (customerName && c.name?.toLowerCase() === customerName.toLowerCase()) ||
          (customerEmail && c.email && c.email.toLowerCase() === customerEmail.toLowerCase())
        ));
        if (!alreadyExists) {
          addCustomer?.({
            name: customerName,
            contactPerson: activeLeadData.name,
            email: customerEmail,
            phone: `+91 ${activeLeadData.phone}`,
            balance: 0,
            status: 'Active',
          });
        }
      }
    } catch (err) {
      if (err?.status === 409) {
        // Already converted on the server — adopt that state, create nothing.
        setIsConverted(true);
        useCrmStore.getState().refresh('leads').catch(() => {});
        showToast?.('This lead was already converted — no duplicate customer was created.');
      } else {
        console.error('[CRM] convert failed:', err);
        showToast?.(`Could not convert lead — ${err?.message || 'server error'}`);
      }
      return;
    } finally {
      convertLockRef.current = false;
      setIsConverting(false);
    }

    const prevStatus = viewLead?.status ?? lead?.status ?? '';
    const crmState = useCrmStore.getState();
    const wonStage = [...(crmState.stages || [])].find(
      (stage) => stage.isActive !== false && (stage.isWon || stage.is_won || /won|convert/i.test(String(stage.name || ''))),
    );
    const convertedStatus = wonStage?.name || 'Converted';
    const nextCustomValues = {
      ...((viewLead ?? lead)?.customValues || {}),
      isConverted: true,
      convertedAt: new Date().toISOString(),
    };
    const updates = {
      status: convertedStatus,
      isConverted: true,
      customValues: nextCustomValues,
      ...(wonStage?.id ? { stageId: wonStage.id } : {}),
    };
    updateStoredLead(targetId, updates);
    setViewLead((current) => ({ ...(current ?? lead), ...updates }));
    setIsConverted(true);
    try {
      runLeadStageAutomation({ ...(viewLead ?? lead), ...updates }, convertedStatus, { previousStage: prevStatus });
    } catch (e) {
      console.error('[CRM Automation] Error in convert automation:', e);
    }
    // The party the server linked or created belongs on the Parties and
    // Customers screens too — re-read the ERP collections that show it.
    refreshFromBackend?.();
    logActivity('Lead converted to Customer', '#10b981');
    showToast?.(`Lead "${activeLeadData.name}" converted to Customer.`);
  };

  const handleLost = () => {
    if (isLost) {
      showToast?.('Lead is already marked as Lost.');
      return;
    }
    if (isConverted) {
      showToast?.('Lead is already converted — cannot mark it as Lost.');
      return;
    }
    const targetId = viewLead?.id ?? lead?.id;
    const prevStatus = viewLead?.status ?? lead?.status ?? '';
    // Find the workspace's Lost stage when one exists, so the Lost lead
    // lands in the right pipeline column everywhere.
    const crmState = useCrmStore.getState();
    const lostStage = [...(crmState.stages || [])].find(
      (stage) => stage.isActive !== false && /lost|closed/i.test(String(stage.name || '')),
    );
    const lostStatus = lostStage?.name || 'Lost';
    updateStoredLead(targetId, {
      status: lostStatus,
      ...(lostStage?.id ? { stageId: lostStage.id } : {}),
    });
    setViewLead((current) => ({ ...(current ?? lead), status: lostStatus }));
    setIsLost(true);
    try {
      runLeadStageAutomation({ ...(viewLead ?? lead), status: lostStatus }, lostStatus, { previousStage: prevStatus });
    } catch (e) {
      console.error('[CRM Automation] Error in lost-stage automation:', e);
    }
    logActivity('Lead marked as Lost', '#ef4444');
    showToast?.(`Lead "${activeLeadData.name}" marked as Lost.`);
  };

  const displayName = activeLeadData.name?.replace(/\s*\(Sample\)/i, '') || 'Untitled Lead';

  return (
    <div className="space-y-4">
      <div className="card p-3 text-xs text-slate-600">
        {convertedDeal ? <>Converted to Deal: {convertedDeal.id} <Link className="ml-2 text-blue-600 hover:underline" to={`/crm/deals?deal=${encodeURIComponent(convertedDeal.id)}`}>View Deal</Link></> : (isConverted ? <span className="text-emerald-600 font-semibold">Converted to Customer</span> : (isLost ? <span className="text-rose-600 font-semibold">Lost — not converted / no deal</span> : 'Not converted / No Deal'))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0 lg:min-w-auto text-xs font-medium text-slate-500">
          <Link to="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          <span className="text-slate-300">&gt;</span>
          <Link to="/crm/leads" className="text-blue-600 hover:underline">Leads</Link>
          <span className="text-slate-300">&gt;</span>
          <span className="text-slate-900 font-semibold">{displayName}</span>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToLeads}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <ArrowLeft size={13} className="text-slate-500" /> Back
          </button>
          <button
            type="button"
            onClick={openEditLead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <Pencil size={13} className="text-slate-500" /> Edit
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={isConverted || isLost || isConverting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition ${
              isConverted
                ? 'bg-emerald-600 text-white cursor-not-allowed opacity-90'
                : isConverting
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 cursor-pointer'
            }`}
          >
            <CheckCircle size={13} /> {isConverting ? 'Converting…' : isConverted ? 'Converted' : 'Convert'}
          </button>
          <button
            type="button"
            onClick={handleLost}
            disabled={isConverted || isLost || isConverting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition ${
              isLost
                ? 'bg-rose-600 text-white cursor-not-allowed'
                : isConverted
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer'
            }`}
          >
            <XCircle size={13} /> {isLost ? 'Lost' : 'Mark Lost'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
            onClick={() => setIsExportOpen(true)}
          >
            <Printer size={13} className="text-slate-500" /> Print
          </button>
        </div>
      </div>

      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsExportOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Print Lead Details</h2>
                <p className="text-xs text-slate-500 mt-1">Choose a format for {displayName}</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsExportOpen(false)} aria-label="Close print options">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['CSV', 'Excel', 'PDF'].map((format) => (
                <button key={format} type="button" className="border border-slate-200 rounded-lg px-3 py-3 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50" onClick={() => exportLead(format)}>
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0 lg:min-w-auto">
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-100 ring-2 ring-slate-50">
              {activeLeadData.photo ? (
                <img
                  src={activeLeadData.photo}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="w-full h-full grid place-items-center text-xl font-bold text-white"
                  style={{ backgroundColor: activeLeadData.avatarColor || '#2F6FED' }}
                >
                  {getInitials(displayName)}
                </span>
              )}
            </div>
            <div className="space-y-1 min-w-0 lg:min-w-auto">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
                <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900 break-words">{displayName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isConverted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (isLost ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200')}`}>
                  {isConverted ? 'Converted' : (isLost ? (activeLeadData.status || 'Lost') : (activeLeadData.status || '—'))}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 font-medium">{activeLeadData.company || '—'}</p>
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {activeLeadData.phone ? `+91 ${activeLeadData.phone}` : '—'}</span>
                <span className="flex items-center gap-1.5 min-w-0 lg:min-w-auto break-all"><Mail size={13} className="text-slate-400 shrink-0 lg:shrink" /> {activeLeadData.email || '—'}</span>
                <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /> {[activeLeadData.city, activeLeadData.state, activeLeadData.country].filter(Boolean).join(', ') || '—'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-8">
            <div>
              <span className="text-[11px] text-slate-400 block font-normal mb-1">Lead Number</span>
              <strong className="text-xs font-bold text-slate-900 font-mono">{activeLeadData.leadNumber || '—'}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal mb-1">Source</span>
              <strong className="text-xs font-bold text-slate-900">{activeLeadData.source || '—'}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal mb-1">Created On</span>
              <strong className="text-xs font-bold text-slate-900">{activeLeadData.createdOn || '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5 my-4">
        {metrics.map((m, index) => (
          <CrmKpiCard key={m.label} label={m.label} value={m.value} icon={m.icon} tone={['rose', 'emerald', 'purple', 'amber', 'blue', 'teal', 'orange'][index]} />
        ))}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-xs scrollbar-none">
        {DETAIL_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const TabIcon = DETAIL_TAB_ICONS[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex shrink-0 lg:shrink items-center gap-1.5 px-3.5 py-2 whitespace-nowrap rounded-lg text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-xs'
              }`}
            >
              <TabIcon size={14} strokeWidth={isActive ? 2.3 : 2} />
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      {activeTab === 'Sources & Emails' && <SourcesAndEmailsTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'General' && <GeneralTab lead={activeLeadData} />}
      {activeTab === 'Users & Products' && <UsersProductsTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Discussion & Notes' && <DiscussionNotesTab lead={activeLeadData} onActivity={logActivity} />}
      {activeTab === 'Files' && <FilesTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Tasks' && <LeadTasksTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Calls' && <CallsTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Estimates' && <EstimatesTab lead={activeLeadData} onCountsChange={updateDetailCounts} />}
      {activeTab === 'Quotations' && <QuotationsTab lead={activeLeadData} onActivity={logActivity} />}
      {activeTab === 'Delivery Challans' && <DeliveryChallansTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Activity' && <ActivityTab lead={activeLeadData} items={activities} />}
      {!['Sources & Emails', 'General', 'Users & Products', 'Discussion & Notes', 'Files', 'Tasks', 'Calls', 'Estimates', 'Quotations', 'Delivery Challans', 'Activity'].includes(activeTab) && (
        <div className="card p-8 text-center space-y-2">
          <Info size={28} className="text-blue-500 mx-auto" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{activeTab} Details</h4>
          <p className="text-xs text-slate-400">
            Real-time synchronization for {activeTab.toLowerCase()} associated with {activeLeadData.name}.
          </p>
        </div>
      )}

      {isEditOpen && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => { setIsEditOpen(false); setEditForm(null); }}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit lead information">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Edit Lead Information</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update the lead details below</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none" onClick={() => { setIsEditOpen(false); setEditForm(null); }} aria-label="Close edit lead dialog">×</button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Name *
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.name} onChange={(e) => updateEditField('name', e.target.value)} placeholder="Enter lead name" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Company
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.company} onChange={(e) => updateEditField('company', e.target.value)} placeholder="Enter company name" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Email
                <input type="email" className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.email} onChange={(e) => updateEditField('email', e.target.value)} placeholder="Enter email address" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Phone
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.phone} onChange={(e) => updateEditField('phone', e.target.value)} placeholder="Enter phone number" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Source
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400 bg-white" value={editForm.source} onChange={(e) => updateEditField('source', e.target.value)}>
                  <option value="">Select source</option>
                  {Array.from(new Set(['Broker', 'Sales Person', editForm.source].filter(Boolean))).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Status
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400 bg-white" value={editForm.status} onChange={(e) => updateEditField('status', e.target.value)}>
                  {Array.from(new Set([editForm.status, ...getLeadStageOrder()].filter(Boolean))).map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Owner
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.owner} onChange={(e) => updateEditField('owner', e.target.value)} placeholder="Select User" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Title
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.jobTitle} onChange={(e) => updateEditField('jobTitle', e.target.value)} placeholder="Enter title" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Industry
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.industry} onChange={(e) => updateEditField('industry', e.target.value)} placeholder="Enter industry" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Number
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.leadNumber} onChange={(e) => updateEditField('leadNumber', e.target.value)} placeholder="L-001" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                City
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.city} onChange={(e) => updateEditField('city', e.target.value)} placeholder="Enter city" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                State
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.state} onChange={(e) => updateEditField('state', e.target.value)} placeholder="Enter state" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Country
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.country} onChange={(e) => updateEditField('country', e.target.value)} placeholder="Enter country" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Zip Code
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.zipCode} onChange={(e) => updateEditField('zipCode', e.target.value)} placeholder="Enter zip code" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Annual Revenue / Amount
                <input type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.amount} onChange={(e) => updateEditField('amount', e.target.value)} placeholder="Enter amount" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                Created On
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.createdOn} onChange={(e) => updateEditField('createdOn', e.target.value)} placeholder="27/08/2026" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-xl">
              <button type="button" className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200" onClick={() => { setIsEditOpen(false); setEditForm(null); }}>
                Cancel
              </button>
              <button type="button" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700" onClick={saveEditedLead}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


