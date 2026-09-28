import CrmKpiCard from '../common/CrmKpiCard';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import LeadsTabs from './LeadsTabs';
import FilterPanel from './FilterPanel';
import LeadsTable from './LeadsTable';
import LeadCardGridView from './LeadCardGridView';
import LeadGridView from './LeadGridView';
import LeadMapView from './LeadMapView';
import Pagination from '../../../components/ui/Pagination';
import NotesDrawer from './NotesDrawer';
import CreateLeadModal from './CreateLeadModal';
import DeleteLeadModal from './DeleteLeadModal';
import LeadGuideModal from './LeadGuideModal';
import InfoBanner from '../common/InfoBanner';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/appStore';
import { Users, UserPlus, Clock, TrendingUp, Plus } from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import { describeError } from '../../../services/crmSync';
import { exportToCSV } from '../../../services/exportUtils';
import { runLeadStageAutomation } from '../../../services/leadStageAutomation';
import { emitCrmEvent, CRM_EVENT_TYPES } from '../../../services/crmEventNotifications';

const INITIAL_FILTERS = { statuses: [], sources: [], systemDefined: [], search: '' };
const INITIAL_SORT = { field: '', direction: 'ascending' };

const SORT_OPTIONS = [
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

const LEAD_EXPORT_FIELDS = [
  ['Lead Name', 'name'],
  ['Company', 'company'],
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Lead Source', 'source'],
  ['Title', 'jobTitle'],
  ['Industry', 'industry'],
  ['Lead Owner', 'owner'],
  ['Status', 'status'],
  ['Created On', 'createdOn'],
];

function escapeExportHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportLeadRows(rows) {
  return rows.map((lead) => LEAD_EXPORT_FIELDS.map(([, key]) => lead[key] ?? ''));
}

function downloadLeadsAsExcel(rows) {
  const headers = LEAD_EXPORT_FIELDS.map(([label]) => label);
  const tableRows = rows.map((lead) => `<tr>${LEAD_EXPORT_FIELDS.map(([, key]) => `<td>${escapeExportHtml(lead[key])}</td>`).join('')}</tr>`).join('');
  const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeExportHtml(header)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>`;
  const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leads_details.xls';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printLeadsAsPdf(rows) {
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) return;
  const headers = LEAD_EXPORT_FIELDS.map(([label]) => `<th>${escapeExportHtml(label)}</th>`).join('');
  const tableRows = rows.map((lead) => `<tr>${LEAD_EXPORT_FIELDS.map(([, key]) => `<td>${escapeExportHtml(lead[key])}</td>`).join('')}</tr>`).join('');
  printWindow.document.write(`<!doctype html><html><head><title>Lead Details</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#e2e8f0}</style></head><body><h1>Lead Details</h1><table><thead><tr>${headers}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

const leadsGuide = {
  title: 'CRM Leads',
  subtitle: 'Capture, qualify, and convert prospective customer opportunities.',
  purpose: 'A lead is a prospective customer or business opportunity that can be qualified, assigned, followed up, and converted into a customer or sales opportunity.',
  workflow: ['Lead Captured', 'Assigned to Owner', 'Qualification', 'Follow-up', 'Converted'],
  keyTerms: [
    { term: 'Lead', definition: 'A person or company that may become a customer.' },
    { term: 'Lead Source', definition: 'The channel that generated the lead, such as a referral, campaign, or website.' },
    { term: 'Lead Owner', definition: 'The team member responsible for follow-up and progress.' },
    { term: 'Qualification', definition: 'The process of confirming need, fit, timing, and purchase intent.' },
    { term: 'Follow-up', definition: 'A planned call, email, note, or task used to move the lead forward.' },
    { term: 'Conversion', definition: 'Turning a qualified lead into a customer or active sales opportunity.' },
  ],
};

function getSortValue(lead, field) {
  if (field === 'createdOn') return new Date(lead.createdOn).getTime();
  return String(lead[field] ?? '').toLowerCase();
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const leadRows = useCrmStore((s) => s.leads);
  const crmLoading = useCrmStore((s) => s.status.loading);
  const crmError = useCrmStore((s) => s.status.error);
  const createLeadRecord = useCrmStore((s) => s.createLead);
  const updateLeadRecord = useCrmStore((s) => s.updateLead);
  const deleteLeadRecord = useCrmStore((s) => s.deleteLead);
  const deleteLeadRecords = useCrmStore((s) => s.deleteLeads);
  const toggleLeadPin = useCrmStore((s) => s.toggleLeadPin);
  const showToast = useAppStore((s) => s.showToast);
  const firstStageId = useCrmStore((s) => (
    [...s.stages]
      .filter((stage) => stage.isActive !== false)
      .sort((a, b) => (Number(a.order ?? a.sequence) || 0) - (Number(b.order ?? b.sequence) || 0))[0]?.id
  ));
  const createLeadMode = useCrmStore((s) => s.createLeadMode);
  const setCreateLeadMode = useCrmStore((s) => s.setCreateLeadMode);
  const [activeTab, setActiveTab] = useState('All Leads');
  const [selected, setSelected] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCreateLeadOpen = isModalOpen; 
  const [showLeadTour, setShowLeadTour] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [leadView, setLeadView] = useState('list');
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [appliedSort, setAppliedSort] = useState(INITIAL_SORT);
  const [draftSort, setDraftSort] = useState(INITIAL_SORT);
  const [noteTarget, setNoteTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const selectedLeads = useMemo(
    () => leadRows.filter((lead) => selected.includes(lead.id)),
    [leadRows, selected],
  );
  const selectedLead = selectedLeads[0] ?? null;

  const rows = useMemo(() => {
    const filtered = leadRows.filter((l) => {
      if (activeTab !== 'All Leads' && l.status !== activeTab) return false;
      if (appliedFilters.statuses.length > 0 && !appliedFilters.statuses.includes(l.status)) return false;
      if (appliedFilters.sources.length > 0 && !appliedFilters.sources.includes(l.source)) return false;
      if (appliedFilters.search) {
        const h = `${l.name} ${l.company} ${l.email} ${l.phone}`.toLowerCase();
        if (!h.includes(String(appliedFilters.search ?? '').toLowerCase())) return false;
      }
      return true;
    });

    if (!appliedSort.field) return filtered;
    const dir = appliedSort.direction === 'descending' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, appliedSort.field);
      const bv = getSortValue(b, appliedSort.field);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [activeTab, appliedFilters, appliedSort, leadRows]);

  useEffect(() => {
    // Other CRM views listen for this to re-read what the server now holds.
    window.dispatchEvent(new Event('crm:data-updated'));
  }, [leadRows]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, appliedFilters, appliedSort, leadRows, pageSize]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  function handlePageSizeChange(nextSize) {
    setPageSize(nextSize);
    setPage(1);
  }

  async function updateLead(id, updates) {
    const oldLead = leadRows.find((l) => l.id === id);
    try {
      const saved = await updateLeadRecord(id, updates);
      const updatedLead = { ...(oldLead || {}), ...updates, ...(saved || {}) };
      if (oldLead && updates?.status && updates.status !== oldLead.status) {
        try {
          runLeadStageAutomation(updatedLead, updates.status, { previousStage: oldLead.status });
        } catch (e) {
          console.error('[CRM Automation] Error in updateLead automation:', e);
        }
      }
    } catch (err) {
      showToast?.(`Lead not saved — ${describeError(err)}`);
    }
  }

  const toggleOne = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAll = () => {
    const ids = rows.map((r) => r.id);
    const allIn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected(allIn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  function clearSelected() {
    setSelected([]);
  }

  function openNotes(lead) {
    setNoteTarget(lead ?? selectedLead);
  }

  function closeNotes() {
    setNoteTarget(null);
  }

  function openLeadDetails(lead) {
    const target = lead ?? selectedLead;
    if (!target) return;
    navigate(`/crm/leads/${target.id}`);
  }

  function goToLeads() {
    navigate('/crm/leads');
  }

  function openTaskForm(lead) {
    const target = lead ?? selectedLead;
    if (target && !selected.includes(target.id)) {
      setSelected([target.id]);
    }
    navigate('/crm/tasks');
  }

  function openFilterPanel() {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(true);
  }

  function closeFilterPanel() {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(false);
  }

  function openSortPanel() {
    setDraftSort(appliedSort);
    setIsSortOpen(true);
  }

  function closeSortPanel() {
    setDraftSort(appliedSort);
    setIsSortOpen(false);
  }

  function updateDraftFilter(key, value) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function updateDraftSort(key, value) {
    setDraftSort((current) => ({ ...current, [key]: value }));
  }

  function clearDraftFilters() {
    setDraftFilters(INITIAL_FILTERS);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setIsFilterOpen(false);
  }

  function applySort() {
    setAppliedSort(draftSort.field ? draftSort : INITIAL_SORT);
    setIsSortOpen(false);
  }

  function clearSort() {
    setAppliedSort(INITIAL_SORT);
    setDraftSort(INITIAL_SORT);
    setIsSortOpen(false);
  }

  function exportLeads(format) {
    const headers = LEAD_EXPORT_FIELDS.map(([label]) => label);
    if (format === 'CSV') exportToCSV('leads_details', headers, exportLeadRows(rows));
    if (format === 'Excel') downloadLeadsAsExcel(rows);
    if (format === 'PDF') printLeadsAsPdf(rows);
    setIsPrintOpen(false);
  }

  function openCreateLeadModal() {
    setIsModalOpen(true);
  }

  function formatDisplayDate(value) {
    if (!value) return new Date().toLocaleDateString('en-GB');
    const parts = String(value).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(value);
  }

  async function handleCreateLead(formData) {
    const data = formData ?? {};
    // The server owns the id, the lead number and the stage defaults, so the
    // payload carries only what the user actually typed.
    let createdLead = null;
    try {
      createdLead = await createLeadRecord({
        // A lead has to enter the pipeline somewhere; the first configured
        // stage is where the automation expects it to start.
        stageId: data.stageId || firstStageId,
        name: data.leadName || 'Untitled Lead',
        company: data.company || '',
        phone: data.phone || '',
        email: data.email || '',
        ownerId: data.ownerId || undefined,
        sourceId: data.sourceId || undefined,
        industryId: data.industryId || undefined,
        jobTitle: data.titleValue || '',
        createdOn: data.createdOn || undefined,
        country: 'India',
      });
    } catch (err) {
      showToast?.(`Lead not created — ${describeError(err)}`);
      return;
    }

    if (createdLead) {
      try {
        runLeadStageAutomation(createdLead, 'New Lead');
      } catch (err) {
        console.error('[CRM Automation] Error generating stage tasks for new lead:', err);
      }
      emitCrmEvent({
        type: CRM_EVENT_TYPES.LEAD_CREATED,
        entityType: 'lead',
        entityId: createdLead.id,
        payload: {
          leadRef: createdLead.leadNumber,
          leadName: createdLead.name,
          ownerName: createdLead.owner,
          path: `/crm/leads/${createdLead.id}`,
        },
      });
    }

    setIsModalOpen(false);
    setShowLeadTour(false);
    setActiveTab('All Leads');
    setAppliedFilters(INITIAL_FILTERS);
    setDraftFilters(INITIAL_FILTERS);
    setAppliedSort(INITIAL_SORT);
    setDraftSort(INITIAL_SORT);
    setLeadView('list');
    setPage(1);
  }

  function openLeadFormBuilder() {
    navigate('/crm/leads/form-builder');
  }

  function openLeadCreateForm() {
    navigate('/crm/leads/create-form');
  }

  function requestDeleteLead(lead) {
    setDeleteTarget(lead);
    setBulkDeleteTargets([]);
  }

  function requestDeleteAll(visibleLeads) {
    if (!visibleLeads || visibleLeads.length === 0) return;
    setDeleteTarget(null);
    setBulkDeleteTargets(visibleLeads);
  }

  function closeDeleteLead() {
    setDeleteTarget(null);
    setBulkDeleteTargets([]);
    setSelected([]);
  }

  async function deleteLead(id) {
    try {
      await deleteLeadRecord(id);
    } catch (err) {
      showToast?.(`Lead not deleted — ${describeError(err)}`);
      return;
    }
    setSelected((current) => current.filter((selectedId) => selectedId !== id));
    closeDeleteLead();
  }

  async function deleteAllLeads(leadsToDelete) {
    const ids = leadsToDelete.map((lead) => lead.id);
    try {
      await deleteLeadRecords(ids);
    } catch (err) {
      showToast?.(`Leads not deleted — ${describeError(err)}`);
      return;
    }
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    closeDeleteLead();
  }

  async function pinLead(lead) {
    if (!lead || lead.isPinned) return;
    try {
      await toggleLeadPin(lead.id);
    } catch (err) {
      showToast?.(`Pin not saved — ${describeError(err)}`);
      return;
    }
    setSelected((current) => current.filter((id) => id !== lead.id));
    closeDeleteLead();
  }

  const pinnedLeadIds = useMemo(
    () => leadRows.filter((lead) => lead.isPinned).map((lead) => lead.id),
    [leadRows],
  );

  async function togglePinLead(lead) {
    if (!lead) return;
    try {
      await toggleLeadPin(lead.id);
    } catch (err) {
      showToast?.(`Pin not saved — ${describeError(err)}`);
    }
  }

  const recordActionLead = selectedLeads.length === 1 ? selectedLeads[0] : null;

  function requestDeleteSelection(target) {
    if (Array.isArray(target)) {
      requestDeleteAll(target);
      return;
    }

    const targetLead = leadRows.find((lead) => lead.id === target) ?? recordActionLead;
    if (targetLead) {
      requestDeleteLead(targetLead);
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Manage and track all your CRM leads."
        guide={leadsGuide}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {createLeadMode && (
              <button
                type="button"
                onClick={openCreateLeadModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-xs transition cursor-pointer"
              >
                <Plus size={16} />
                Create Lead
              </button>
            )}
            <span className="text-sm font-medium text-slate-600 select-none">Create Lead</span>
            <button
              type="button"
              role="switch"
              aria-checked={createLeadMode}
              onClick={() => {
                const next = !createLeadMode;
                setCreateLeadMode(next);
                if (!next) setIsModalOpen(false);
              }}
              className={[
                'relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                createLeadMode ? 'bg-[#17c964]' : 'bg-slate-200',
              ].join(' ')}
            >
              <span className="sr-only">Create Lead</span>
              <span
                className={[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200',
                  createLeadMode ? 'translate-x-7' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>
          </div>
        }
      />

      <InfoBanner
        storageKey="infoBannerLeadsV1"
        title="Why use Leads?"
        text="These are potential customers tracked across stages. You capture a lead once, then calls, tasks, quotations and deals stay linked to it."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        <CrmKpiCard label="Total Active Leads" value={leadRows.length} icon={Users} tone="blue">
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
              <span>↑ 12%</span>
              <span className="text-slate-400 font-normal">vs last week</span>
          </div>
        </CrmKpiCard>

        <CrmKpiCard label="New Leads" value={leadRows.filter((l) => l.status === 'New').length || 1} icon={UserPlus} tone="emerald">
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
              <span>↑ 2%</span>
              <span className="text-slate-400 font-normal">vs last week</span>
          </div>
        </CrmKpiCard>

        <CrmKpiCard label="Pending Tasks" value="3" icon={Clock} tone="amber">
            <div className="text-[11px] font-semibold text-rose-500 mt-0.5 flex items-center gap-1">
              <span>↓ 4%</span>
              <span className="text-slate-400 font-normal">vs last week</span>
          </div>
        </CrmKpiCard>

        <CrmKpiCard label="Deals in Pipeline" value="6" icon={TrendingUp} tone="purple">
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
              <span>↑ 15%</span>
              <span className="text-slate-400 font-normal">Rs 1.72 Cr</span>
          </div>
        </CrmKpiCard>

        <CrmKpiCard label="Total Revenue Expected" value="$17,355,083.00" symbol="$" tone="rose">
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
              <span>↑ 22%</span>
              <span className="text-slate-400 font-normal">$5,884.00 due</span>
          </div>
        </CrmKpiCard>
      </div>

      <LeadsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        isFilterOpen={isFilterOpen}
        onToggleFilter={() => (isFilterOpen ? closeFilterPanel() : openFilterPanel())}
        isSortOpen={isSortOpen}
        sortDraft={draftSort}
        sortApplied={appliedSort}
        sortOptions={SORT_OPTIONS}
        onToggleSort={() => (isSortOpen ? closeSortPanel() : openSortPanel())}
        onSortDraftChange={updateDraftSort}
        onApplySort={applySort}
        onCancelSort={closeSortPanel}
        onClearSort={clearSort}
        leadView={leadView}
        onLeadViewChange={setLeadView}
        onOpenGuide={() => setIsGuideOpen(true)}
        recordActionLead={recordActionLead}
        recordActionLeads={selectedLeads}
        onCloseRecordAction={clearSelected}
        onDeleteRecord={requestDeleteSelection}
        onPrint={() => setIsPrintOpen(true)}
      />

      {isPrintOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsPrintOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Print Leads</h2>
                <p className="text-xs text-slate-500 mt-1">Choose a format for {rows.length} lead records</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsPrintOpen(false)} aria-label="Close print options">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['CSV', 'Excel', 'PDF'].map((format) => (
                <button key={format} type="button" className="border border-slate-200 rounded-lg px-3 py-3 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50" onClick={() => exportLeads(format)}>
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`content-grid${isFilterOpen && leadView !== 'map' ? '' : ' content-grid-wide'}`}>
        {isFilterOpen && leadView !== 'map' && (
          <FilterPanel
            statusFilters={draftFilters.statuses}
            sourceFilters={draftFilters.sources}
            systemDefinedFilters={draftFilters.systemDefined}
            searchFilter={draftFilters.search}
            onStatusChange={(v) => updateDraftFilter('statuses', v)}
            onSourceChange={(v) => updateDraftFilter('sources', v)}
            onSystemDefinedChange={(v) => updateDraftFilter('systemDefined', v)}
            onSearchChange={(v) => updateDraftFilter('search', v)}
            onApply={applyFilters}
            onClear={clearDraftFilters}
            onClose={closeFilterPanel}
          />
        )}
        <div className="table-col">
          {leadView === 'list' ? (
            <>
              <LeadsTable
                rows={pagedRows}
                selected={selected}
                pinnedLeadIds={pinnedLeadIds}
                onTogglePin={togglePinLead}
                onToggleOne={toggleOne}
                onRequestDelete={requestDeleteLead}
                onRequestDeleteAll={requestDeleteAll}
                onToggleAll={toggleAll}
                onAddNote={openNotes}
                onOpenLead={openLeadDetails}
                onUpdateLead={updateLead}
                onDelete={deleteLead}
              />
              <div className="table-card pager-wrap" style={{ marginTop: 10 }}>
                <Pagination
                  total={rows.length}
                  page={page}
                  pageSize={pageSize}
                  onChange={setPage}
                  showTotalRecords
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </>
          ) : leadView === 'grid' ? (
            <>
              <LeadsTable
                rows={pagedRows}
                selected={selected}
                pinnedLeadIds={pinnedLeadIds}
                onTogglePin={togglePinLead}
                onToggleOne={toggleOne}
                onRequestDelete={requestDeleteLead}
                onRequestDeleteAll={requestDeleteAll}
                onToggleAll={toggleAll}
                onAddNote={openNotes}
                onOpenLead={openLeadDetails}
                onUpdateLead={updateLead}
                variant="grid"
                onDelete={deleteLead}
              />
              <div className="table-card pager-wrap" style={{ marginTop: 10 }}>
                <Pagination
                  total={rows.length}
                  page={page}
                  pageSize={pageSize}
                  onChange={setPage}
                  showTotalRecords
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </>
          ) : leadView === 'tile' ? (
            <LeadCardGridView
              rows={pagedRows}
              selected={selected}
              pinnedLeadIds={pinnedLeadIds}
              onTogglePin={togglePinLead}
              onToggleOne={toggleOne}
              onRequestDelete={requestDeleteLead}
              onAddNote={openNotes}
              onOpenLead={openLeadDetails}
              onDelete={deleteLead}
            />
          ) : (
            <LeadMapView
              rows={rows}
              selected={selected}
              onToggleOne={toggleOne}
              onAddNote={openNotes}
              onOpenListView={() => setLeadView('list')}
              onOpenLead={openLeadDetails}
            />
          )}
        </div>
      </div>

      <NotesDrawer lead={noteTarget} isOpen={Boolean(noteTarget)} onClose={closeNotes} onCreateTask={openTaskForm} />
      {(deleteTarget || bulkDeleteTargets.length > 0) && (
        <DeleteLeadModal
          lead={deleteTarget}
          leads={bulkDeleteTargets}
          onClose={closeDeleteLead}
          onConfirm={deleteLead}
          onConfirmAll={deleteAllLeads}
        />
      )}
      <CreateLeadModal
        isOpen={isCreateLeadOpen}
        showTour={showLeadTour}
        onClose={() => { setIsModalOpen(false); setShowLeadTour(false); }}
        onCreate={handleCreateLead}
        onEditLayout={() => { setIsModalOpen(false); setShowLeadTour(false); navigate('/crm/leads/form-builder'); }}
      />
      <LeadGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
}
