/**
 * crmLogic.js — Graph-parity pure logic layer.
 *
 * Every function here mirrors functionality documented in graphify-out/
 * (14 communities, 236 nodes) as a pure, UI-free, testable helper.
 *
 * RULES:
 * - No JSX, no React, no DOM, no CSS changes.
 * - No imports from components. Only pure JS.
 * - Existing components keep working untouched; they may adopt these
 *   helpers later without any behavior break.
 */

// ── App Shell & Lead Modals ──────────────────────────────────────────────

export const INITIAL_FILTERS = { statuses: [], sources: [], systemDefined: [], search: '' };
export const INITIAL_SORT = { field: '', direction: 'ascending' };

export const SORT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'name', label: 'Lead Name' },
  { value: 'company', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Lead Source' },
  { value: 'owner', label: 'Lead Owner' },
  { value: 'status', label: 'Lead Status' },
  { value: 'createdOn', label: 'Created On' },
];

export function getSortValue(lead, field) {
  if (!lead || !field) return '';
  if (field === 'createdOn') {
    const t = new Date(lead.createdOn).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return String(lead[field] ?? '').toLowerCase();
}

// ── Lead Data Operations (pure reducers) ─────────────────────────────────

export function applyLeadFilters(leads, { activeTab = 'All Leads', appliedFilters = INITIAL_FILTERS } = {}) {
  const list = Array.isArray(leads) ? leads : [];
  return list.filter((l) => {
    if (activeTab !== 'All Leads' && l.status !== activeTab) return false;
    if (appliedFilters.statuses?.length > 0 && !appliedFilters.statuses.includes(l.status)) return false;
    if (appliedFilters.sources?.length > 0 && !appliedFilters.sources.includes(l.source)) return false;
    if (appliedFilters.search) {
      const hay = `${l.name ?? ''} ${l.company ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase();
      if (!hay.includes(String(appliedFilters.search).toLowerCase())) return false;
    }
    return true;
  });
}

export function applyLeadSort(leads, appliedSort = INITIAL_SORT) {
  const list = Array.isArray(leads) ? [...leads] : [];
  if (!appliedSort?.field) return list;
  const dir = appliedSort.direction === 'descending' ? -1 : 1;
  return list.sort((a, b) => {
    const av = getSortValue(a, appliedSort.field);
    const bv = getSortValue(b, appliedSort.field);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

export function updateLeadInList(leads, id, updates) {
  return (Array.isArray(leads) ? leads : []).map((lead) => (lead.id === id ? { ...lead, ...updates } : lead));
}

export function deleteLeadFromList(leads, id) {
  return (Array.isArray(leads) ? leads : []).filter((lead) => lead.id !== id);
}

export function deleteManyLeadsFromList(leads, leadsToDelete) {
  const ids = new Set((Array.isArray(leadsToDelete) ? leadsToDelete : []).map((l) => l.id));
  return (Array.isArray(leads) ? leads : []).filter((lead) => !ids.has(lead.id));
}

export function pinLeadId(pinnedIds, id) {
  const list = Array.isArray(pinnedIds) ? pinnedIds : [];
  return list.includes(id) ? list : [...list, id];
}

export function unpinLeadId(pinnedIds, id) {
  return (Array.isArray(pinnedIds) ? pinnedIds : []).filter((x) => x !== id);
}

export function toggleSelection(selected, id) {
  const list = Array.isArray(selected) ? selected : [];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function toggleSelectAll(selected, rows) {
  const ids = (Array.isArray(rows) ? rows : []).map((r) => r.id);
  const list = Array.isArray(selected) ? selected : [];
  const allIn = ids.length > 0 && ids.every((id) => list.includes(id));
  return allIn ? list.filter((id) => !ids.includes(id)) : [...new Set([...list, ...ids])];
}

// ── Filtering & Mock Data ────────────────────────────────────────────────

export function toggleValue(list, value) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

// ── Lead Detail Workspace ────────────────────────────────────────────────

export function formatAmount(value) {
  return `Rs. ${(Number(value) || 0).toLocaleString('en-IN')}`;
}

export function getInitials(name) {
  return initials(name);
}

export function statusClass(value) {
  return String(value || '').toLowerCase() === 'active' ? 'green' : 'amber';
}

export function getStatusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'qualified' || s === 'won' || s === 'active' || s === 'paid') return 'green';
  if (s === 'contacted' || s === 'negotiation' || s === 'partially paid' || s === 'pending') return 'amber';
  if (s === 'lost' || s === 'overdue' || s === 'cancelled') return 'red';
  return 'slate';
}

export function buildUsers(lead) {
  const owner = lead?.owner || 'David Patel';
  return [
    { id: 1, name: owner, role: 'Account Owner', email: 'david@evenmore.io', status: 'Active', color: '#2F6FED', leadCompany: lead?.company },
    { id: 2, name: 'Priya Mehta', role: 'Sales Executive', email: 'priya@evenmore.io', status: 'Active', color: '#7C3AED', leadCompany: lead?.company },
    { id: 3, name: 'Rohit Sharma', role: 'Technical Lead', email: 'rohit@evenmore.io', status: 'Active', color: '#059669', leadCompany: lead?.company },
    { id: 4, name: 'Sarah Chen', role: 'Sales Support Executive', email: 'sarah@evenmore.io', status: 'Active', color: '#EA580C', leadCompany: lead?.company },
    { id: 5, name: 'Alex Rivera', role: 'BDE', email: 'alex@evenmore.io', status: 'Active', color: '#0891B2', leadCompany: lead?.company },
  ];
}

export function buildProducts() {
  return [
    { id: 1, name: 'Endoscopy Vision Machine', sku: 'EVM-2026', price: 120000, qty: 1, status: 'Active', category: 'Imaging' },
    { id: 2, name: 'High-Definition Surgical Monitor 4K', sku: 'MON-4K-01', price: 45000, qty: 1, status: 'Active', category: 'Display' },
    { id: 3, name: 'Surgical Light Head', sku: 'SLH-09', price: 28000, qty: 1, status: 'Active', category: 'Lighting' },
  ];
}

export function buildSentFiles(lead) {
  const company = lead?.company || 'Hirapara Industries';
  const owner = lead?.owner || 'David Patel';
  return [
    { id: `file-${lead?.id || 0}-1`, type: 'image', name: `${company} Front Desk.jpg`, size: '2.4 MB', sentOn: 'Aug 26, 2026', sentBy: owner, description: 'Shared for location confirmation.' },
    { id: `file-${lead?.id || 0}-2`, type: 'document', name: `${company} Product Quotation.pdf`, size: '860 KB', sentOn: 'Aug 28, 2026', sentBy: owner, description: 'Final quotation document.' },
  ];
}

export function buildDiscussionThreads(lead) {
  const assignedUsers = buildUsers(lead).slice(0, 4);
  const leadName = String(lead?.name || 'Lead').replace(' (Sample)', '');
  return [
    {
      id: `lead-${lead?.id || 0}`,
      kind: 'lead',
      name: leadName,
      subtitle: lead?.company,
      badge: lead?.status,
      time: 'Just now',
      note: `Lead ${leadName} needs a final follow-up.`,
      messages: [
        { id: `lead-${lead?.id || 0}-1`, side: 'in', sender: leadName, body: `Hi team, please share the quotation for ${lead?.company}.`, time: '10:30 AM' },
        { id: `lead-${lead?.id || 0}-2`, side: 'out', sender: 'You', body: 'Quotation draft is ready.', time: '10:42 AM' },
      ],
    },
    ...assignedUsers.map((user, index) => ({
      id: `user-${lead?.id || 0}-${user.id}`,
      kind: 'user',
      name: user.name,
      subtitle: user.role,
      badge: user.status,
      color: user.color,
      time: `${index + 1}:1${index} PM`,
      note: `${user.name} is assigned for support on this lead.`,
      messages: [
        { id: `user-${lead?.id || 0}-${user.id}-1`, side: 'in', sender: user.name, body: 'Checked the requirement. Will highlight use cases in the next call.', time: `${index + 1}:1${index} PM` },
      ],
    })),
  ];
}

export function fieldRows(lead = {}) {
  return [
    ['Company', lead.company || 'Hirapara Industries'],
    ['Title', lead.jobTitle || 'Managing Director'],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Amount', formatAmount(lead.amount)],
  ];
}

export function addressRows(lead = {}) {
  return [
    ['City', lead.city],
    ['State', lead.state],
    ['Country', lead.country],
    ['Zip Code', `39${4200 + (lead.id || 0)}`],
  ];
}

export function metricCards(counts = {}) {
  return [
    { label: 'Products', value: counts.products ?? 0 },
    { label: 'Sources', value: counts.sources ?? 0 },
    { label: 'Files', value: counts.files ?? 0 },
  ];
}

export function addUserToList(users, user) {
  return [...(Array.isArray(users) ? users : []), { id: Date.now(), status: 'Active', ...user }];
}

export function editUserInList(users, id, updates) {
  return (Array.isArray(users) ? users : []).map((u) => (u.id === id ? { ...u, ...updates } : u));
}

export function addProductToList(products, product) {
  return [...(Array.isArray(products) ? products : []), { id: Date.now(), status: 'Active', qty: 1, ...product }];
}

export function editProductInList(products, id, updates) {
  return (Array.isArray(products) ? products : []).map((p) => (p.id === id ? { ...p, ...updates } : p));
}

// ── Notes & Discussions ──────────────────────────────────────────────────

export function updateThreadMessages(threads, threadId, updater) {
  return (Array.isArray(threads) ? threads : []).map((t) =>
    t.id === threadId ? { ...t, messages: typeof updater === 'function' ? updater(t.messages || []) : updater } : t,
  );
}

export function appendSystemMessage(threads, threadId, body) {
  return updateThreadMessages(threads, threadId, (messages) => [
    ...messages,
    { id: `sys-${Date.now()}`, side: 'sys', sender: 'System', body, time: 'Just now' },
  ]);
}

export function appendUserMessage(threads, threadId, message) {
  return updateThreadMessages(threads, threadId, (messages) => [
    ...messages,
    { id: `msg-${Date.now()}`, side: 'out', time: 'Just now', ...message },
  ]);
}

export function discussionAction(kind) {
  const map = {
    call: { icon: 'phone', label: 'Log a call', systemMessage: 'Call logged with lead.' },
    mail: { icon: 'mail', label: 'Send email', systemMessage: 'Email sent to lead.' },
    user: { icon: 'user', label: 'Assign user', systemMessage: 'User assigned to lead.' },
  };
  return map[kind] || { icon: 'note', label: 'Add note', systemMessage: 'Note added.' };
}

export function applyNoteCommand(currentValue, { start, end, prefix, suffix, fallback = 'text' }) {
  const s = start ?? currentValue.length;
  const e = end ?? currentValue.length;
  const selected = currentValue.slice(s, e);
  const insert = `${prefix}${selected || fallback}${suffix ?? prefix}`;
  return {
    nextValue: `${currentValue.slice(0, s)}${insert}${currentValue.slice(e)}`,
    selectionStart: s + prefix.length,
    selectionEnd: s + prefix.length + (selected || fallback).length,
  };
}

export function formatNoteValue(currentValue, start, end, prefix, suffix = prefix, fallback = 'text') {
  return applyNoteCommand(currentValue, { start, end, prefix, suffix, fallback });
}

export function removePendingAttachment(attachments, id) {
  return (Array.isArray(attachments) ? attachments : []).filter((a) => a.id !== id);
}

// ── Files tab ────────────────────────────────────────────────────────────

export function addUploadedFiles(files, newFiles) {
  return [...(Array.isArray(files) ? files : []), ...(Array.isArray(newFiles) ? newFiles : [])];
}

export function removeFileById(files, id) {
  return (Array.isArray(files) ? files : []).filter((f) => f.id !== id);
}

// ── Sources & Emails tab ─────────────────────────────────────────────────

export function addSourceEntry(entries, entry) {
  return [...(Array.isArray(entries) ? entries : []), { id: Date.now(), date: new Date().toISOString(), ...entry }];
}

export function toggleRecipient(recipients, id) {
  return toggleValue(recipients, id);
}

// ── Custom Form Builder (pure reducers) ──────────────────────────────────

export function moveArrayItem(list, from, to) {
  const arr = [...(Array.isArray(list) ? list : [])];
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return arr;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  return arr;
}

export function addFormField(sections, sectionId, field) {
  return (Array.isArray(sections) ? sections : []).map((s) =>
    s.id === sectionId ? { ...s, fields: [...(s.fields || []), field] } : s,
  );
}

export function updateFormField(sections, sectionId, fieldId, updates) {
  return (Array.isArray(sections) ? sections : []).map((s) =>
    s.id === sectionId
      ? { ...s, fields: (s.fields || []).map((f) => (f.id === fieldId ? { ...f, ...updates } : f)) }
      : s,
  );
}

export function removeFormField(sections, sectionId, fieldId) {
  return (Array.isArray(sections) ? sections : []).map((s) =>
    s.id === sectionId ? { ...s, fields: (s.fields || []).filter((f) => f.id !== fieldId) } : s,
  );
}

export function moveFormField(sections, sectionId, from, to) {
  return (Array.isArray(sections) ? sections : []).map((s) =>
    s.id === sectionId ? { ...s, fields: moveArrayItem(s.fields || [], from, to) } : s,
  );
}

export function addFormSection(sections, section) {
  return [...(Array.isArray(sections) ? sections : []), { id: `section-${Date.now()}`, title: 'New Section', fields: [], ...section }];
}

export function removeFormSection(sections, sectionId) {
  return (Array.isArray(sections) ? sections : []).filter((s) => s.id !== sectionId);
}

export function readDragPayload(dataTransferText) {
  try {
    return JSON.parse(dataTransferText);
  } catch {
    return { type: dataTransferText || '' };
  }
}

// ── Stage & Task Kanban (pure reducers) ──────────────────────────────────

export const EMPTY_MASTER_TASK = {
  name: '',
  role: '',
  priority: 'Medium',
  dueIn: 0,
  time: '',
  department: 'Any',
  repeats: 6,
  form: 'None',
  description: '',
};

export function buildMasterTaskPayload(masterTask, stage, taskModalStageId) {
  return {
    id: Date.now(),
    name: String(masterTask.name || '').trim(),
    description: String(masterTask.description || '').trim() || 'New stage task',
    role: masterTask.role || 'Sales Executive',
    department: masterTask.department || 'Any',
    priority: masterTask.priority || 'Medium',
    time: masterTask.time || '',
    form: masterTask.form || 'None',
    order: (stage?.tasks?.length || 0) + 1,
    required: true,
    autoCreate: true,
    repeats: Number(masterTask.repeats) || 0,
    dueIn: Number(masterTask.dueIn) || 0,
    stageId: taskModalStageId,
  };
}

export function addTaskToStages(stages, stageId, task) {
  return (Array.isArray(stages) ? stages : []).map((stage) =>
    stage.id === stageId ? { ...stage, tasks: [...(stage.tasks || []), task] } : stage,
  );
}

export function editTaskInStages(stages, stageId, taskId, updates) {
  return (Array.isArray(stages) ? stages : []).map((stage) =>
    stage.id === stageId
      ? { ...stage, tasks: (stage.tasks || []).map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
      : stage,
  );
}

export function deleteTaskFromStages(stages, stageId, taskId) {
  return (Array.isArray(stages) ? stages : []).map((stage) =>
    stage.id === stageId ? { ...stage, tasks: (stage.tasks || []).filter((t) => t.id !== taskId) } : stage,
  );
}

export function toggleStageId(openStages, stageId) {
  return toggleValue(openStages, stageId);
}

export function flattenStageTasks(stages) {
  return (Array.isArray(stages) ? stages : []).flatMap((stage) =>
    (stage.tasks || []).map((task) => ({ ...task, stageId: stage.id })),
  );
}

// ── Lead Creation Modal ──────────────────────────────────────────────────

export function addMultiValue(values, value) {
  const v = String(value || '').trim();
  if (!v) return Array.isArray(values) ? values : [];
  const list = Array.isArray(values) ? values : [];
  return list.includes(v) ? list : [...list, v];
}

export function removeMultiValue(values, value) {
  return (Array.isArray(values) ? values : []).filter((v) => v !== value);
}

export function isValidPhotoFile(file, { maxMB = 5 } = {}) {
  if (!file) return false;
  if (typeof file.type === 'string' && file.type && !file.type.startsWith('image/')) return false;
  if (typeof file.size === 'number' && file.size > maxMB * 1024 * 1024) return false;
  return true;
}

export function buildLeadPayload(input = {}) {
  return {
    name: String(input.name || '').trim(),
    company: String(input.company || '').trim(),
    email: String(input.email || '').trim(),
    phone: String(input.phone || '').trim(),
    status: input.status || 'New',
    source: input.source || 'Website',
    owner: input.owner || '',
    products: Array.isArray(input.products) ? input.products : [],
    users: Array.isArray(input.users) ? input.users : [],
  };
}

// ── Dashboard Analytics ──────────────────────────────────────────────────

export function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function buildChartSegments(values) {
  const list = Array.isArray(values) ? values : [];
  const total = list.reduce((a, b) => a + (Number(b.value) || 0), 0);
  if (total <= 0) return list.map((v) => ({ ...v, percent: 0, startAngle: 0, endAngle: 0 }));
  let cursor = 0;
  return list.map((v) => {
    const percent = ((Number(v.value) || 0) / total) * 100;
    const sweep = (percent / 100) * 360;
    const seg = { ...v, percent, startAngle: cursor, endAngle: cursor + sweep };
    cursor += sweep;
    return seg;
  });
}

// ── Inline Table Editing ─────────────────────────────────────────────────

export function editableCellNextState(state, action) {
  switch (action.type) {
    case 'start':
      return { editing: true, draft: action.value ?? state.value };
    case 'change':
      return { ...state, draft: action.value };
    case 'save':
      return { editing: false, value: state.draft, draft: state.draft };
    case 'cancel':
      return { editing: false, draft: state.value };
    default:
      return state;
  }
}

export function shouldCommitCellEdit(key) {
  return key === 'Enter';
}

export function shouldCancelCellEdit(key) {
  return key === 'Escape';
}

// ── Navigation Sidebar ───────────────────────────────────────────────────

export function toggleExpandable(expanded, id) {
  return toggleValue(expanded, id);
}

export function clampSidebarWidth(width, min = 200, max = 420) {
  return Math.min(max, Math.max(min, Number(width) || min));
}

// CRM state is never persisted in the browser: the server is the source of truth.
